const { sendError, sendOk } = require("./_responses");
const { verifyClerkRequest } = require("./_clerk-token");
const { getClerkUser } = require("./_auth");
const { rejectDisallowedOrigin } = require("./_security");
const { getUserByClerkId, isProClerkUser } = require("./_supabase");

const STRIPE_BILLING_PORTAL_URL = "https://api.stripe.com/v1/billing_portal/sessions";

function requireEnv(name) {
  return process.env[name] || "";
}

function normalizeSiteUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function getStripeCustomerIdFromClerk(user) {
  return (
    user?.private_metadata?.stripeCustomerId ||
    user?.private_metadata?.stripe_customer_id ||
    user?.public_metadata?.stripeCustomerId ||
    user?.public_metadata?.stripe_customer_id ||
    ""
  );
}

function isProSupabaseUser(user) {
  return user?.plan === "pro" || user?.subscription_status === "active" || user?.subscription_status === "trialing";
}

function hasManageableSubscriptionStatus(status) {
  return ["active", "trialing", "past_due", "unpaid"].includes(String(status || ""));
}

async function resolveBillingCustomer(clerkUser) {
  const userId = clerkUser?.sub;
  if (!userId) {
    const error = new Error("Authentication is required.");
    error.code = "auth_required";
    throw error;
  }

  let supabaseUser = null;
  try {
    supabaseUser = await getUserByClerkId(userId);
  } catch (error) {
    console.warn("[ResearchAI billing] Supabase customer lookup unavailable:", error.code || error.message);
  }
  let customerId = supabaseUser?.stripe_customer_id || "";
  let pro = isProClerkUser(clerkUser) || isProSupabaseUser(supabaseUser);
  let subscriptionStatus = supabaseUser?.subscription_status || "";

  if (!customerId) {
    const clerkApiUser = await getClerkUser(userId);
    customerId = getStripeCustomerIdFromClerk(clerkApiUser);
    pro = pro || isProClerkUser({
      publicMetadata: clerkApiUser?.public_metadata,
      privateMetadata: clerkApiUser?.private_metadata
    });
    subscriptionStatus = subscriptionStatus || clerkApiUser?.public_metadata?.subscriptionStatus || clerkApiUser?.private_metadata?.subscriptionStatus || "";
  }

  const canManageBilling = pro || hasManageableSubscriptionStatus(subscriptionStatus);

  if (!canManageBilling) {
    const error = new Error("Billing Portal is available for Pro subscribers.");
    error.code = "pro_required";
    throw error;
  }

  if (!customerId) {
    const error = new Error("Stripe customer was not found for this account.");
    error.code = "missing_customer";
    throw error;
  }

  return {
    customerId,
    subscriptionStatus
  };
}

async function createBillingPortalSession(customerId) {
  const stripeSecretKey = requireEnv("STRIPE_SECRET_KEY");
  const siteUrl = requireEnv("SITE_URL");

  if (!stripeSecretKey || !siteUrl) {
    const missing = [
      !stripeSecretKey ? "STRIPE_SECRET_KEY" : "",
      !siteUrl ? "SITE_URL" : ""
    ].filter(Boolean);
    const error = new Error("Stripe Billing Portal is not configured.");
    error.code = "missing_configuration";
    error.missing = missing;
    throw error;
  }

  const body = new URLSearchParams({
    customer: customerId,
    return_url: `${normalizeSiteUrl(siteUrl)}?billing=returned`
  });

  const stripeResponse = await fetch(STRIPE_BILLING_PORTAL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const payload = await stripeResponse.json().catch(() => null);

  if (!stripeResponse.ok) {
    const error = new Error("Stripe Billing Portal session could not be created.");
    error.code = "stripe_error";
    error.statusCode = stripeResponse.status;
    error.stripeType = payload?.error?.type || null;
    throw error;
  }

  if (!payload?.url) {
    const error = new Error("Stripe Billing Portal response did not include a URL.");
    error.code = "invalid_stripe_response";
    throw error;
  }

  return payload.url;
}

module.exports = async function handler(request, response) {
  if (rejectDisallowedOrigin(request, response, sendError)) return;

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendError(response, 400, "method_not_allowed", "Use POST to create a billing portal session.");
    return;
  }

  const clerkUser = await verifyClerkRequest(request);
  if (!clerkUser?.sub) {
    sendError(response, 401, "auth_required", "Sign in is required.");
    return;
  }

  try {
    const billingCustomer = await resolveBillingCustomer(clerkUser);
    const url = await createBillingPortalSession(billingCustomer.customerId);
    sendOk(response, {
      url,
      subscriptionStatus: billingCustomer.subscriptionStatus || null
    });
  } catch (error) {
    if (error.code === "pro_required") {
      sendError(response, 403, "pro_required", "Billing Portal is available for Pro subscribers.");
      return;
    }

    if (error.code === "missing_customer") {
      sendError(response, 404, "missing_customer", "No Stripe customer is connected to this account yet.");
      return;
    }

    if (error.code === "missing_configuration") {
      sendError(response, 500, "missing_configuration", "Stripe Billing Portal is not configured yet.", {
        missing: error.missing
      });
      return;
    }

    if (error.statusCode === 401) {
      sendError(response, 401, "stripe_unauthorized", "Stripe Billing Portal is not authorized.");
      return;
    }

    if (error.statusCode === 429) {
      sendError(response, 429, "stripe_rate_limited", "Stripe Billing Portal is temporarily rate limited.");
      return;
    }

    console.error("[ResearchAI billing] portal_failed:", error.code || error.message);
    sendError(response, 500, error.code || "billing_portal_failed", "Billing Portal could not be opened.");
  }
};

module.exports._test = {
  createBillingPortalSession,
  getStripeCustomerIdFromClerk,
  resolveBillingCustomer
};
