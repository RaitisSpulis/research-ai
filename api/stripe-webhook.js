const crypto = require("crypto");
const { markUserFree, markUserPro } = require("./_auth");
const { sendError, sendOk } = require("./_responses");
const { updateUserPlan } = require("./_supabase");

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

function getClerkUserIdFromSubscription(subscription) {
  return (
    subscription?.metadata?.clerkUserId ||
    subscription?.metadata?.clerk_user_id ||
    ""
  );
}

function getClerkUserIdFromInvoice(invoice) {
  return (
    invoice?.subscription_details?.metadata?.clerkUserId ||
    invoice?.subscription_details?.metadata?.clerk_user_id ||
    invoice?.metadata?.clerkUserId ||
    invoice?.metadata?.clerk_user_id ||
    ""
  );
}

function getSubscriptionPlan(status) {
  if (status === "active" || status === "trialing") return "pro";
  if (status === "past_due" || status === "unpaid") return "past_due";
  return "free";
}

async function syncSubscriptionToClerkAndSupabase(userId, plan, subscription = {}) {
  if (!userId) {
    console.log("[Subscription sync] no Clerk user id found");
    return;
  }

  if (plan === "pro") {
    await markUserPro(userId, subscription);
    console.log("[Subscription sync] Clerk updated", userId);
  } else {
    await markUserFree(userId, subscription);
    console.log("[Subscription sync] Clerk updated", userId);
  }

  await updateUserPlan(userId, plan, subscription);
  console.log("[Subscription sync] Supabase plan updated", userId, plan);
}

async function handleCheckoutCompleted(session) {
  console.log("[Stripe webhook] checkout.session.completed");
  const userId = getClerkUserIdFromSession(session);
  if (!userId) {
    console.log("[Subscription sync] no Clerk user id found");
    return;
  }
  console.log("[Stripe webhook] clerk user id found", userId);

  await syncSubscriptionToClerkAndSupabase(userId, "pro", {
    customerId: session.customer || "",
    subscriptionId: session.subscription || "",
    checkoutSessionId: session.id || "",
    status: "active"
  });
}

async function handleSubscriptionUpdated(subscription) {
  const userId = getClerkUserIdFromSubscription(subscription);
  if (!userId) {
    console.log("[Subscription sync] no Clerk user id found");
    return;
  }

  const plan = getSubscriptionPlan(subscription?.status || "");
  await syncSubscriptionToClerkAndSupabase(userId, plan, {
    customerId: subscription?.customer || "",
    subscriptionId: subscription?.id || "",
    status: subscription?.status || plan
  });
}

async function handleSubscriptionInactive(subscription, status) {
  const userId = getClerkUserIdFromSubscription(subscription);
  if (!userId) {
    console.log("[Subscription sync] no Clerk user id found");
    return;
  }

  const plan = status === "past_due" || status === "unpaid" ? "past_due" : "free";
  await syncSubscriptionToClerkAndSupabase(userId, plan, {
    customerId: subscription.customer || "",
    subscriptionId: subscription.id || "",
    status
  });
}

async function handleInvoicePaymentFailed(invoice) {
  const userId = getClerkUserIdFromInvoice(invoice);
  if (!userId) {
    console.log("[Subscription sync] no Clerk user id found");
    return;
  }

  const subscription = invoice?.subscription;
  await syncSubscriptionToClerkAndSupabase(userId, "past_due", {
    customerId: invoice?.customer || "",
    subscriptionId: typeof subscription === "string" ? subscription : subscription?.id || "",
    status: "past_due"
  });
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
    if (event.type === "customer.subscription.updated") {
      await handleSubscriptionUpdated(event.data?.object);
    }
    if (event.type === "customer.subscription.deleted") {
      await handleSubscriptionInactive(event.data?.object, "canceled");
    }
    if (event.type === "invoice.payment_failed") {
      await handleInvoicePaymentFailed(event.data?.object);
    }

    sendOk(response, {
      received: true,
      handled: [
        "checkout.session.completed",
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "invoice.payment_failed"
      ].includes(event.type)
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
  getClerkUserIdFromInvoice,
  getClerkUserIdFromSubscription,
  getSubscriptionPlan,
  handleSubscriptionUpdated,
  verifyStripeSignature,
  getClerkUserIdFromSession
};
