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
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

class ProviderError extends Error {
  constructor(code, message, statusCode, details) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.statusCode = statusCode || 500;
    this.details = details || null;
  }
}

function logGeminiDebug(label, value) {
  if (process.env.NODE_ENV === "production") return;
  console.error(`[GeminiProvider] ${label}`, value);
}

function buildGeminiPrompt(request) {
  return [
    "Create a professional ResearchAI report as strict JSON only.",
    "Do not wrap the JSON in markdown.",
    "Do not invent citations or claim verified sources.",
    `User prompt: ${request.userPrompt}`,
    `Intent: ${request.intent || "general_research"}`,
    `Industry: ${request.industry || "general"}`,
    `Report type: ${request.reportType || "general_research"}`,
    "The report structure must adapt to the user question. Do not force a universal 12-section shell.",
    "Avoid unsupported market sizes. If numbers are illustrative, label assumptions and show how to validate them.",
    "Every recommendation must include action, why, success condition and failure condition.",
    "End with a clear final recommendation: Go, No-Go, Wait, Test first, Choose option A or Choose option B.",
    "Use this JSON schema:",
    JSON.stringify({
      reportTitle: "string",
      reportType: "string",
      sections: [
        {
          id: "short-kebab-case-id",
          title: "string",
          purpose: "string",
          layoutType: "paragraphs | items | table | scenarios | recommendations | evidence | final",
          paragraphs: ["string"],
          items: [{ title: "string", text: "string" }],
          table: { headers: ["string"], rows: [["string"]] },
          scenarios: [{ name: "string", summary: "string", assumptions: ["string"], threshold: "string" }],
          recommendations: [{ action: "string", why: "string", success: "string", failure: "string" }]
        }
      ],
      finalRecommendation: {
        decision: "Go | No-Go | Wait | Test first | Choose option A | Choose option B",
        confidence: "Low | Medium | High",
        biggestAssumption: "string",
        nextStep: "string",
        deadline: "string"
      },
      limitations: ["string"],
      evidenceToVerify: ["string"]
    })
  ].join("\n");
}

function collectText(value, results = []) {
  if (!value) return results;

  if (typeof value === "string") {
    results.push(value);
    return results;
  }

  if (Array.isArray(value)) {
    value.forEach(item => collectText(item, results));
    return results;
  }

  if (typeof value !== "object") return results;

  if (typeof value.text === "string") results.push(value.text);
  if (typeof value.output_text === "string") results.push(value.output_text);
  if (typeof value.outputText === "string") results.push(value.outputText);

  collectText(value.parts, results);
  collectText(value.content, results);
  collectText(value.contents, results);
  collectText(value.output, results);
  collectText(value.outputs, results);
  collectText(value.steps, results);
  collectText(value.delta, results);

  return results;
}

function extractGeminiText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  if (typeof payload?.outputText === "string") return payload.outputText.trim();

  const collected = collectText(payload?.steps || payload?.output || payload?.outputs)
    .join("")
    .trim();
  if (collected) return collected;

  // Backward compatibility with generateContent responses.
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
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

    if (!apiKey) {
      throw new ProviderError("unauthorized", "Gemini is not configured.", 401);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    try {
      const response = await fetch(GEMINI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          input: buildGeminiPrompt(request),
          generation_config: {
            temperature: 0.4,
            max_output_tokens: 2048
          }
        })
      });

      const responseText = await response.text();
      let payload = null;

      if (responseText) {
        try {
          payload = JSON.parse(responseText);
        } catch {
          payload = { raw: responseText };
        }
      }

      if (!response.ok) {
        logGeminiDebug("status", response.status);
        logGeminiDebug("error body", payload || responseText || null);
      }

      if (response.status === 401 || response.status === 403) {
        throw new ProviderError("unauthorized", "Gemini authorization failed.", 401);
      }

      if (response.status === 429) {
        throw new ProviderError("rate_limited", "Gemini rate limit reached.", 429);
      }

      if (!response.ok) {
        throw new ProviderError("provider_error", "Gemini could not generate a response.", 500);
      }

      const text = extractGeminiText(payload);

      if (!text) {
        logGeminiDebug("response parsing failure", payload);
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
