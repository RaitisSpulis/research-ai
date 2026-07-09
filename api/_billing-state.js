function unixTimestampToIso(value) {
  const seconds = Number(value || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

function isSubscriptionScheduledToCancel(subscription = {}) {
  return Boolean(
    subscription.cancel_at_period_end === true ||
    (subscription.cancel_at && (subscription.status === "active" || subscription.status === "trialing"))
  );
}

function getStripeTimestampWithPath(subscription = {}) {
  if (subscription.cancel_at) {
    return {
      value: subscription.cancel_at,
      path: "cancel_at"
    };
  }

  if (subscription.current_period_end) {
    return {
      value: subscription.current_period_end,
      path: "current_period_end"
    };
  }

  const item = Array.isArray(subscription.items?.data)
    ? subscription.items.data.find(entry => entry?.current_period_end)
    : null;

  if (item?.current_period_end) {
    return {
      value: item.current_period_end,
      path: "items.data[].current_period_end"
    };
  }

  if (subscription.current_period?.end) {
    return {
      value: subscription.current_period.end,
      path: "current_period.end"
    };
  }

  return {
    value: null,
    path: "none"
  };
}

function getSubscriptionTiming(subscription = {}) {
  const periodEnd = getStripeTimestampWithPath(subscription);
  return {
    cancelAtPeriodEnd: isSubscriptionScheduledToCancel(subscription),
    currentPeriodEnd: unixTimestampToIso(periodEnd.value),
    currentPeriodEndPath: periodEnd.path
  };
}

function getSubscriptionPlan(status) {
  if (status === "active" || status === "trialing") return "pro";
  if (status === "past_due" || status === "unpaid") return "past_due";
  return "free";
}

function getSubscriptionSyncStatus(subscription = {}) {
  if (isSubscriptionScheduledToCancel(subscription)) {
    return {
      plan: "pro",
      status: "cancelling"
    };
  }

  if (subscription?.status === "canceled" || subscription?.status === "incomplete_expired") {
    return {
      plan: "free",
      status: "canceled"
    };
  }

  const plan = getSubscriptionPlan(subscription?.status || "");
  return {
    plan,
    status: subscription?.status || plan
  };
}

function getSubscriptionState(subscription = {}) {
  const syncStatus = getSubscriptionSyncStatus(subscription);
  const timing = getSubscriptionTiming(subscription);
  return {
    plan: syncStatus.plan,
    status: syncStatus.status,
    cancelAtPeriodEnd: timing.cancelAtPeriodEnd,
    currentPeriodEnd: timing.currentPeriodEnd,
    currentPeriodEndPath: timing.currentPeriodEndPath
  };
}

module.exports = {
  getStripeTimestampWithPath,
  getSubscriptionPlan,
  getSubscriptionState,
  getSubscriptionSyncStatus,
  getSubscriptionTiming,
  isSubscriptionScheduledToCancel,
  unixTimestampToIso
};
