const { verifyClerkRequest } = require("./_clerk-token");
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
    sendError(response, 401, "unauthorized", "Sign in is required.");
    return null;
  }

  await upsertUser(clerkUser);
  return clerkUser;
}

function sendSupabaseError(response, error) {
  if (error.code === "free_limit_reached") {
    sendError(response, 429, "free_limit_reached", "Free monthly report limit reached.", error.usage);
    return;
  }

  if (error.code === "missing_supabase_configuration") {
    sendError(response, 500, "missing_supabase_configuration", "Database is not configured.");
    return;
  }

  sendError(response, error.statusCode || 500, error.code || "database_error", "Database request failed.");
}

module.exports = async function handler(request, response) {
  const clerkUser = await authenticate(request, response);
  if (!clerkUser) return;

  const userId = clerkUser.sub;
  const pro = isProClerkUser(clerkUser);

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
