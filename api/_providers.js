const providers = {
  demo: {
    id: "demo",
    name: "Demo Provider",
    available: true
  },
  gemini: {
    id: "gemini",
    name: "Gemini",
    available: false
    // TODO: Connect Gemini through this server-side provider.
    // Required env later: GEMINI_API_KEY, GEMINI_MODEL.
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

function getProvider(mode) {
  return providers[mode] || null;
}

module.exports = {
  getProvider,
  providers
};
