const { getSubscriptionState } = require("./_billing-state");
const { getClerkUser, markUserFree, markUserPro } = require("./_auth");
const { verifyClerkRequest } = require("./_clerk-token");
const { sendError, sendOk } = require("./_responses");
const { rejectDisallowedOrigin } = require("./_security");
const { getUserByClerkId, updateUserPlan } = require("./_supabase");

const STRIPE_API_BASE = "https://api.stripe.com/v1";

function requireEnv(name) {
  return process.env[name] || "";
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

function getStripeSubscriptionIdFromClerk(user) {
  return (
    user?.private_metadata?.stripeSubscriptionId ||
    user?.private_metadata?.stripe_subscription_id ||
    user?.public_metadata?.stripeSubscriptionId ||
    user?.public_metadata?.stripe_subscription_id ||
    ""
  );
}

async function stripeRequest(path) {
  const stripeSecretKey = requireEnv("STRIPE_SECRET_KEY");
  if (!stripeSecretKey) {
    const error = new Error("Stripe is not configured.");
    error.code = "missing_configuration";
    throw error;
  }

  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`
    }
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error("Stripe request failed.");
    error.code = "stripe_error";
    error.statusCode = response.status;
    error.details = payload?.error?.type || null;
    throw error;
  }

  return payload;
}

async function resolveStripeBillingIds(userId) {
  const supabaseUser = await getUserByClerkId(userId).catch(error => {
    console.warn("[Billing sync] Supabase lookup unavailable", error.code || error.message);
    return null;
  });

  let customerId = supabaseUser?.stripe_customer_id || "";
  let subscriptionId = supabaseUser?.stripe_subscription_id || "";

  if (!customerId || !subscriptionId) {
    const clerkUser = await getClerkUser(userId);
    customerId = customerId || getStripeCustomerIdFromClerk(clerkUser);
    subscriptionId = subscriptionId || getStripeSubscriptionIdFromClerk(clerkUser);
  }

  return {
    customerId,
    subscriptionId
  };
}

function chooseNewestRelevantSubscription(subscriptions = []) {
  const relevant = subscriptions.filter(subscription =>
    ["active", "trialing", "past_due", "unpaid", "canceled", "incomplete_expired"].includes(subscription?.status)
  );
  const candidates = relevant.length ? relevant : subscriptions;
  return candidates.sort((a, b) => Number(b.created || 0) - Number(a.created || 0))[0] || null;
}

async function fetchLatestSubscription({ customerId, subscriptionId }) {
  if (subscriptionId) {
    return stripeRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
  }

  if (!customerId) {
    const error = new Error("Stripe customer id is missing.");
    error.code = "missing_customer";
    throw error;
  }

  const payload = await stripeRequest(
    `/subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=10`
  );
  const subscription = chooseNewestRelevantSubscription(Array.isArray(payload?.data) ? payload.data : []);
  if (!subscription) {
    const error = new Error("No Stripe subscription was found for this customer.");
    error.code = "missing_subscription";
    throw error;
  }
  return subscription;
}

async function syncBillingStatusForUser(userId) {
  const billingIds = await resolveStripeBillingIds(userId);
  const subscription = await fetchLatestSubscription(billingIds);
  const state = getSubscriptionState(subscription);

  console.log("[Billing sync] user id", userId);
  console.log("[Billing sync] stripe subscription id", subscription?.id || billingIds.subscriptionId || null);
  console.log("[Billing sync] status", subscription?.status || null);
  console.log("[Billing sync] cancel_at", subscription?.cancel_at || null);
  console.log("[Billing sync] cancel_at_period_end", Boolean(subscription?.cancel_at_period_end));
  console.log("[Billing sync] computed subscription_status", state.status);

  const subscriptionSync = {
    customerId: subscription?.customer || billingIds.customerId || "",
    subscriptionId: subscription?.id || billingIds.subscriptionId || "",
    status: state.status,
    cancelAtPeriodEnd: state.cancelAtPeriodEnd,
    currentPeriodEnd: state.currentPeriodEnd
  };

  if (state.plan === "pro") {
    await markUserPro(userId, subscriptionSync);
  } else {
    await markUserFree(userId, subscriptionSync);
  }

  const user = await updateUserPlan(userId, state.plan, subscriptionSync);
  console.log("[Billing sync] Supabase updated", {
    clerk_user_id: user?.clerk_user_id || null,
    plan: user?.plan || null,
    subscription_status: user?.subscription_status || null,
    cancel_at_period_end: Boolean(user?.cancel_at_period_end),
    current_period_end: user?.current_period_end || null
  });

  return {
    plan: state.plan,
    subscriptionStatus: state.status,
    cancelAtPeriodEnd: state.cancelAtPeriodEnd,
    currentPeriodEnd: state.currentPeriodEnd,
    stripeCustomerConnected: Boolean(subscriptionSync.customerId),
    stripeSubscriptionConnected: Boolean(subscriptionSync.subscriptionId)
  };
}

module.exports = async function handler(request, response) {
  if (rejectDisallowedOrigin(request, response, sendError)) return;

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendError(response, 400, "method_not_allowed", "Use POST to sync billing status.");
    return;
  }

  const clerkUser = await verifyClerkRequest(request);
  if (!clerkUser?.sub) {
    sendError(response, 401, "auth_required", "Sign in is required.");
    return;
  }

  try {
    const billing = await syncBillingStatusForUser(clerkUser.sub);
    sendOk(response, { billing });
  } catch (error) {
    if (error.code === "missing_configuration") {
      sendError(response, 500, "missing_configuration", "Stripe billing sync is not configured.");
      return;
    }

    if (error.code === "missing_customer" || error.code === "missing_subscription") {
      sendError(response, 404, error.code, "No active Stripe subscription could be found for this account.");
      return;
    }

    if (error.statusCode === 401) {
      sendError(response, 401, "stripe_unauthorized", "Stripe billing sync is not authorized.");
      return;
    }

    console.error("[Billing sync] failed", error.code || error.message);
    sendError(response, 500, error.code || "billing_sync_failed", "Billing status could not be refreshed.");
  }
};

module.exports._test = {
  chooseNewestRelevantSubscription,
  fetchLatestSubscription,
  getStripeCustomerIdFromClerk,
  getStripeSubscriptionIdFromClerk,
  resolveStripeBillingIds,
  syncBillingStatusForUser
};
