const { getProvider, ProviderError } = require("./_providers");
const { sendError, sendOk } = require("./_responses");
const { verifyClerkRequest } = require("./_clerk-token");
const { assertUsageAvailable, incrementUsage, isProClerkUser, upsertUser } = require("./_supabase");
const { isUserPro } = require("./_auth");

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
    if (error.code === "rate_limited") {
      console.warn("[ResearchAI generate] Gemini provider_rate_limited");
      sendError(response, 503, "provider_rate_limited", "The AI provider is busy. Please wait a minute and try again.");
      return;
    }

    if (error.code === "unauthorized") {
      console.warn("[ResearchAI generate] Gemini provider_unavailable authorization");
      sendError(response, 503, "provider_unavailable", "The AI provider is temporarily unavailable.");
      return;
    }

    console.warn("[ResearchAI generate] Gemini provider_unavailable", error.code || "provider_error");
    sendError(response, error.statusCode || 503, "provider_unavailable", "The AI provider is temporarily unavailable.");
    return;
  }

  console.error("[ResearchAI generate] internal app logic provider error:", error);
  sendError(response, 500, "internal_error", "ResearchAI could not generate the report.");
}

function sendDatabaseError(response, error) {
  if (error.code === "free_limit_reached") {
    console.warn("[ResearchAI generate] Supabase free_limit_reached");
    sendError(response, 429, "free_limit_reached", "You used your 5 free reports this month.", error.usage);
    return;
  }

  if (error.code === "missing_supabase_configuration") {
    console.error("[ResearchAI generate] Supabase missing configuration");
    sendError(response, 500, "database_error", "ResearchAI could not read your report usage. Please try again.");
    return;
  }

  console.error("[ResearchAI generate] Supabase database_error:", error.code || error.message);
  sendError(response, 500, "database_error", "ResearchAI could not read your report usage. Please try again.");
}

async function resolveProStatus(clerkUser) {
  if (isProClerkUser(clerkUser)) return true;
  try {
    return await isUserPro(clerkUser.sub);
  } catch (error) {
    console.warn("[ResearchAI generate] Clerk pro metadata lookup unavailable");
    return false;
  }
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
    console.warn("[ResearchAI generate] internal app logic invalid_request");
    sendError(response, 400, "invalid_request", validationError);
    return;
  }

  const mode = body.mode || "demo";
  const provider = getProvider(mode);
  if (!provider) {
    console.warn("[ResearchAI generate] internal app logic invalid_provider", mode);
    sendError(response, 400, "invalid_provider", `Unknown generation mode: ${mode}`);
    return;
  }

  if (mode === "gemini") {
    let clerkUser = null;
    try {
      clerkUser = await verifyClerkRequest(request);
    } catch (error) {
      console.warn("[ResearchAI generate] Clerk auth_required verification failed");
      sendError(response, 401, "auth_required", "Sign in is required to generate reports.");
      return;
    }

    if (!clerkUser?.sub) {
      console.warn("[ResearchAI generate] Clerk auth_required");
      sendError(response, 401, "auth_required", "Sign in is required to generate reports.");
      return;
    }

    try {
      const pro = await resolveProStatus(clerkUser);
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
    console.warn("[ResearchAI generate] internal app logic provider_unavailable", mode);
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
