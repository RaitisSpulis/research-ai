const LOCAL_ORIGINS = new Set([
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8000",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8000"
]);

function normalizeOrigin(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return "";
  }
}

function getHeader(request, name) {
  return request.headers?.[name] || request.headers?.[name.toLowerCase()] || request.headers?.[name.toUpperCase()] || "";
}

function getAllowedOrigins() {
  const origins = new Set(LOCAL_ORIGINS);
  const siteUrl = normalizeOrigin(process.env.SITE_URL || "");
  const vercelUrl = process.env.VERCEL_URL ? normalizeOrigin(`https://${process.env.VERCEL_URL}`) : "";

  if (siteUrl) origins.add(siteUrl);
  if (vercelUrl) origins.add(vercelUrl);

  return origins;
}

function isAllowedBrowserOrigin(request) {
  const origin = normalizeOrigin(getHeader(request, "origin"));
  if (!origin) return true;
  return getAllowedOrigins().has(origin);
}

function rejectDisallowedOrigin(request, response, sendError) {
  if (isAllowedBrowserOrigin(request)) return false;
  console.warn("[ResearchAI security] rejected disallowed origin");
  sendError(response, 403, "origin_not_allowed", "Request origin is not allowed.");
  return true;
}

module.exports = {
  getAllowedOrigins,
  isAllowedBrowserOrigin,
  rejectDisallowedOrigin
};
