const crypto = require("crypto");
const { markUserPro } = require("./_auth");
const { sendError, sendOk } = require("./_responses");

const SIGNATURE_TOLERANCE_SECONDS = 300;

async function getRawBody(request) {
  if (Buffer.isBuffer(request.rawBody)) return request.rawBody.toString("utf8");
  if (typeof request.rawBody === "string") return request.rawBody;
  if (Buffer.isBuffer(request.body)) return request.body.toString("utf8");
  if (typeof request.body === "string") return request.body;

  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
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
    error.code = "missing_stripe_signature";
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

function constructStripeEvent(rawBody, signature, secret) {
  verifyStripeSignature(rawBody, signature, secret);
  return JSON.parse(rawBody);
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
  console.log("[Stripe webhook] checkout.session.completed");
  const userId = getClerkUserIdFromSession(session);
  if (!userId) {
    const error = new Error("Checkout session did not include a Clerk user id.");
    error.code = "missing_clerk_user";
    throw error;
  }
  console.log("[Stripe webhook] clerk user id found", userId);

  await markUserPro(userId, {
    customerId: session.customer || "",
    subscriptionId: session.subscription || "",
    checkoutSessionId: session.id || ""
  });
  console.log("[Stripe webhook] Clerk user marked Pro", userId);
}

async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendError(response, 400, "method_not_allowed", "Use POST for Stripe webhooks.");
    return;
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = getHeader(request, "stripe-signature");
  console.log("[Stripe webhook] secret present", Boolean(secret));
  console.log("[Stripe webhook] signature header present", Boolean(signature));

  if (!secret) {
    sendError(response, 500, "missing_webhook_secret", "Stripe webhook secret is not configured.");
    return;
  }

  if (!signature) {
    sendError(response, 400, "missing_stripe_signature", "Stripe webhook signature header is missing.");
    return;
  }

  let rawBody;
  try {
    rawBody = await getRawBody(request);
  } catch (error) {
    console.error("[Stripe webhook] raw body read failed:", error);
    sendError(response, 400, "invalid_payload", "Stripe webhook raw body could not be read.");
    return;
  }

  let event;
  try {
    event = constructStripeEvent(rawBody, signature, secret);
  } catch (error) {
    sendError(response, 400, error.code || "invalid_signature", "Invalid Stripe webhook signature.");
    return;
  }

  try {
    console.log("[Stripe webhook] received event", event.type);
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
}

module.exports = handler;
module.exports.config = {
  api: {
    bodyParser: false
  }
};
module.exports._test = {
  constructStripeEvent,
  getRawBody,
  verifyStripeSignature,
  getClerkUserIdFromSession
};
