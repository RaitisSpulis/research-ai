const { verifyClerkRequest } = require("./_clerk-token");
const { sendError, sendOk } = require("./_responses");
const { getUsage, isProClerkUser, upsertUser } = require("./_supabase");

function sendSupabaseError(response, error) {
  if (error.code === "missing_supabase_configuration") {
    sendError(response, 500, "missing_supabase_configuration", "Database is not configured.");
    return;
  }

  sendError(response, error.statusCode || 500, error.code || "database_error", "Database request failed.");
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendError(response, 400, "method_not_allowed", "Use GET to read usage.");
    return;
  }

  const clerkUser = await verifyClerkRequest(request);
  if (!clerkUser?.sub) {
    sendError(response, 401, "unauthorized", "Sign in is required.");
    return;
  }

  try {
    await upsertUser(clerkUser);
    const usage = await getUsage(clerkUser.sub);
    sendOk(response, {
      usage,
      pro: isProClerkUser(clerkUser)
    });
  } catch (error) {
    sendSupabaseError(response, error);
  }
};
