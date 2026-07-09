const CLERK_API_BASE = "https://api.clerk.com/v1";

function requireClerkSecret() {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) {
    const error = new Error("Clerk is not configured.");
    error.code = "missing_clerk_secret";
    throw error;
  }
  return key;
}

function isProMetadata(metadata) {
  return Boolean(
    metadata?.pro === true ||
    metadata?.plan === "pro" ||
    metadata?.subscriptionStatus === "active"
  );
}

async function clerkRequest(path, options = {}) {
  const response = await fetch(`${CLERK_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${requireClerkSecret()}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error("Clerk request failed.");
    error.code = "clerk_request_failed";
    error.statusCode = response.status;
    error.details = payload;
    throw error;
  }

  return payload;
}

async function getClerkUser(userId) {
  if (!userId) {
    const error = new Error("Clerk user id is required.");
    error.code = "missing_user_id";
    throw error;
  }
  return clerkRequest(`/users/${encodeURIComponent(userId)}`);
}

async function isUserPro(userId) {
  const user = await getClerkUser(userId);
  return Boolean(
    isProMetadata(user.public_metadata) ||
    isProMetadata(user.private_metadata)
  );
}

async function markUserPro(userId, subscription = {}) {
  if (!userId) {
    const error = new Error("Clerk user id is required.");
    error.code = "missing_user_id";
    throw error;
  }

  const activatedAt = new Date().toISOString();
  console.log("[Clerk] marking user Pro", userId);
  return clerkRequest(`/users/${encodeURIComponent(userId)}/metadata`, {
    method: "PATCH",
    body: JSON.stringify({
      public_metadata: {
        pro: true,
        plan: "pro",
        subscriptionStatus: "active",
        proActivatedAt: activatedAt
      },
      private_metadata: {
        pro: true,
        plan: "pro",
        subscriptionStatus: "active",
        proActivatedAt: activatedAt,
        stripeCustomerId: subscription.customerId || "",
        stripeSubscriptionId: subscription.subscriptionId || "",
        stripeCheckoutSessionId: subscription.checkoutSessionId || ""
      }
    })
  });
}

async function markUserFree(userId, subscription = {}) {
  if (!userId) {
    const error = new Error("Clerk user id is required.");
    error.code = "missing_user_id";
    throw error;
  }

  const updatedAt = new Date().toISOString();
  console.log("[Clerk] marking user Free", userId);
  return clerkRequest(`/users/${encodeURIComponent(userId)}/metadata`, {
    method: "PATCH",
    body: JSON.stringify({
      public_metadata: {
        pro: false,
        plan: "free",
        subscriptionStatus: subscription.status || "inactive",
        proDeactivatedAt: updatedAt
      },
      private_metadata: {
        pro: false,
        plan: "free",
        subscriptionStatus: subscription.status || "inactive",
        proDeactivatedAt: updatedAt,
        stripeCustomerId: subscription.customerId || "",
        stripeSubscriptionId: subscription.subscriptionId || ""
      }
    })
  });
}

module.exports = {
  getClerkUser,
  isUserPro,
  markUserFree,
  markUserPro
};
