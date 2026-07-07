const { getProvider } = require("./_providers");
const { sendError, sendOk } = require("./_responses");

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

  if (typeof body.prompt !== "string" || !body.prompt.trim()) {
    return "Prompt is required.";
  }

  if (body.prompt.trim().length < 8) {
    return "Prompt must be at least 8 characters.";
  }

  if (body.prompt.length > MAX_PROMPT_LENGTH) {
    return `Prompt must be ${MAX_PROMPT_LENGTH} characters or fewer.`;
  }

  if (body.mode && typeof body.mode !== "string") {
    return "Mode must be a string.";
  }

  return "";
}

module.exports = function handler(request, response) {
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
