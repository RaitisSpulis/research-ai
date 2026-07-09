const { verifyClerkRequest } = require("./_clerk-token");
const { sendError, sendOk } = require("./_responses");
const { getUsage, isProClerkUser, upsertUser } = require("./_supabase");
const { rejectDisallowedOrigin } = require("./_security");

function sendSupabaseError(response, error) {
  if (error.code === "missing_supabase_configuration") {
    console.error("[ResearchAI usage] Supabase missing configuration");
    sendError(response, 500, "database_error", "ResearchAI could not read your report usage. Please try again.");
    return;
  }

  console.error("[ResearchAI usage] Supabase database_error:", error.code || error.message);
  sendError(response, 500, "database_error", "ResearchAI could not read your report usage. Please try again.");
}

module.exports = async function handler(request, response) {
  if (rejectDisallowedOrigin(request, response, sendError)) return;

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendError(response, 400, "method_not_allowed", "Use GET to read usage.");
    return;
  }

  const clerkUser = await verifyClerkRequest(request);
  if (!clerkUser?.sub) {
    console.warn("[ResearchAI usage] Clerk auth_required");
    sendError(response, 401, "auth_required", "Sign in is required.");
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
