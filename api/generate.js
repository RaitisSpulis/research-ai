const { getProvider, ProviderError } = require("./_providers");
const { sendError, sendOk } = require("./_responses");
const { verifyClerkRequest } = require("./_clerk-token");
const { assertUsageAvailable, incrementUsage, isProClerkUser, upsertUser } = require("./_supabase");

const MAX_PROMPT_LENGTH = 500;

function parseBody(request) {
  if (!request.body) return {};
  if (typeof request.body === "object") return request.body;
  try {
    return JSON.parse(request.body);
  } catch {
    return null;
  }
}

function validateGenerateRequest(body) {
  if (!body) {
    return "Request body must be valid JSON.";
  }

  const prompt = body.prompt || body.userPrompt;

  if (typeof prompt !== "string" || !prompt.trim()) {
    return "Prompt is required.";
  }

  if (prompt.trim().length < 8) {
    return "Prompt must be at least 8 characters.";
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return `Prompt must be ${MAX_PROMPT_LENGTH} characters or fewer.`;
  }

  if (body.mode && typeof body.mode !== "string") {
    return "Mode must be a string.";
  }

  return "";
}

function createGenerateRequest(body, mode) {
  const userPrompt = (body.userPrompt || body.prompt).trim();
  const createdAt = body.createdAt || new Date().toISOString();

  return {
    userPrompt,
    intent: body.intent || "general_research",
    industry: body.industry || "general",
    reportType: body.reportType || body.intent || "general_research",
    mode,
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
    createdAt
  };
}

function sendProviderError(response, error) {
  if (error instanceof ProviderError) {
    sendError(response, error.statusCode, error.code, error.message);
    return;
  }

  sendError(response, 500, "provider_error", "The report provider could not complete the request.");
}

function sendDatabaseError(response, error) {
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
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendError(response, 400, "method_not_allowed", "Use POST to generate a report.");
    return;
  }

  const body = parseBody(request);
  const validationError = validateGenerateRequest(body);
  if (validationError) {
    sendError(response, 400, "invalid_request", validationError);
    return;
  }

  const mode = body.mode || "demo";
  const provider = getProvider(mode);
  if (!provider) {
    sendError(response, 400, "invalid_provider", `Unknown generation mode: ${mode}`);
    return;
  }

  if (mode === "gemini") {
    const clerkUser = await verifyClerkRequest(request);
    if (!clerkUser?.sub) {
      sendError(response, 401, "unauthorized", "Sign in is required for live AI generation.");
      return;
    }

    try {
      const pro = isProClerkUser(clerkUser);
      await upsertUser(clerkUser);
      await assertUsageAvailable(clerkUser.sub, pro);
      const report = await provider.generate(createGenerateRequest(body, mode));
      const usage = await incrementUsage(clerkUser.sub, pro);
      sendOk(response, {
        status: "generated",
        service: "ResearchAI API",
        mode,
        report,
        usage,
        usageCounted: true
      });
    } catch (error) {
      if (error.code === "free_limit_reached" || error.code === "missing_supabase_configuration" || error.code === "supabase_request_failed") {
        sendDatabaseError(response, error);
        return;
      }
      sendProviderError(response, error);
    }
    return;
  }

  if (mode !== "demo") {
    sendError(response, 500, "provider_unavailable", `${provider.name} is not connected yet.`);
    return;
  }

  sendOk(response, {
    status: "placeholder",
    service: "ResearchAI API",
    mode,
    report: null,
    message: "Backend route is ready. Demo generation still runs in the browser until AI integration is enabled."
  });
};
