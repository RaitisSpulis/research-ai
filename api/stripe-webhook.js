const crypto = require("crypto");
const { markUserPro } = require("./_auth");
const { sendError, sendOk } = require("./_responses");

const SIGNATURE_TOLERANCE_SECONDS = 300;

function getRawBody(request) {
  if (Buffer.isBuffer(request.body)) return request.body.toString("utf8");
  if (typeof request.body === "string") return request.body;
  if (request.rawBody) return Buffer.isBuffer(request.rawBody) ? request.rawBody.toString("utf8") : String(request.rawBody);
  return JSON.stringify(request.body || {});
}

function parseStripeSignature(header) {
  return String(header || "")
    .split(",")
    .reduce((acc, part) => {
      const [key, value] = part.split("=");
      if (!key || !value) return acc;
      if (key === "t") acc.timestamp = value;
      if (key === "v1") acc.signatures.push(value);
      return acc;
    }, { timestamp: "", signatures: [] });
}

function safeCompareHex(a, b) {
  const left = Buffer.from(String(a), "hex");
  const right = Buffer.from(String(b), "hex");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!secret) {
    const error = new Error("Stripe webhook is not configured.");
    error.code = "missing_webhook_secret";
    throw error;
  }

  const parsed = parseStripeSignature(signatureHeader);
  if (!parsed.timestamp || !parsed.signatures.length) {
    const error = new Error("Stripe webhook signature is missing.");
    error.code = "invalid_signature";
    throw error;
  }

  const timestamp = Number(parsed.timestamp);
  if (!Number.isFinite(timestamp)) {
    const error = new Error("Stripe webhook timestamp is invalid.");
    error.code = "invalid_signature";
    throw error;
  }

  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (age > SIGNATURE_TOLERANCE_SECONDS) {
    const error = new Error("Stripe webhook timestamp is outside tolerance.");
    error.code = "invalid_signature";
    throw error;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${parsed.timestamp}.${rawBody}`)
    .digest("hex");

  const valid = parsed.signatures.some(signature => safeCompareHex(signature, expected));
  if (!valid) {
    const error = new Error("Stripe webhook signature is invalid.");
    error.code = "invalid_signature";
    throw error;
  }
}

function getHeader(request, name) {
  return request.headers?.[name] || request.headers?.[name.toLowerCase()] || request.headers?.[name.toUpperCase()];
}

function getClerkUserIdFromSession(session) {
  return (
    session?.client_reference_id ||
    session?.metadata?.clerkUserId ||
    session?.metadata?.clerk_user_id ||
    ""
  );
}

async function handleCheckoutCompleted(session) {
  const userId = getClerkUserIdFromSession(session);
  if (!userId) {
    const error = new Error("Checkout session did not include a Clerk user id.");
    error.code = "missing_clerk_user";
    throw error;
  }

  await markUserPro(userId, {
    customerId: session.customer || "",
    subscriptionId: session.subscription || "",
    checkoutSessionId: session.id || ""
  });
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendError(response, 400, "method_not_allowed", "Use POST for Stripe webhooks.");
    return;
  }

  const rawBody = getRawBody(request);
  const signature = getHeader(request, "stripe-signature");

  try {
    verifyStripeSignature(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    sendError(response, 400, error.code || "invalid_signature", "Invalid Stripe webhook signature.");
    return;
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    sendError(response, 400, "invalid_payload", "Stripe webhook payload must be valid JSON.");
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event.data?.object);
    }

    sendOk(response, {
      received: true,
      handled: event.type === "checkout.session.completed"
    });
  } catch (error) {
    console.error("[ResearchAI] Stripe webhook failed:", error);
    sendError(response, 500, error.code || "webhook_failed", "Stripe webhook could not be processed.");
  }
};

module.exports._test = {
  verifyStripeSignature,
  getClerkUserIdFromSession
};
