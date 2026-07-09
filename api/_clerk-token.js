const crypto = require("crypto");

function getAuthToken(request) {
  const header = request.headers?.authorization || request.headers?.Authorization || "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

function decodeJwtPart(token, index) {
  const part = String(token).split(".")[index];
  if (!part) return null;
  try {
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function base64UrlToBuffer(value) {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

function getExpectedClerkIssuer() {
  const configured = process.env.CLERK_JWT_ISSUER || process.env.CLERK_ISSUER;
  if (configured) return String(configured).replace(/\/+$/, "");

  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY || "";
  const [, , encodedFrontendApi] = publishableKey.split("_");
  if (!encodedFrontendApi) return "";

  try {
    const frontendApi = Buffer.from(encodedFrontendApi, "base64").toString("utf8").replace(/\$$/, "");
    return frontendApi ? `https://${frontendApi}` : "";
  } catch {
    return "";
  }
}

async function verifyClerkToken(token) {
  const [encodedHeader, encodedPayload, encodedSignature] = String(token).split(".");
  const header = decodeJwtPart(token, 0);
  const payload = decodeJwtPart(token, 1);

  if (!encodedHeader || !encodedPayload || !encodedSignature || !header?.kid || !payload?.iss) {
    return null;
  }

  if (header.alg !== "RS256") {
    return null;
  }

  const issuer = String(payload.iss).replace(/\/+$/, "");
  const expectedIssuer = getExpectedClerkIssuer();
  if (!expectedIssuer || issuer !== expectedIssuer) {
    return null;
  }

  const jwksResponse = await fetch(`${expectedIssuer}/.well-known/jwks.json`);
  const jwks = await jwksResponse.json().catch(() => null);
  const jwk = jwks?.keys?.find(key => key.kid === header.kid);
  if (!jwk) return null;

  const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const valid = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    key,
    base64UrlToBuffer(encodedSignature)
  );

  if (!valid) return null;
  if (payload.exp && Date.now() / 1000 >= payload.exp) return null;

  return payload;
}

async function verifyClerkRequest(request) {
  const token = getAuthToken(request);
  if (!token) return null;
  return verifyClerkToken(token);
}

module.exports = {
  getAuthToken,
  getExpectedClerkIssuer,
  verifyClerkRequest,
  verifyClerkToken
};
