const { verifyClerkRequest } = require("./_clerk-token");
const { isUserPro } = require("./_auth");
const { sendError, sendOk } = require("./_responses");
const { rejectDisallowedOrigin } = require("./_security");
const {
  assertUsageAvailable,
  deleteReport,
  getUsage,
  getUserByClerkId,
  incrementUsage,
  isProClerkUser,
  listReports,
  saveReport,
  updateReportPin,
  upsertUser
} = require("./_supabase");

const MAX_REPORT_JSON_BYTES = 160000;
const MAX_REPORT_ID_LENGTH = 180;
const MAX_REPORT_TITLE_LENGTH = 240;
const MAX_REPORT_PROMPT_LENGTH = 2000;

function parseBody(request) {
  if (!request.body) return {};
  if (typeof request.body === "object") return request.body;
  try {
    return JSON.parse(request.body);
  } catch {
    return null;
  }
}

function jsonByteLength(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function validateReportPayload(report) {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return "Report data is required.";
  }

  if (jsonByteLength(report) > MAX_REPORT_JSON_BYTES) {
    return "Report data is too large to save.";
  }

  if (report.id !== undefined && String(report.id).length > MAX_REPORT_ID_LENGTH) {
    return "Report id is too long.";
  }

  if (report.title !== undefined && String(report.title).length > MAX_REPORT_TITLE_LENGTH) {
    return "Report title is too long.";
  }

  const prompt = report.prompt || report.userPrompt || "";
  if (prompt !== undefined && String(prompt).length > MAX_REPORT_PROMPT_LENGTH) {
    return "Report prompt is too long.";
  }

  return "";
}

function validateReportId(id) {
  if (typeof id !== "string" || !id.trim()) {
    return "Report id is required.";
  }

  if (id.length > MAX_REPORT_ID_LENGTH) {
    return "Report id is too long.";
  }

  return "";
}

async function authenticate(request, response) {
  const clerkUser = await verifyClerkRequest(request);
  if (!clerkUser?.sub) {
    console.warn("[ResearchAI reports] Clerk auth_required");
    sendError(response, 401, "auth_required", "Sign in is required.");
    return null;
  }

  await upsertUser(clerkUser);
  return clerkUser;
}

function sendSupabaseError(response, error) {
  if (error.code === "free_limit_reached") {
    console.warn("[ResearchAI reports] Supabase free_limit_reached");
    sendError(response, 429, "free_limit_reached", "You used your 5 free reports this month.", error.usage);
    return;
  }

  if (error.code === "missing_supabase_configuration") {
    console.error("[ResearchAI reports] Supabase missing configuration");
    sendError(response, 500, "database_error", "ResearchAI could not save your report. Please try again.");
    return;
  }

  console.error("[ResearchAI reports] Supabase database_error:", error.code || error.message);
  sendError(response, 500, "database_error", "ResearchAI could not save your report. Please try again.");
}

async function resolveProStatus(clerkUser) {
  if (isProClerkUser(clerkUser)) return true;
  try {
    if (await isUserPro(clerkUser.sub)) return true;
  } catch (error) {
    console.warn("[ResearchAI reports] Clerk pro metadata lookup unavailable");
  }

  try {
    const user = await getUserByClerkId(clerkUser.sub);
    return user?.plan === "pro";
  } catch (error) {
    console.warn("[ResearchAI reports] Supabase plan lookup unavailable");
    return false;
  }
}

module.exports = async function handler(request, response) {
  if (rejectDisallowedOrigin(request, response, sendError)) return;

  const clerkUser = await authenticate(request, response);
  if (!clerkUser) return;

  const userId = clerkUser.sub;
  const pro = await resolveProStatus(clerkUser);

  try {
    if (request.method === "GET") {
      const reports = await listReports(userId);
      const usage = await getUsage(userId);
      sendOk(response, { reports, usage });
      return;
    }

    if (request.method === "POST") {
      const body = parseBody(request);
      const validationError = validateReportPayload(body?.report);
      if (validationError) {
        sendError(response, 400, "invalid_request", validationError);
        return;
      }

      let usage = await getUsage(userId);
      if (body.countUsage) {
        await assertUsageAvailable(userId, pro);
        usage = await incrementUsage(userId, pro);
      }

      const report = await saveReport(userId, body.report);
      sendOk(response, { report, usage });
      return;
    }

    if (request.method === "PATCH") {
      const body = parseBody(request);
      const validationError = validateReportId(body?.id);
      if (validationError) {
        sendError(response, 400, "invalid_request", validationError);
        return;
      }

      const report = await updateReportPin(userId, body.id, Boolean(body.pinned));
      const reports = await listReports(userId);
      sendOk(response, { report, reports });
      return;
    }

    if (request.method === "DELETE") {
      const body = parseBody(request);
      const validationError = validateReportId(body?.id);
      if (validationError) {
        sendError(response, 400, "invalid_request", validationError);
        return;
      }

      await deleteReport(userId, body.id);
      const reports = await listReports(userId);
      sendOk(response, { deleted: true, reports });
      return;
    }

    response.setHeader("Allow", "GET, POST, PATCH, DELETE");
    sendError(response, 400, "method_not_allowed", "Use GET, POST, PATCH or DELETE for reports.");
  } catch (error) {
    sendSupabaseError(response, error);
  }
};
