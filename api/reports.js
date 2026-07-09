const { verifyClerkRequest } = require("./_clerk-token");
const { isUserPro } = require("./_auth");
const { sendError, sendOk } = require("./_responses");
const {
  assertUsageAvailable,
  deleteReport,
  getUsage,
  incrementUsage,
  isProClerkUser,
  listReports,
  saveReport,
  updateReportPin,
  upsertUser
} = require("./_supabase");

function parseBody(request) {
  if (!request.body) return {};
  if (typeof request.body === "object") return request.body;
  try {
    return JSON.parse(request.body);
  } catch {
    return null;
  }
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
    return await isUserPro(clerkUser.sub);
  } catch (error) {
    console.warn("[ResearchAI reports] Clerk pro metadata lookup unavailable");
    return false;
  }
}

module.exports = async function handler(request, response) {
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
      if (!body || typeof body.report !== "object") {
        sendError(response, 400, "invalid_request", "Report data is required.");
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
      if (!body || typeof body.id !== "string") {
        sendError(response, 400, "invalid_request", "Report id is required.");
        return;
      }

      const report = await updateReportPin(userId, body.id, Boolean(body.pinned));
      const reports = await listReports(userId);
      sendOk(response, { report, reports });
      return;
    }

    if (request.method === "DELETE") {
      const body = parseBody(request);
      if (!body || typeof body.id !== "string") {
        sendError(response, 400, "invalid_request", "Report id is required.");
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
