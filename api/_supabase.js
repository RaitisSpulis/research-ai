const FREE_REPORT_LIMIT = 5;

function requireSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !serviceRoleKey) {
    const error = new Error("Supabase is not configured.");
    error.code = "missing_supabase_configuration";
    throw error;
  }

  return { url, serviceRoleKey };
}

function getMonthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function isProMetadata(metadata) {
  return Boolean(
    metadata?.pro === true ||
    metadata?.plan === "pro" ||
    metadata?.subscriptionStatus === "active"
  );
}

function isProClerkUser(clerkUser) {
  return Boolean(
    isProMetadata(clerkUser?.publicMetadata) ||
    isProMetadata(clerkUser?.public_metadata) ||
    isProMetadata(clerkUser?.privateMetadata) ||
    isProMetadata(clerkUser?.private_metadata)
  );
}

async function supabaseRequest(path, options = {}) {
  const { url, serviceRoleKey } = requireSupabaseConfig();
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error("Supabase request failed.");
    error.code = "supabase_request_failed";
    error.statusCode = response.status;
    error.details = payload;
    throw error;
  }

  return payload;
}

async function upsertUser(clerkUser) {
  const userId = clerkUser?.sub || clerkUser?.id;
  if (!userId) {
    const error = new Error("Authenticated Clerk user id is required.");
    error.code = "missing_user_id";
    throw error;
  }

  const email = clerkUser?.email || clerkUser?.email_address || clerkUser?.primary_email_address || "";
  const metadataPro = isProClerkUser(clerkUser);
  const payload = {
    clerk_user_id: userId,
    email,
    updated_at: new Date().toISOString()
  };

  if (metadataPro) {
    payload.plan = "pro";
  }

  const [user] = await supabaseRequest("/rest/v1/users?on_conflict=clerk_user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([payload])
  });

  return user;
}

async function getUserByClerkId(userId) {
  if (!userId) return null;
  const rows = await supabaseRequest(
    `/rest/v1/users?clerk_user_id=eq.${encodeURIComponent(userId)}&select=*`
  );
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function updateUserPlan(userId, plan, subscription = {}) {
  if (!userId) {
    const error = new Error("Clerk user id is required.");
    error.code = "missing_user_id";
    throw error;
  }

  const payload = {
    clerk_user_id: userId,
    plan: plan || "free",
    updated_at: new Date().toISOString()
  };

  if (subscription.email) payload.email = subscription.email;
  if (subscription.customerId !== undefined) payload.stripe_customer_id = subscription.customerId || "";
  if (subscription.subscriptionId !== undefined) payload.stripe_subscription_id = subscription.subscriptionId || "";
  if (subscription.status !== undefined) payload.subscription_status = subscription.status || "";

  const [user] = await supabaseRequest("/rest/v1/users?on_conflict=clerk_user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([payload])
  });

  return user;
}

async function getUsage(userId, month = getMonthKey()) {
  const rows = await supabaseRequest(
    `/rest/v1/usage?user_id=eq.${encodeURIComponent(userId)}&month=eq.${encodeURIComponent(month)}&select=*`
  );
  return normalizeUsage(Array.isArray(rows) && rows[0] ? rows[0] : {
    user_id: userId,
    month,
    count: 0,
    monthly_limit: FREE_REPORT_LIMIT
  });
}

function normalizeUsage(usage) {
  const monthlyLimit = Number(usage?.monthly_limit || FREE_REPORT_LIMIT);
  return {
    ...usage,
    count: Number(usage?.count || 0),
    monthly_limit: monthlyLimit,
    limit: monthlyLimit
  };
}

async function assertUsageAvailable(userId, isPro, month = getMonthKey()) {
  const usage = await getUsage(userId, month);
  const count = Number(usage.count || 0);
  const monthlyLimit = Number(usage.monthly_limit || FREE_REPORT_LIMIT);

  if (!isPro && count >= monthlyLimit) {
    const error = new Error("Free monthly report limit reached.");
    error.code = "free_limit_reached";
    error.statusCode = 429;
    error.usage = normalizeUsage({ count, monthly_limit: monthlyLimit, month });
    throw error;
  }

  return normalizeUsage({ count, monthly_limit: monthlyLimit, month });
}

async function incrementUsage(userId, isPro, month = getMonthKey()) {
  const current = await getUsage(userId, month);
  const count = Number(current.count || 0);
  const monthlyLimit = Number(current.monthly_limit || FREE_REPORT_LIMIT);

  if (!isPro && count >= monthlyLimit) {
    const error = new Error("Free monthly report limit reached.");
    error.code = "free_limit_reached";
    error.statusCode = 429;
    error.usage = normalizeUsage({ count, monthly_limit: monthlyLimit, month });
    throw error;
  }

  const nextCount = count + 1;
  const payload = {
    user_id: userId,
    month,
    count: nextCount,
    monthly_limit: monthlyLimit,
    updated_at: new Date().toISOString()
  };

  const [row] = await supabaseRequest("/rest/v1/usage?on_conflict=user_id,month", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([payload])
  });

  return normalizeUsage({
    count: Number(row?.count || nextCount),
    monthly_limit: Number(row?.monthly_limit || monthlyLimit),
    month
  });
}

function normalizeReportForDatabase(report, userId) {
  const incomingId = String(report.id || `${Date.now()}`);
  const id = incomingId.startsWith(`${userId}:`) ? incomingId : `${userId}:${incomingId}`;
  const createdAt = report.createdAt || report.created_at || new Date().toISOString();

  return {
    id,
    user_id: userId,
    title: String(report.title || "ResearchAI Report").slice(0, 240),
    prompt: String(report.prompt || report.userPrompt || "").slice(0, 2000),
    report_type: String(report.reportType || report.intent || report.category || "general_research").slice(0, 120),
    pinned: Boolean(report.pinned || report.favorite),
    report_data: report,
    created_at: createdAt,
    updated_at: new Date().toISOString(),
    deleted_at: null
  };
}

function mapReportRow(row) {
  const data = row.report_data && typeof row.report_data === "object" ? row.report_data : {};
  return {
    ...data,
    id: row.id,
    title: row.title || data.title,
    prompt: row.prompt || data.prompt,
    reportType: row.report_type || data.reportType,
    createdAt: row.created_at || data.createdAt,
    pinned: Boolean(row.pinned),
    favorite: Boolean(row.pinned),
    contentHtml: ""
  };
}

async function listReports(userId) {
  const rows = await supabaseRequest(
    `/rest/v1/reports?user_id=eq.${encodeURIComponent(userId)}&deleted_at=is.null&select=*&order=pinned.desc,created_at.desc`
  );
  return Array.isArray(rows) ? rows.map(mapReportRow) : [];
}

async function saveReport(userId, report) {
  const row = normalizeReportForDatabase(report, userId);
  const [saved] = await supabaseRequest("/rest/v1/reports?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([row])
  });

  await supabaseRequest("/rest/v1/saved_reports?on_conflict=user_id,report_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{
      user_id: userId,
      report_id: row.id,
      saved_at: new Date().toISOString()
    }])
  });

  return mapReportRow(saved || row);
}

async function updateReportPin(userId, reportId, pinned) {
  const [row] = await supabaseRequest(
    `/rest/v1/reports?id=eq.${encodeURIComponent(reportId)}&user_id=eq.${encodeURIComponent(userId)}&deleted_at=is.null`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        pinned: Boolean(pinned),
        updated_at: new Date().toISOString()
      })
    }
  );
  return row ? mapReportRow(row) : null;
}

async function deleteReport(userId, reportId) {
  await supabaseRequest(
    `/rest/v1/reports?id=eq.${encodeURIComponent(reportId)}&user_id=eq.${encodeURIComponent(userId)}&deleted_at=is.null`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
  );
  return true;
}

module.exports = {
  FREE_REPORT_LIMIT,
  assertUsageAvailable,
  deleteReport,
  getMonthKey,
  getUserByClerkId,
  getUsage,
  incrementUsage,
  isProClerkUser,
  listReports,
  normalizeUsage,
  saveReport,
  updateReportPin,
  updateUserPlan,
  upsertUser
};
