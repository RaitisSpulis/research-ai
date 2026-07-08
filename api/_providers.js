const providers = {
  demo: {
    id: "demo",
    name: "Demo Provider",
    available: true
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    available: false
    // TODO: Connect OpenRouter through this server-side provider.
    // Required env later: OPENROUTER_API_KEY, OPENROUTER_MODEL.
  },
  future: {
    id: "future",
    name: "Future Provider",
    available: false
    // TODO: Add additional provider adapters behind the same generate contract.
  }
};

const GEMINI_TIMEOUT_MS = 20000;

class ProviderError extends Error {
  constructor(code, message, statusCode, details) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.statusCode = statusCode || 500;
    this.details = details || null;
  }
}

function buildGeminiPrompt(request) {
  return [
    "Create a professional research report draft for ResearchAI.",
    "Return concise, structured plain text only. Do not invent citations.",
    `User prompt: ${request.userPrompt}`,
    `Intent: ${request.intent || "general_research"}`,
    `Industry: ${request.industry || "general"}`,
    `Report type: ${request.reportType || "general_research"}`,
    "Clearly separate useful analysis from assumptions and source guidance."
  ].join("\n");
}

function extractGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map(part => part.text || "").join("").trim();
}

const GeminiProvider = {
  id: "gemini",
  name: "Gemini",
  available: true,

  async generate(request) {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";

    if (!apiKey) {
      throw new ProviderError("unauthorized", "Gemini is not configured.", 401);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: buildGeminiPrompt(request) }]
            }
          ],
          generationConfig: {
            temperature: 0.4,
            topP: 0.9,
            maxOutputTokens: 2048
          }
        })
      });

      if (response.status === 401 || response.status === 403) {
        throw new ProviderError("unauthorized", "Gemini authorization failed.", 401);
      }

      if (response.status === 429) {
        throw new ProviderError("rate_limited", "Gemini rate limit reached.", 429);
      }

      if (!response.ok) {
        throw new ProviderError("provider_error", "Gemini could not generate a response.", 500);
      }

      const payload = await response.json();
      const text = extractGeminiText(payload);

      if (!text) {
        throw new ProviderError("invalid_response", "Gemini returned an empty response.", 500);
      }

      return {
        provider: "gemini",
        model,
        mode: "gemini",
        createdAt: new Date().toISOString(),
        text
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (error.name === "AbortError") {
        throw new ProviderError("timeout", "Gemini request timed out.", 500);
      }
      throw new ProviderError("network_error", "Gemini request failed.", 500);
    } finally {
      clearTimeout(timeout);
    }
  }
};

providers.gemini = GeminiProvider;

function getProvider(mode) {
  return providers[mode] || null;
}

module.exports = {
  getProvider,
  GeminiProvider,
  ProviderError,
  providers
};
