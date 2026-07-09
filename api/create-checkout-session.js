const { sendError, sendOk } = require("./_responses");

const STRIPE_CHECKOUT_URL = "https://api.stripe.com/v1/checkout/sessions";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    return "";
  }
  return value;
}

function normalizeSiteUrl(value) {
  return value.replace(/\/+$/, "");
}

function parseBody(request) {
  if (!request.body) return {};
  if (typeof request.body === "object") return request.body;
  try {
    return JSON.parse(request.body);
  } catch {
    return null;
  }
}

function validateCheckoutRequest(body) {
  if (!body) return "Request body must be valid JSON.";
  if (typeof body.userId !== "string" || !body.userId.trim()) {
    return "Authenticated user id is required.";
  }
  if (body.email && typeof body.email !== "string") {
    return "User email must be a string.";
  }
  return "";
}

async function createStripeCheckoutSession(user) {
  const stripeSecretKey = requireEnv("STRIPE_SECRET_KEY");
  const priceId = requireEnv("STRIPE_PRO_PRICE_ID");
  const siteUrl = requireEnv("SITE_URL");

  if (!stripeSecretKey || !priceId || !siteUrl) {
    const missing = [
      !stripeSecretKey ? "STRIPE_SECRET_KEY" : "",
      !priceId ? "STRIPE_PRO_PRICE_ID" : "",
      !siteUrl ? "SITE_URL" : ""
    ].filter(Boolean);

    const error = new Error("Stripe checkout is not configured.");
    error.code = "missing_configuration";
    error.missing = missing;
    throw error;
  }

  const baseUrl = normalizeSiteUrl(siteUrl);
  const body = new URLSearchParams({
    mode: "subscription",
    success_url: `${baseUrl}?checkout=success`,
    cancel_url: `${baseUrl}?checkout=cancelled`,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    allow_promotion_codes: "true",
    client_reference_id: user.userId,
    "metadata[product]": "ResearchAI Pro",
    "metadata[clerk_user_id]": user.userId
  });

  if (user.email) {
    body.set("customer_email", user.email);
    body.set("metadata[email]", user.email);
  }

  const stripeResponse = await fetch(STRIPE_CHECKOUT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const payload = await stripeResponse.json().catch(() => null);

  if (!stripeResponse.ok) {
    const error = new Error("Stripe checkout could not be created.");
    error.code = "stripe_error";
    error.statusCode = stripeResponse.status;
    error.stripeType = payload?.error?.type || null;
    throw error;
  }

  if (!payload?.url) {
    const error = new Error("Stripe checkout response did not include a URL.");
    error.code = "invalid_stripe_response";
    throw error;
  }

  return payload.url;
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendError(response, 400, "method_not_allowed", "Use POST to create a checkout session.");
    return;
  }

  const body = parseBody(request);
  const validationError = validateCheckoutRequest(body);
  if (validationError) {
    sendError(response, 400, "invalid_request", validationError);
    return;
  }

  try {
    const url = await createStripeCheckoutSession({
      userId: body.userId.trim(),
      email: body.email ? body.email.trim() : ""
    });
    sendOk(response, { url });
  } catch (error) {
    if (error.code === "missing_configuration") {
      sendError(response, 500, "missing_configuration", "Stripe checkout is not configured yet.", {
        missing: error.missing
      });
      return;
    }

    if (error.statusCode === 401) {
      sendError(response, 401, "stripe_unauthorized", "Stripe checkout is not authorized.");
      return;
    }

    if (error.statusCode === 429) {
      sendError(response, 429, "stripe_rate_limited", "Stripe checkout is temporarily rate limited.");
      return;
    }

    sendError(response, 500, error.code || "checkout_failed", "Stripe checkout could not be started.");
  }
};
