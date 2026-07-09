/* ResearchAI - Frontend demo application */

const STORAGE_KEY = "researchai_reports_v1";
const USAGE_KEY = "researchai_usage_v1";
const FREE_LIMIT = 5;

function readImportMetaDev() {
  try {
    return Boolean(new Function("return import.meta.env && import.meta.env.DEV;")());
  } catch {
    return false;
  }
}

function isDeveloperMode() {
  const runtimeLocation = typeof location !== "undefined" ? location : globalThis.window?.location;
  const hostname = runtimeLocation?.hostname || "";
  const nodeEnv = typeof process !== "undefined" ? process.env?.NODE_ENV : "";

  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    readImportMetaDev() ||
    nodeEnv === "development"
  );
}

if (typeof module !== "undefined" && module.exports) {
  module.exports.isDeveloperMode = isDeveloperMode;
}

const researchAIConfig = {
  generationMode: "gemini",
  api: {
    generateEndpoint: "/api/generate",
    checkoutEndpoint: "/api/create-checkout-session",
    billingPortalEndpoint: "/api/create-billing-portal-session",
    publicConfigEndpoint: "/api/public-config",
    reportsEndpoint: "/api/reports",
    usageEndpoint: "/api/usage",
    timeoutMs: 30000
  },
  providers: {
    demo: {},
    gemini: {
      // TODO: Add Gemini model and endpoint configuration when backend/API support exists.
      apiKey: null
    },
    openrouter: {
      // TODO: Add OpenRouter model and endpoint configuration when backend/API support exists.
      apiKey: null
    }
  }
};

const views = {
  dashboard: document.getElementById("dashboardView"),
  loading: document.getElementById("loadingView"),
  report: document.getElementById("reportView")
};

const els = {
  researchInput: document.getElementById("researchInput"),
  researchForm: document.getElementById("researchForm"),
  inputError: document.getElementById("inputError"),
  loadingPrompt: document.getElementById("loadingPrompt"),
  progressBar: document.getElementById("progressBar"),
  progressValue: document.getElementById("progressValue"),
  progressLabel: document.getElementById("progressLabel"),
  progressTrack: document.getElementById("progressTrack"),
  loadingSteps: [...document.querySelectorAll(".loading-step")],
  cancelLoading: document.getElementById("cancelLoading"),
  reportContent: document.getElementById("reportContent"),
  reportEmpty: document.getElementById("reportEmpty"),
  reportLayout: document.getElementById("reportLayout"),
  reportTopTitle: document.getElementById("reportTopTitle"),
  reportMeta: document.getElementById("reportMeta"),
  treeNav: document.getElementById("treeNav"),
  metricConfidence: document.getElementById("metricConfidence"),
  metricDepth: document.getElementById("metricDepth"),
  recentReportsList: document.getElementById("recentReportsList"),
  recentEmpty: document.getElementById("recentEmpty"),
  continueCard: document.getElementById("continueCard"),
  continueText: document.getElementById("continueText"),
  continueBtn: document.getElementById("continueBtn"),
  previewTitle: document.getElementById("previewTitle"),
  previewScore: document.getElementById("previewScore"),
  previewMarket: document.getElementById("previewMarket"),
  previewCompetitors: document.getElementById("previewCompetitors"),
  previewDemand: document.getElementById("previewDemand"),
  previewWindow: document.getElementById("previewWindow"),
  usageTitle: document.getElementById("usageTitle"),
  usageText: document.getElementById("usageText"),
  usageBar: document.getElementById("usageBar"),
  usageFill: document.getElementById("usageFill"),
  devModeBadge: document.getElementById("devModeBadge"),
  authStatus: document.getElementById("authStatus"),
  authMeta: document.getElementById("authMeta"),
  signInBtn: document.getElementById("signInBtn"),
  signUpBtn: document.getElementById("signUpBtn"),
  signOutBtn: document.getElementById("signOutBtn"),
  topicCloud: document.getElementById("topicCloud"),
  refreshTopics: document.getElementById("refreshTopics"),
  toast: document.getElementById("toast"),
  panelOverlay: document.getElementById("panelOverlay"),
  panelTitle: document.getElementById("panelTitle"),
  panelBody: document.getElementById("panelBody"),
  panelClose: document.getElementById("panelClose"),
  favoriteReport: document.getElementById("favoriteReport"),
  mobileMenuBtn: document.getElementById("mobileMenuBtn"),
  sidebarBackdrop: document.getElementById("sidebarBackdrop"),
  appSidebar: document.getElementById("appSidebar"),
  openReportBtn: document.getElementById("openReportBtn"),
  startFreeBtn: document.getElementById("startFreeBtn"),
  proCheckoutBtn: document.getElementById("proCheckoutBtn"),
  copyReport: document.getElementById("copyReport"),
  shareReport: document.getElementById("shareReport"),
  exportPdf: document.getElementById("exportPdf"),
  exportDocx: document.getElementById("exportDocx"),
  exportMarkdown: document.getElementById("exportMarkdown"),
  continueResearch: document.getElementById("continueResearch"),
  collapseTree: document.getElementById("collapseTree"),
  researchTree: document.getElementById("researchTree")
};

/** Safely attach an event listener when the element exists. */
function on(element, event, handler) {
  if (element) element.addEventListener(event, handler);
}

async function fetchPublicConfig() {
  try {
    const response = await fetch(researchAIConfig.api.publicConfigEndpoint, {
      method: "GET",
      headers: { Accept: "application/json" }
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok === false) return {};
    return payload || {};
  } catch (error) {
    console.warn("[ResearchAI] public config unavailable:", error);
    return {};
  }
}

async function getClerkSessionToken() {
  return await authState.clerk?.session?.getToken?.();
}

async function authenticatedApi(endpoint, options = {}) {
  const token = await getClerkSessionToken();
  if (!token) {
    const error = new Error("Authentication session is not ready.");
    error.code = "unauthorized";
    throw error;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok === false) {
    const error = new Error(payload?.error?.message || "Request failed.");
    error.code = payload?.error?.code || "request_failed";
    error.status = response.status;
    error.details = payload?.error?.details || null;
    throw error;
  }

  return payload || {};
}

function getPrimaryEmail(user) {
  return (
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    ""
  );
}

function userHasProMetadata(user) {
  const metadata = user?.publicMetadata || user?.public_metadata || {};
  return Boolean(
    metadata.pro === true ||
    metadata.plan === "pro" ||
    metadata.subscriptionStatus === "active"
  );
}

function isProUser() {
  return authState.signedIn && authState.isPro;
}

function updateAuthStateFromClerk() {
  const clerk = authState.clerk;
  const user = clerk?.user || null;
  const wasSignedIn = authState.signedIn;
  authState.ready = Boolean(clerk);
  authState.signedIn = Boolean(user);
  authState.isPro = userHasProMetadata(user);
  authState.userId = user?.id || "";
  authState.email = getPrimaryEmail(user);
  if (!authState.signedIn) {
    serverUsageState = null;
    billingState = {
      plan: "free",
      subscriptionStatus: null,
      stripeCustomerConnected: false
    };
  } else if (authState.isPro && billingState.plan !== "pro") {
    billingState = {
      ...billingState,
      plan: "pro",
      subscriptionStatus: billingState.subscriptionStatus || "active"
    };
  }
  updateAuthUI();
  updateUsageUI();
  if (authState.signedIn && (!wasSignedIn || !workspaceSyncPromise)) {
    syncWorkspaceFromServer();
  }
  console.log("[ResearchAI] Pro status", authState.isPro);
}

function updateAuthUI() {
  const accountCard = els.authStatus?.closest(".auth-card");
  accountCard?.classList.toggle("is-signed-in", authState.signedIn);

  if (!authState.configured) {
    if (els.authStatus) els.authStatus.textContent = "Account unavailable";
    if (els.authMeta) els.authMeta.textContent = "Clerk is not configured yet.";
    if (els.signInBtn) els.signInBtn.disabled = true;
    if (els.signUpBtn) els.signUpBtn.disabled = true;
    if (els.signOutBtn) els.signOutBtn.hidden = true;
    return;
  }

  if (authState.signedIn) {
    if (els.authStatus) els.authStatus.textContent = authState.isPro ? "Pro account" : "Free account";
    if (els.authMeta) els.authMeta.textContent = authState.email || authState.userId || "Authenticated account";
    if (els.signInBtn) els.signInBtn.hidden = true;
    if (els.signUpBtn) els.signUpBtn.hidden = true;
    if (els.signOutBtn) {
      els.signOutBtn.hidden = false;
      els.signOutBtn.disabled = false;
    }
    return;
  }

  if (els.authStatus) els.authStatus.textContent = "Signed out";
  if (els.authMeta) els.authMeta.textContent = "Sign in before upgrading to Pro.";
  if (els.signInBtn) {
    els.signInBtn.hidden = false;
    els.signInBtn.disabled = !authState.ready;
  }
  if (els.signUpBtn) {
    els.signUpBtn.hidden = false;
    els.signUpBtn.disabled = !authState.ready;
  }
  if (els.signOutBtn) els.signOutBtn.hidden = true;
}

function updateProUpgradeUI() {
  if (!els.proCheckoutBtn) return;
  els.proCheckoutBtn.hidden = isProUser();
  if (!isProUser()) {
    els.proCheckoutBtn.textContent = "Upgrade to Pro";
  }
}

function deriveClerkFrontendApi(publishableKey) {
  try {
    return atob(publishableKey.split("_")[2]).slice(0, -1);
  } catch {
    return "";
  }
}

function loadScriptOnce(src, attributes = {}) {
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${src}"]`);
    if (existingScript) {
      resolve(existingScript);
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    Object.entries(attributes).forEach(([key, value]) => {
      script.setAttribute(key, value);
    });
    script.addEventListener("load", () => resolve(script), { once: true });
    script.addEventListener("error", () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

async function loadClerkWithPublishableKey(publishableKey) {
  const clerkDomain = deriveClerkFrontendApi(publishableKey);
  if (!clerkDomain) {
    throw new Error("Clerk publishable key could not derive Frontend API domain.");
  }

  await loadScriptOnce(`https://${clerkDomain}/npm/@clerk/ui@1/dist/ui.browser.js`);
  await loadScriptOnce(`https://${clerkDomain}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`, {
    "data-clerk-publishable-key": publishableKey
  });

  if (!window.Clerk) {
    throw new Error("ClerkJS did not load.");
  }

  await window.Clerk.load({
    ui: { ClerkUI: window.__internal_ClerkUICtor }
  });

  return window.Clerk;
}

async function initAuth() {
  if (authInitPromise) return authInitPromise;
  authInitPromise = initAuthOnce();
  return authInitPromise;
}

async function initAuthOnce() {
  authState.ready = false;
  authState.configured = false;
  updateAuthUI();

  const config = await fetchPublicConfig().catch(error => {
    console.warn("[ResearchAI] public config unavailable:", error);
    return {};
  });
  const publishableKey = (config.clerkPublishableKey || "").trim();

  console.log("[ResearchAI] Clerk public config loaded", Boolean(publishableKey));

  authState.configured = Boolean(publishableKey);
  updateAuthUI();

  if (!publishableKey) {
    console.log("[ResearchAI] Clerk loaded", false);
    return;
  }

  try {
    console.log("[ResearchAI] Clerk key prefix", publishableKey.slice(0, 8));
    const clerk = await loadClerkWithPublishableKey(publishableKey);

    authState.clerk = clerk;
    authState.ready = true;
    console.log("[ResearchAI] Clerk loaded", true);

    if (typeof clerk.addListener === "function") {
      clerk.addListener(updateAuthStateFromClerk);
    }

    updateAuthStateFromClerk();
  } catch (error) {
    console.error("[ResearchAI] Clerk initialization failed:", error);
    authState.ready = false;
    console.log("[ResearchAI] Clerk loaded", false);
    updateAuthUI();
  }
}

function openSignIn() {
  if (!authState.configured) {
    showToast("Sign in is not configured yet.", "warn");
    return;
  }
  if (!authState.clerk?.openSignIn) {
    showToast("Sign in is still loading. Please try again.", "info");
    return;
  }
  authState.clerk.openSignIn();
}

function openSignUp() {
  if (!authState.configured) {
    showToast("Sign up is not configured yet.", "warn");
    return;
  }
  if (!authState.clerk?.openSignUp) {
    showToast("Sign up is still loading. Please try again.", "info");
    return;
  }
  authState.clerk.openSignUp();
}

async function signOut() {
  if (!authState.clerk?.signOut) return;
  await authState.clerk.signOut();
  updateAuthStateFromClerk();
  showToast("Signed out");
}

let currentPrompt = "";
let currentReport = null;
let continuePrompt = "";
let loadingInterval = null;
let toastTimer = null;
let authInitPromise = null;
let serverUsageState = null;
let billingState = {
  plan: "free",
  subscriptionStatus: null,
  stripeCustomerConnected: false
};
let workspaceSyncPromise = null;
const authState = {
  ready: false,
  configured: false,
  signedIn: false,
  isPro: false,
  userId: "",
  email: "",
  clerk: null
};

const placeholders = [
  "Research the market for AI legal assistants...",
  "Create a business plan for a premium coffee shop...",
  "Analyze competitors for a fitness SaaS...",
  "Build an investment thesis for an AI company...",
  "Should I buy an apartment or keep renting-",
  "Create a 90-day plan to learn AI product building..."
];

const topicPool = [
  "Startup Validation", "Business Plans", "Market Sizing", "Competitor Research",
  "Investment Thesis", "Product Strategy", "Real Estate", "Travel Planning",
  "Healthcare Tech", "Climate Tech", "EdTech", "Fintech", "Supply Chain",
  "Consumer Trends", "Regulatory Landscape", "Pricing Strategy", "Go-to-Market"
];

const loadingLabels = [
  "Understanding request...",
  "Selecting report structure...",
  "Preparing assumptions...",
  "Organizing sections...",
  "Building report...",
  "Labeling assumptions...",
  "Writing next actions...",
  "Preparing visual report..."
];

/* -- Utilities -- */

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seeded(seed, min, max) {
  const range = max - min + 1;
  return min + (hashCode(String(seed)) % range);
}

function pick(arr, seed) {
  return arr[seed % arr.length];
}

function formatMoney(billions) {
  if (billions >= 1) return `$${billions.toFixed(1)}B`;
  return `$${Math.round(billions * 1000)}M`;
}

function titleFromPrompt(prompt) {
  const clean = prompt.trim().replace(/[?.!]+$/, "");
  if (!clean) return "Professional Research Report";
  const capped = clean.charAt(0).toUpperCase() + clean.slice(1);
  return capped.length > 72 ? `${capped.slice(0, 72)}...` : capped;
}

function initials(title) {
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return title.slice(0, 2).toUpperCase();
}

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

function escapeHtml(text) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(text).replace(/[&<>"']/g, ch => map[ch]);
}

/* -- Storage -- */

function getReports() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? sortReports(data.map(normalizeReport)) : [];
  } catch {
    return [];
  }
}

function saveReports(reports) {
  const sorted = sortReports(reports.map(normalizeReport));
  localStorage.setItem(STORAGE_KEY, JSON.stringify((isDeveloperMode() || isProUser()) ? sorted : sorted.slice(0, 50)));
}

function cacheServerReports(reports) {
  if (!Array.isArray(reports)) return;
  saveReports(reports);
}

function applyServerUsage(usage) {
  if (!usage || typeof usage !== "object") return;
  serverUsageState = {
    count: Number(usage.count || 0),
    monthly_limit: Number(usage.monthly_limit || FREE_LIMIT),
    month: usage.month || ""
  };
  updateUsageUI();
}

function applyBillingState(billing) {
  if (!billing || typeof billing !== "object") return;
  billingState = {
    plan: billing.plan || (authState.isPro ? "pro" : "free"),
    subscriptionStatus: billing.subscriptionStatus || billing.subscription_status || null,
    stripeCustomerConnected: Boolean(billing.stripeCustomerConnected || billing.stripe_customer_id)
  };
  if (billingState.plan === "pro" || billingState.subscriptionStatus === "active" || billingState.subscriptionStatus === "trialing") {
    authState.isPro = true;
  }
  updateAuthUI();
  updateUsageUI();
}

async function syncWorkspaceFromServer() {
  if (!authState.signedIn || isDeveloperMode()) return;

  workspaceSyncPromise = authenticatedApi(researchAIConfig.api.reportsEndpoint)
    .then(payload => {
      if (Array.isArray(payload.reports)) {
        cacheServerReports(payload.reports);
        renderRecentReports();
      }
      applyServerUsage(payload.usage);
      return payload;
    })
    .catch(error => {
      console.warn("[ResearchAI] workspace sync unavailable:", error);
      return null;
    });

  return workspaceSyncPromise;
}

async function refreshServerUsage() {
  if (!authState.signedIn || isDeveloperMode()) return null;
  try {
    const payload = await authenticatedApi(researchAIConfig.api.usageEndpoint);
    applyServerUsage(payload.usage);
    applyBillingState(payload.billing);
    return payload.usage || null;
  } catch (error) {
    console.warn("[ResearchAI] usage sync unavailable:", error);
    return null;
  }
}

function normalizeReport(report) {
  const prompt = report.prompt || "";
  const fallback = (Array.isArray(report.sections) || Array.isArray(report.findings) || !prompt)
    ? {}
    : analyzePrompt(prompt);

  return {
    ...fallback,
    ...report,
    id: String(report.id || hashCode(`${prompt || report.title || "report"}${report.createdAt || Date.now()}`)),
    title: report.title || titleFromPrompt(prompt || "Professional Research Report"),
    prompt,
    reportType: report.reportType || report.intent || report.category || "general_research",
    createdAt: report.createdAt || new Date().toISOString(),
    contentHtml: "",
    pinned: Boolean(report.pinned || report.favorite),
    favorite: Boolean(report.pinned || report.favorite)
  };
}

function sortReports(reports) {
  return [...reports].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function getUsage() {
  if (isDeveloperMode() || isProUser()) return 0;
  if (authState.signedIn && serverUsageState) return Number(serverUsageState.count || 0);

  try {
    const data = JSON.parse(localStorage.getItem(USAGE_KEY));
    const now = new Date();
    const month = `${now.getFullYear()}-${now.getMonth()}`;
    if (data && data.month === month) return data.count;
    return 0;
  } catch {
    return 0;
  }
}

function incrementUsage() {
  if (isDeveloperMode() || isProUser()) {
    updateUsageUI();
    return 0;
  }

  if (authState.signedIn) {
    refreshServerUsage();
    return getUsage();
  }

  const now = new Date();
  const month = `${now.getFullYear()}-${now.getMonth()}`;
  const count = getUsage() + 1;
  localStorage.setItem(USAGE_KEY, JSON.stringify({ month, count }));
  updateUsageUI();
  return count;
}

function updateUsageUI() {
  if (!els.usageText || !els.usageBar || !els.usageFill) return;
  const devMode = isDeveloperMode();
  const proMode = isProUser();

  if (els.usageTitle) els.usageTitle.textContent = devMode ? "Developer Mode" : proMode ? "Pro Workspace" : "Free Workspace";
  if (els.devModeBadge) {
    els.devModeBadge.hidden = !devMode;
    els.devModeBadge.textContent = "DEV Unlimited";
  }
  els.usageBar.hidden = devMode || proMode;
  els.usageBar.closest(".usage-card")?.classList.toggle("is-dev", devMode);
  els.usageBar.closest(".usage-card")?.classList.toggle("is-pro", proMode);
  updateProUpgradeUI();

  if (devMode || proMode) {
    els.usageText.textContent = "Unlimited reports";
    els.usageBar.setAttribute("aria-valuenow", "0");
    els.usageFill.style.width = "0%";
    return;
  }

  const used = getUsage();
  const monthlyLimit = Number(serverUsageState?.monthly_limit || FREE_LIMIT);
  els.usageText.textContent = `${used} of ${monthlyLimit} reports used this month`;
  els.usageBar.setAttribute("aria-valuenow", String(used));
  els.usageFill.style.width = `${Math.min(100, (used / monthlyLimit) * 100)}%`;
}

/* -- Prompt analysis -- */

function detectCategory(prompt) {
  const p = prompt.toLowerCase();
  if (/learn|roadmap|skill|course|education|study|90-day|90 day/.test(p)) return "learning";
  if (/compare|versus| vs |competitor|competition|rival|alternative/.test(p)) return "competitive";
  if (/invest|stock|valuation|thesis|equity|portfolio/.test(p)) return "investment";
  if (/coffee|restaurant|cafe|shop|retail|store/.test(p)) return "retail";
  if (/apartment|house|real estate|rent|mortgage|property|buy a home/.test(p)) return "realestate";
  if (/market|tam|sam|sizing|segment/.test(p)) return "market";
  if (/saas|startup|business plan|validate|launch|agency|build|start/.test(p)) return "startup";
  if (/health|wellness|fitness|medical/.test(p)) return "health";
  if (/travel|tourism|destination/.test(p)) return "travel";
  return "general";
}

function detectReportIntent(prompt) {
  const p = prompt.toLowerCase();
  if (/learn|roadmap|skill|course|study|90-day|90 day|practice/.test(p)) return "learning_plan";
  if (/compare|versus| vs |competitor comparison|stripe|paypal|alternative/.test(p)) return "competitor_comparison";
  if (/investment thesis|invest|stock|valuation|portfolio|equity/.test(p)) return "investment_thesis";
  if (/business plan|financial plan|go-to-market|go to market/.test(p)) return "business_plan";
  if (/market analysis|market size|market sizing|analyze the market|market for|tam|sam|segment/.test(p)) return "market_analysis";
  if (/product strategy|positioning|roadmap|feature|pricing strategy/.test(p)) return "product_strategy";
  if (/validate|should i build|should i start|startup idea|launch|start an|start a|build an|build a/.test(p)) return "startup_validation";
  return "general_research";
}

function detectIndustrySignal(prompt) {
  const p = prompt.toLowerCase();
  if (/coffee|cafe|restaurant|menu|foot traffic|hospitality/.test(p)) return "coffee_shop";
  if (/finance|fintech|payment|stripe|paypal|banking|investment/.test(p)) return "finance";
  if (/saas|software|subscription|mvp|workflow/.test(p)) return "saas";
  if (/automation agency|ai automation|agency/.test(p)) return "ai_automation";
  if (/b2b|consulting|service|agency|small business/.test(p)) return "b2b_service";
  if (/ecommerce|e-commerce|shopify|online store|marketplace/.test(p)) return "ecommerce";
  if (/education|course|learning|student|curriculum|product design/.test(p)) return "education";
  if (/health|healthcare|medical|wellness|fitness/.test(p)) return "healthcare";
  if (/real estate|apartment|property|rent|mortgage/.test(p)) return "real_estate";
  if (/local|riga|latvia|neighborhood|city/.test(p)) return "local_business";
  if (/consumer app|mobile app|b2c|social app/.test(p)) return "consumer_app";
  if (/ai|llm|machine learning|automation/.test(p)) return "ai_automation";
  return "general";
}

function extractTopic(prompt) {
  return prompt
    .replace(/^should i\s+(build|start|create|launch|invest in|buy|choose)\s+/i, "")
    .replace(/^(create|analyze|research|build|estimate|validate|compare|start|launch)\s+(an|a|the|whether|if)?\s*/i, "")
    .replace(/^(business plan|product strategy|investment thesis)\s+for\s+/i, "")
    .replace(/^market\s+for\s+/i, "")
    .replace(/^whether\s+to\s+/i, "")
    .replace(/^to\s+/i, "")
    .replace(/[?.!]+$/, "")
    .trim() || "this opportunity";
}

function analyzePrompt(prompt) {
  const seed = hashCode(prompt);
  const category = detectCategory(prompt);
  const intent = detectReportIntent(prompt);
  const industry = detectIndustrySignal(prompt);
  const topic = extractTopic(prompt);
  const title = titleFromPrompt(prompt);
  const confidence = seeded(`${seed}c`, 78, 94);
  const marketB = seeded(`${seed}m`, 8, 420) / 100;
  const competitorCount = seeded(`${seed}co`, 6, 22);
  const signals = seeded(`${seed}s`, 10, 18);
  const months = seeded(`${seed}w`, 4, 14);
  const demandLevels = ["Moderate", "Strong", "Very Strong", "High"];
  const demand = pick(demandLevels, seed);

  const barSets = {
    startup: [
      ["Market demand", seeded(`${seed}b1`, 72, 94)],
      ["Willingness to pay", seeded(`${seed}b2`, 58, 86)],
      ["Execution difficulty", seeded(`${seed}b3`, 48, 78)],
      ["Moat potential", seeded(`${seed}b4`, 55, 82)]
    ],
    market: [
      ["TAM growth", seeded(`${seed}b1`, 70, 92)],
      ["Competitive intensity", seeded(`${seed}b2`, 45, 75)],
      ["Entry barriers", seeded(`${seed}b3`, 40, 70)],
      ["Timing advantage", seeded(`${seed}b4`, 60, 88)]
    ],
    default: [
      ["Opportunity score", seeded(`${seed}b1`, 68, 90)],
      ["Risk-adjusted return", seeded(`${seed}b2`, 55, 82)],
      ["Implementation effort", seeded(`${seed}b3`, 42, 72)],
      ["Strategic fit", seeded(`${seed}b4`, 58, 88)]
    ]
  };

  const segmentBars = [
    ["Primary segment", seeded(`${seed}p1`, 78, 95)],
    ["Secondary segment", seeded(`${seed}p2`, 62, 88)],
    ["Enterprise buyers", seeded(`${seed}p3`, 48, 82)],
    ["Early adopters", seeded(`${seed}p4`, 70, 92)]
  ];

  const categoryContent = getCategoryContent(category, topic, seed);
  const dynamicContent = getDynamicReportContent({ prompt, topic, seed, category, intent, industry });

  const report = {
    prompt,
    title,
    topic,
    category,
    intent,
    industry,
    confidence,
    marketSize: formatMoney(marketB),
    competitorCount,
    signals,
    launchWindow: `${months} mo`,
    demand,
    bars: barSets[category === "market" ? "market" : category === "startup" ? "startup" : "default"],
    segmentBars,
    ...categoryContent,
    ...dynamicContent
  };

  report.sections = buildDynamicSections(report);
  report.finalRecommendation = getFinalRecommendation(report);
  return report;
}

/* -- AI request, prompt, and response architecture -- */

class AIProviderError extends Error {
  constructor(type, message, details) {
    super(message);
    this.name = type;
    this.type = type;
    this.details = details || null;
  }
}

class ProviderUnavailable extends AIProviderError {
  constructor(message, details) {
    super("ProviderUnavailable", message || "Provider unavailable.", details);
  }
}

class InvalidConfiguration extends AIProviderError {
  constructor(message, details) {
    super("InvalidConfiguration", message || "Invalid provider configuration.", details);
  }
}

class RateLimited extends AIProviderError {
  constructor(message, details) {
    super("RateLimited", message || "Provider rate limit reached.", details);
  }
}

class FreeLimitReached extends AIProviderError {
  constructor(message, details) {
    super("FreeLimitReached", message || "Free report limit reached.", details);
  }
}

class DatabaseError extends AIProviderError {
  constructor(message, details) {
    super("DatabaseError", message || "Database request failed.", details);
  }
}

class Unauthorized extends AIProviderError {
  constructor(message, details) {
    super("Unauthorized", message || "Provider authorization failed.", details);
  }
}

class InvalidResponse extends AIProviderError {
  constructor(message, details) {
    super("InvalidResponse", message || "Provider returned an invalid response.", details);
  }
}

class NetworkError extends AIProviderError {
  constructor(message, details) {
    super("NetworkError", message || "Network request failed.", details);
  }
}

class Timeout extends AIProviderError {
  constructor(message, details) {
    super("Timeout", message || "Provider request timed out.", details);
  }
}

class UnknownError extends AIProviderError {
  constructor(message, details) {
    super("UnknownError", message || "Unknown generation error.", details);
  }
}

const generationErrorMessages = {
  ProviderUnavailable: "Live AI is temporarily unavailable. A local sample report can still be created.",
  InvalidConfiguration: "Report generation is not configured correctly. A local sample report can still be created.",
  RateLimited: "The AI provider is busy. Please wait a minute and try again.",
  FreeLimitReached: "You used your 5 free reports this month. Upgrade to Pro for unlimited reports.",
  DatabaseError: "ResearchAI could not read your report usage. Please try again.",
  Unauthorized: "Sign in is required to generate reports.",
  InvalidResponse: "ResearchAI could not read the provider response. Please try again.",
  NetworkError: "ResearchAI could not reach the report provider. Please check your connection and try again.",
  Timeout: "The report provider took too long to respond. Please try again.",
  UnknownError: "ResearchAI could not generate the report. Please try again."
};

function createAIRequest(userPrompt, mode = researchAIConfig.generationMode) {
  const prompt = userPrompt.trim();
  const intent = detectReportIntent(prompt);
  const industry = detectIndustrySignal(prompt);

  return {
    userPrompt: prompt,
    intent,
    industry,
    reportType: intent,
    mode,
    metadata: {
      category: detectCategory(prompt),
      topic: extractTopic(prompt),
      source: "ResearchAI frontend",
      apiEndpoint: researchAIConfig.api.generateEndpoint
    },
    createdAt: new Date().toISOString()
  };
}

function buildResearchPrompt(request) {
  return [
    "Create a professional research report.",
    `User prompt: ${request.userPrompt}`,
    `Intent: ${request.intent}`,
    `Industry: ${request.industry}`,
    "Return structured report data compatible with the ResearchAI report schema.",
    "Separate facts, assumptions, estimates, source guidance, risks, and recommendations."
  ].join("\n");
}

function buildStartupPrompt(request) {
  return `${buildResearchPrompt(request)}\nFocus on startup validation, ICP, willingness to pay, MVP scope, risks, and next experiments.`;
}

function buildBusinessPlanPrompt(request) {
  return `${buildResearchPrompt(request)}\nFocus on operating model, go-to-market, unit economics, cost structure, milestones, and launch plan.`;
}

function buildComparisonPrompt(request) {
  return `${buildResearchPrompt(request)}\nFocus on decision criteria, alternatives, trade-offs, switching costs, risks, and recommendation logic.`;
}

function buildLearningPrompt(request) {
  return `${buildResearchPrompt(request)}\nFocus on milestones, weekly practice, projects, feedback loops, assessment, and visible skill progress.`;
}

function buildInvestmentPrompt(request) {
  return `${buildResearchPrompt(request)}\nFocus on thesis, catalysts, risks, financial logic, evidence gaps, and non-advisory limitations.`;
}

function buildGeneralPrompt(request) {
  return `${buildResearchPrompt(request)}\nFocus on decision clarity, useful structure, assumptions, source categories, and practical next actions.`;
}

function buildPromptForRequest(request) {
  const builders = {
    startup_validation: buildStartupPrompt,
    business_plan: buildBusinessPlanPrompt,
    competitor_comparison: buildComparisonPrompt,
    learning_plan: buildLearningPrompt,
    investment_thesis: buildInvestmentPrompt,
    market_analysis: buildResearchPrompt,
    product_strategy: buildResearchPrompt,
    general_research: buildGeneralPrompt
  };
  return (builders[request.reportType] || buildGeneralPrompt)(request);
}

function htmlFromAiText(text) {
  return escapeHtml(text)
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join("<br><br>");
}

function stripJsonFence(text) {
  return String(text)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function tryParseJsonReport(text) {
  const clean = stripJsonFence(text);
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(clean.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function normalizeAiSection(section, index) {
  if (!section || typeof section !== "object") return null;
  const title = section.title || `Section ${index + 1}`;
  return {
    id: section.id || slugifyId(title),
    title,
    purpose: section.purpose || "Analysis section",
    layoutType: section.layoutType || section.layout || "paragraphs",
    paragraphs: Array.isArray(section.paragraphs) ? section.paragraphs : undefined,
    items: Array.isArray(section.items) ? section.items : undefined,
    headers: Array.isArray(section.table?.headers) ? section.table.headers : section.headers,
    rows: Array.isArray(section.table?.rows) ? section.table.rows : section.rows,
    scenarios: Array.isArray(section.scenarios) ? section.scenarios : undefined,
    recommendations: Array.isArray(section.recommendations) ? section.recommendations : undefined,
    steps: Array.isArray(section.steps) ? section.steps : undefined,
    scorecards: Array.isArray(section.scorecards) ? section.scorecards : undefined,
    contrarian: section.contrarian && typeof section.contrarian === "object" ? section.contrarian : undefined,
    finalRecommendation: section.finalRecommendation
  };
}

function normalizeAiJsonReport(json, request, providerResponse) {
  if (!json || typeof json !== "object" || !Array.isArray(json.sections)) return null;
  const base = analyzePrompt(request.userPrompt);
  const sections = json.sections.map(normalizeAiSection).filter(Boolean);
  if (!sections.length) return null;

  const final = json.finalRecommendation || base.finalRecommendation || getFinalRecommendation(base);
  const evidence = Array.isArray(json.evidenceToVerify) ? json.evidenceToVerify : [];
  const limitations = Array.isArray(json.limitations) ? json.limitations : [];

  if (evidence.length && !sections.some(section => /evidence/i.test(section.title))) {
    sections.push(makeSection("Evidence To Verify", "Exact evidence to collect before acting.", "evidence", { items: evidence }));
  }

  if (final && !sections.some(section => /final recommendation/i.test(section.title))) {
    sections.push(makeSection("Final Recommendation", "Close with a decision.", "final", { finalRecommendation: final }));
  }

  return {
    ...base,
    title: json.reportTitle || base.title,
    reportType: json.reportType || request.reportType,
    mode: request.mode,
    provider: providerResponse.provider || request.mode,
    model: providerResponse.model || "",
    createdAt: providerResponse.createdAt || new Date().toISOString(),
    sections,
    finalRecommendation: final,
    limitations: limitations.length ? limitations.map(item => Array.isArray(item) ? item : ["Limitation", String(item)]) : base.limitations
  };
}

function mergeAiTextIntoReport(providerResponse, request) {
  const base = analyzePrompt(request.userPrompt);
  const aiText = String(providerResponse.text || providerResponse.content || "").trim();
  if (!aiText) {
    throw new InvalidResponse("AI provider response did not include report text.");
  }

  const jsonReport = normalizeAiJsonReport(tryParseJsonReport(aiText), request, providerResponse);
  if (jsonReport) return jsonReport;

  return {
    ...base,
    mode: request.mode,
    provider: providerResponse.provider || request.mode,
    model: providerResponse.model || "",
    createdAt: providerResponse.createdAt || new Date().toISOString(),
    executive: htmlFromAiText(aiText),
    thesis: "Live AI draft generated from the prompt. Treat it as a structured first draft and verify material claims with source review.",
    sources: [
      ["Recommended source review", "Verify the live draft against primary sources, official documents, market reports, and customer evidence."],
      ["Citation status", "This AI Mode draft does not yet include verified citations in the report renderer."],
      ["Trust safeguards", "ResearchAI keeps assumptions and source guidance visible until connected source verification is active."]
    ],
    limitations: [
      ["Live AI draft", "This report used the Gemini backend route, but source verification is not active yet."],
      ["Needs evidence review", "Use the recommendations and source guidance as a starting point before making material decisions."],
      ["Saved locally", "The report is saved in this browser workspace."]
    ]
  };
}

function parseProviderResponse(providerResponse, request) {
  if (!providerResponse || typeof providerResponse !== "object") {
    throw new InvalidResponse("Provider response must be a report data object.");
  }

  if (providerResponse.prompt && providerResponse.title && Array.isArray(providerResponse.findings)) {
    return providerResponse;
  }

  if (providerResponse.text || providerResponse.content) {
    return mergeAiTextIntoReport(providerResponse, request);
  }

  throw new InvalidResponse("Provider response is not compatible with the current report schema.");
}

function normalizeProviderError(error) {
  if (error instanceof AIProviderError) return error;
  if (error?.code === "free_limit_reached") return new FreeLimitReached(error.message, error);
  if (error?.code === "provider_rate_limited" || error?.code === "rate_limited") return new RateLimited(error.message, error);
  if (error?.code === "provider_unavailable") return new ProviderUnavailable(error.message, error);
  if (error?.code === "database_error") return new DatabaseError(error.message, error);
  if (error?.code === "auth_required" || error?.code === "unauthorized") return new Unauthorized(error.message, error);
  if (error?.code === "internal_error") return new UnknownError(error.message, error);
  if (error?.name === "AbortError") return new Timeout(error.message, error);
  if (/network|fetch/i.test(error?.message || "")) return new NetworkError(error.message, error);
  return new UnknownError(error?.message, error);
}

function providerErrorFromApi(error, status) {
  const code = error?.code || "";
  const message = error?.message || "Report provider failed.";

  if (code === "free_limit_reached") return new FreeLimitReached(message, error);
  if (code === "provider_rate_limited" || code === "rate_limited") return new RateLimited(message, error);
  if (code === "provider_unavailable") return new ProviderUnavailable(message, error);
  if (code === "database_error") return new DatabaseError(message, error);
  if (status === 401 || code === "auth_required" || code === "unauthorized") return new Unauthorized(message, error);
  if (status === 429) return new RateLimited(message, error);
  if (code === "timeout") return new Timeout(message, error);
  if (code === "invalid_response") return new InvalidResponse(message, error);
  if (code === "invalid_request" || code === "invalid_provider") return new InvalidConfiguration(message, error);
  if (code === "internal_error") return new UnknownError(message, error);
  return new UnknownError(message, error);
}

class ReportProvider {
  constructor(config = {}) {
    this.config = config;
  }

  async generate() {
    throw new ProviderUnavailable("Provider has not implemented report generation.");
  }

  createPreview(request) {
    return analyzePrompt(request.userPrompt);
  }
}

class DemoProvider extends ReportProvider {
  async generate(request) {
    return analyzePrompt(request.userPrompt);
  }
}

class GeminiProvider extends ReportProvider {
  async generate(request) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs || 30000);

    try {
      const token = await getClerkSessionToken();
      const headers = { "Content-Type": "application/json" };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(this.config.generateEndpoint, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify(request)
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        throw providerErrorFromApi(payload?.error, response.status);
      }

      if (!payload?.report) {
        throw new InvalidResponse("AI response did not include a report.");
      }

      if (payload.usageCounted) {
        payload.report._usageCounted = true;
      }
      if (payload.usage) {
        payload.report._serverUsage = payload.usage;
        applyServerUsage(payload.usage);
      }

      return payload.report;
    } catch (err) {
      throw normalizeProviderError(err);
    } finally {
      clearTimeout(timeout);
    }
  }
}

class OpenRouterProvider extends ReportProvider {
  async generate() {
    // TODO: Implement OpenRouter through the Vercel API provider layer. No browser API keys.
    throw new ProviderUnavailable("OpenRouterProvider is a placeholder.");
  }
}

class AIService {
  constructor(config) {
    this.config = config;
    this.providers = {
      demo: new DemoProvider(config.providers.demo),
      gemini: new GeminiProvider({ ...config.providers.gemini, ...config.api }),
      openrouter: new OpenRouterProvider(config.providers.openrouter)
    };
  }

  getProvider(mode = this.config.generationMode) {
    const provider = this.providers[mode];
    if (!provider) {
      throw new InvalidConfiguration(`Unknown generation mode: ${mode}`);
    }
    return provider;
  }

  createRequest(prompt, mode = this.config.generationMode) {
    return createAIRequest(prompt, mode);
  }

  async generate(request) {
    try {
      const provider = this.getProvider(request.mode);
      const rawResponse = await provider.generate(request);
      return parseProviderResponse(rawResponse, request);
    } catch (err) {
      const normalized = normalizeProviderError(err);
      if (["FreeLimitReached", "DatabaseError", "RateLimited", "Unauthorized"].includes(normalized.type)) {
        throw normalized;
      }
      if (request.mode !== "demo") {
        const demoRequest = { ...request, mode: "demo" };
        const demoReport = parseProviderResponse(await this.providers.demo.generate(demoRequest), demoRequest);
        demoReport.aiFallback = true;
        demoReport.fallbackReason = normalized.type;
        demoReport.provider = "demo";
        demoReport.mode = "demo";
        return demoReport;
      }
      throw normalized;
    }
  }

  createPreview(prompt) {
    const request = this.createRequest(prompt);
    try {
      return this.getProvider(request.mode).createPreview(request);
    } catch {
      return new DemoProvider(this.config.providers.demo).createPreview(request);
    }
  }
}

class ReportController {
  constructor(aiService) {
    this.aiService = aiService;
  }

  createPreview(prompt) {
    return this.aiService.createPreview(prompt);
  }

  buildRequest(prompt) {
    return this.aiService.createRequest(prompt);
  }

  buildPrompt(request) {
    return buildPromptForRequest(request);
  }

  async generateReport(prompt) {
    const request = this.buildRequest(prompt);
    request.metadata.promptPreview = this.buildPrompt(request);
    return await this.aiService.generate(request);
  }

  async generateAndSaveReport(prompt) {
    return saveReport(await this.generateReport(prompt));
  }
}

const aiService = new AIService(researchAIConfig);
const reportController = new ReportController(aiService);

function getGenerationErrorMessage(error) {
  const normalized = normalizeProviderError(error);
  return generationErrorMessages[normalized.type] || generationErrorMessages.UnknownError;
}

function handleGenerationError(error) {
  console.error("[ResearchAI] report generation failed:", error);
  showToast(getGenerationErrorMessage(error), "warn");
  showView("dashboard");
}

function getCategoryContent(category, topic, seed) {
  const templates = {
    startup: {
      executive: `Based on analysis of <strong>${escapeHtml(topic)}</strong>, the opportunity shows meaningful potential in a growing market. Early signals suggest strong demand from professionals seeking structured intelligence over generic AI chat. Success depends on clear positioning, clear source expectations, and a workflow that delivers finished deliverables - not open-ended conversations.`,
      thesis: "Vertical AI workspaces that produce finished reports will capture premium willingness-to-pay.",
      customer: "Founders, operators, and consultants who need decision-ready artifacts weekly.",
      monetization: "Potential paid plan with richer exports, templates, and team libraries at $29-99/mo.",
      findings: [
        ["Demand signal", `Users evaluating ${topic} usually need actionable reports instead of raw search results.`],
        ["Market gap", "Existing tools fragment research across chat, search, and documents."],
        ["Retention driver", "Saved reports, templates, and follow-up research create repeat usage."]
      ],
      competitors: [
        ["AI Chatbots", "Open-ended text", "No structured deliverable", "Own the report workflow"],
        ["Search Tools", "Links and snippets", "Manual synthesis required", "End-to-end intelligence"],
        ["Notion / Docs", "Blank canvas", "User builds structure", "Auto-generated report system"]
      ],
      risks: [
        ["Accuracy risk", "Must clearly separate facts, assumptions, and estimates."],
        ["Trust barrier", "Source visibility and clearly labeled assumptions are essential."],
        ["Commoditization", "Workflow depth and saved context become the moat."]
      ],
      financial: [
        ["Year 1 ARR potential", `$${seeded(`${seed}f1`, 120, 890)}K with 500 Pro subscribers`],
        ["CAC estimate", `$${seeded(`${seed}f2`, 28, 85)} blended across content and product-led growth`],
        ["Gross margin", `${seeded(`${seed}f3`, 72, 88)}% at scale with export and template upsells`]
      ],
      actions: [
        ["Validate core workflow", "Run 20 user tests: question -> report -> export -> share."],
        ["Build trust layer", "Add source cards, assumption labels, and clear estimate notes."],
        ["Prepare Pro tier", "Validate which exports and limits users would pay for."],
        ["Expand templates", "Ship 12 vertical templates for founders, analysts, and students."]
      ],
      sources: [
        ["Recommended source types", "Industry reports, analyst research, and vertical market databases."],
        ["Competitor references", "Pricing pages, product docs, and customer review platforms."],
        ["Public records", "SEC filings, press releases, and analyst coverage where applicable."]
      ]
    },
    realestate: {
      executive: `This analysis evaluates <strong>${escapeHtml(topic)}</strong> using a decision framework that weighs cash flow, opportunity cost, market timing, and personal financial stability. Current market conditions suggest a nuanced outcome - neither universally favorable nor clearly unfavorable without localized data.`,
      thesis: "The buy-vs-rent decision hinges on hold period, local price-to-rent ratios, and liquidity needs.",
      customer: "Individual buyers weighing long-term wealth building against flexibility.",
      monetization: "Premium decision reports with scenario modeling and negotiation playbooks.",
      findings: [
        ["Price-to-rent", "In many metros, ratios remain above historical averages - favoring careful timing."],
        ["Interest rates", "Higher rates increase monthly costs but may reduce competition."],
        ["Opportunity cost", "Down payment capital may outperform in alternative investments over 5-7 years."]
      ],
      competitors: [
        ["Real estate agents", "Local expertise", "Commission bias", "Unbiased financial framing"],
        ["Mortgage calculators", "Payment estimates", "No strategic context", "Full decision report"],
        ["Zillow / Redfin", "Listings data", "Limited personalized analysis", "Custom scenario modeling"]
      ],
      risks: [
        ["Market correction", "Local downturns can erase short-term equity gains."],
        ["Liquidity lock-in", "Transaction costs make short hold periods expensive."],
        ["Maintenance surprise", "Budget 1-2% of property value annually for upkeep."]
      ],
      financial: [
        ["Break-even horizon", `${seeded(`${seed}f1`, 4, 9)} years in a typical metro scenario`],
        ["Monthly cost delta", `$${seeded(`${seed}f2`, 200, 1200)} vs comparable rent (estimate)`],
        ["Equity build (5yr)", `$${seeded(`${seed}f3`, 40, 180)}K projected principal accumulation`]
      ],
      actions: [
        ["Run local comps", "Compare 10 similar units sold vs rented in target neighborhood."],
        ["Model 3 scenarios", "Base, optimistic, and stress cases over 5 and 10 years."],
        ["Get pre-approval", "Lock rate expectations and clarify true buying power."],
        ["Negotiate terms", "Use inspection findings and days-on-market for leverage."]
      ],
      sources: [
        ["MLS data", "Local comparable sales and rental listings."],
        ["Federal Reserve", "Mortgage rate trends and economic indicators."],
        ["Census / BLS", "Income, employment, and demographic trends by region."]
      ]
    },
    investment: {
      executive: `This analysis of <strong>${escapeHtml(topic)}</strong> outlines a balanced investment view. Catalysts include product momentum and market expansion, while risks center on valuation, competition, and macro sensitivity. This report is a structured framework - not financial advice.`,
      thesis: "Quality compounders with durable moats outperform when bought with margin of safety.",
      customer: "Individual investors and analysts building structured theses.",
      monetization: "Premium research exports and portfolio scenario tools.",
      findings: [
        ["Revenue quality", "Recurring revenue and net retention are primary quality signals."],
        ["Valuation context", "Current multiples vs historical ranges would inform entry timing once live source review is active."],
        ["Catalyst map", "Product launches, margin expansion, and capital allocation drive re-rating."]
      ],
      competitors: [
        ["Bloomberg / FactSet", "Deep data", "High cost, steep learning curve", "Accessible structured reports"],
        ["Seeking Alpha", "Crowdsourced opinions", "Variable quality", "Consistent report format"],
        ["ChatGPT", "Quick summaries", "No citations or structure", "Professional deliverable"]
      ],
      risks: [
        ["Valuation risk", "Premium multiples compress sharply in risk-off environments."],
        ["Competitive disruption", "New entrants can erode pricing power within 18-24 months."],
        ["Regulatory exposure", "Policy changes may impact growth assumptions materially."]
      ],
      financial: [
        ["Implied upside", `${seeded(`${seed}f1`, 12, 45)}% in base case over 12-18 months`],
        ["Downside scenario", `${seeded(`${seed}f2`, 15, 35)}% drawdown in bear case`],
        ["Target margin", `${seeded(`${seed}f3`, 18, 42)}% operating margin at maturity`]
      ],
      actions: [
        ["Build thesis doc", "One-page bull/base/bear with explicit assumptions."],
        ["Track 5 KPIs", "Define metrics that would confirm or invalidate the thesis."],
        ["Set position size", "Size based on conviction and downside tolerance."],
        ["Schedule review", "Re-evaluate quarterly or on material news events."]
      ],
      sources: [
        ["Suggested filing sources", "10-K, 10-Q, and proxy filings where applicable."],
        ["Suggested transcript sources", "Management commentary and Q&A transcripts where applicable."],
        ["Suggested analyst sources", "Sell-side and independent equity research reports where applicable."]
      ]
    },
    learning: {
      executive: `This roadmap for <strong>${escapeHtml(topic)}</strong> provides a structured 90-day path from fundamentals to applied projects. The plan balances theory, hands-on building, and portfolio artifacts that demonstrate capability to employers or investors.`,
      thesis: "Learning AI effectively requires project-based progression with measurable milestones.",
      customer: "Career switchers, founders, and students building AI product skills.",
      monetization: "Premium roadmaps with mentor reviews and project templates.",
      findings: [
        ["Skill stack", "Python, ML fundamentals, prompt engineering, and product thinking are core."],
        ["Portfolio signal", "3 shipped projects outweigh 10 completed courses for hiring."],
        ["Time allocation", "60% building, 25% learning, 15% community and networking optimal."]
      ],
      competitors: [
        ["Coursera / Udemy", "Structured courses", "Passive consumption", "Execution-focused roadmap"],
        ["Bootcamps", "Intensive programs", "High cost, fixed schedule", "Self-paced with milestones"],
        ["YouTube", "Free content", "No progression path", "Curated sequence with projects"]
      ],
      risks: [
        ["Tool churn", "Frameworks change rapidly - focus on fundamentals over hype."],
        ["Shallow learning", "Tutorial hell without shipping leads to false confidence."],
        ["Burnout", "Aggressive timelines without rest reduce retention."]
      ],
      financial: [
        ["Learning budget", `$${seeded(`${seed}f1`, 0, 500)} for courses, APIs, and tools`],
        ["Opportunity cost", `${seeded(`${seed}f2`, 8, 20)} hrs/week recommended minimum`],
        ["Salary uplift", `${seeded(`${seed}f3`, 15, 45)}% potential increase within 12 months`]
      ],
      actions: [
        ["Week 1-4: Foundations", "Python, statistics, and ML basics with daily coding."],
        ["Week 5-8: Build", "Ship 2 small AI projects with real users or proof-of-work examples."],
        ["Week 9-12: Specialize", "Pick one vertical (RAG, agents, or fine-tuning) and go deep."],
        ["Publish portfolio", "Write case studies for each project on GitHub and LinkedIn."]
      ],
      sources: [
        ["Fast.ai / Andrew Ng", "Foundational ML and deep learning courses."],
        ["Papers With Code", "State-of-the-art benchmarks and implementations."],
        ["Hugging Face", "Models, datasets, and community best practices."]
      ]
    },
    retail: {
      executive: `Opening <strong>${escapeHtml(topic)}</strong> requires careful unit economics modeling. Location, foot traffic, labor costs, and differentiation strategy determine whether this venture achieves sustainable margins in a competitive local market.`,
      thesis: "Premium positioning with strong unit economics beats discount competition in urban markets.",
      customer: "First-time operators and experienced restaurateurs evaluating new concepts.",
      monetization: "Full business plan reports with financial models and launch checklists.",
      findings: [
        ["Location premium", "Rent should not exceed 8-10% of projected revenue."],
        ["Labor model", "Staffing costs typically run 28-35% of revenue in specialty retail."],
        ["Differentiation", "Experience, quality, and community drive repeat visits over price alone."]
      ],
      competitors: [
        ["Chain franchises", "Brand recognition", "High fees, less control", "Independent premium concept"],
        ["Local independents", "Community loyalty", "Inconsistent quality", "Operational excellence"],
        ["Delivery-only brands", "Lower overhead", "No physical experience", "Third-place destination"]
      ],
      risks: [
        ["Cash runway", "Most locations need 6-9 months to reach break-even."],
        ["Seasonality", "Revenue swings of 20-40% are common in many markets."],
        ["Supply chain", "Coffee and specialty inputs face price volatility."]
      ],
      financial: [
        ["Startup capital", `$${seeded(`${seed}f1`, 180, 450)}K all-in for fit-out and working capital`],
        ["Monthly break-even", `$${seeded(`${seed}f2`, 28, 65)}K revenue at target margin`],
        ["Year 2 margin", `${seeded(`${seed}f3`, 12, 22)}% net margin at maturity`]
      ],
      actions: [
        ["Site selection", "Analyze 5 locations with foot traffic and demographic data."],
        ["Build financial model", "3-year P&L with conservative, base, and optimistic cases."],
        ["Soft launch", "Pop-up or limited hours to test menu and operations."],
        ["Grand opening", "Local partnerships, loyalty program, and review generation plan."]
      ],
      sources: [
        ["SCORE / SBA", "Small business planning resources and benchmarks."],
        ["Trade associations", "Industry reports on coffee and specialty retail."],
        ["Local economic data", "Census, foot traffic analytics, and commercial lease comps."]
      ]
    }
  };

  const base = templates[category] || templates.startup;
  return {
    executive: base.executive,
    thesis: base.thesis,
    customer: base.customer,
    monetization: base.monetization,
    findings: base.findings,
    competitors: base.competitors,
    risks: base.risks,
    financial: base.financial,
    actions: base.actions,
    sources: base.sources,
    advantages: [
      ["Clear outcome", `Structured analysis of ${topic} in one deliverable.`],
      ["Speed advantage", "Hours of research compressed into minutes."],
      ["Decision framework", "Explicit assumptions, risks, and next steps."]
    ],
    disadvantages: [
      ["Data limitations", "Illustrative estimates should be verified with primary sources before material decisions."],
      ["Local variance", "Market conditions vary significantly by geography."],
      ["Execution risk", "Analysis quality depends on input specificity."]
    ]
  };
}

function industryLabel(industry) {
  const labels = {
    saas: "SaaS",
    coffee_shop: "restaurant / coffee shop",
    ai_automation: "AI automation",
    ecommerce: "ecommerce",
    education: "education",
    finance: "finance",
    healthcare: "healthcare",
    real_estate: "real estate",
    local_business: "local business",
    consumer_app: "consumer app",
    b2b_service: "B2B service",
    general: "general research"
  };
  return labels[industry] || labels.general;
}

function intentLabel(intent) {
  const labels = {
    startup_validation: "startup validation",
    business_plan: "business plan",
    market_analysis: "market analysis",
    competitor_comparison: "competitor comparison",
    product_strategy: "product strategy",
    learning_plan: "learning plan",
    investment_thesis: "investment thesis",
    general_research: "general research"
  };
  return labels[intent] || labels.general_research;
}

function getIndustryProfile(industry, topic) {
  const profiles = {
    saas: {
      customer: "Founder or operator validating a repeatable SaaS workflow for a defined ICP.",
      thesis: "A SaaS opportunity is strongest when one painful workflow, one buyer, and one measurable outcome are clear before building.",
      monetization: "Start with a narrow subscription or usage-based offer tied to a single high-value workflow.",
      findings: [
        ["Workflow pain", "The strongest signal is repeated manual work that teams already budget time or money to solve."],
        ["ICP clarity", "Early validation should focus on one buyer segment before expanding features."],
        ["Willingness to pay", "Pricing tests should happen before a full product build, not after launch."]
      ],
      risks: [
        ["Feature spread", "Building for too many use cases early can dilute the product and slow validation."],
        ["Weak distribution", "A useful SaaS product still fails if the buyer channel is unclear."],
        ["Low switching urgency", "Teams may like the idea but delay purchase unless the workflow cost is obvious."]
      ],
      actions: [
        ["Define the ICP", "Write a one-page profile of the buyer, trigger event, current workaround, and budget owner."],
        ["Validate the workflow", "Interview 10 target users and map the exact steps they want removed or simplified."],
        ["Test willingness to pay", "Present a simple paid offer before building the full product."],
        ["Build one-use-case MVP", "Ship the smallest workflow that produces a measurable business outcome."]
      ],
      sources: [
        ["SaaS pricing pages", "Review pricing tiers, packaging, limits, and upgrade paths for adjacent tools."],
        ["Review sites", "Use G2, Capterra, Product Hunt, and forums to identify complaints and unmet needs."],
        ["Product documentation", "Study onboarding flows, integrations, APIs, and workflow depth from existing products."]
      ],
      competitors: [
        ["Vertical SaaS tools", "Focused workflows", "Narrow scope", "Win with sharper workflow execution"],
        ["Horizontal platforms", "Broad feature sets", "Complex adoption", "Win with speed and clarity"],
        ["Manual services", "Human expertise", "Hard to scale", "Productize the repeated workflow"]
      ]
    },
    coffee_shop: {
      customer: "Local customers who need a convenient, repeatable reason to visit beyond one-time novelty.",
      thesis: "A coffee shop works when location demand, menu economics, staffing, and repeat purchase behavior align.",
      monetization: "Revenue depends on daily transaction volume, average order value, gross margin, and repeat visits.",
      findings: [
        ["Location demand", "Foot traffic, nearby offices, transit, and residential density matter more than broad market size."],
        ["Menu economics", "A few high-margin repeatable items should carry the model before expanding the menu."],
        ["Repeat purchase", "The concept needs a habitual reason to return, not just a strong opening week."]
      ],
      risks: [
        ["Rent pressure", "A premium location can erase margins if revenue assumptions are too optimistic."],
        ["Labor coverage", "Staffing gaps quickly damage service consistency and customer experience."],
        ["Seasonality", "Demand may shift sharply by weather, tourism, work patterns, and local events."]
      ],
      actions: [
        ["Validate location demand", "Observe target streets at morning, lunch, and weekend periods before signing a lease."],
        ["Estimate daily foot traffic", "Build conservative, base, and optimistic transaction scenarios."],
        ["Model menu economics", "Calculate gross margin for core drinks, food items, and bundles."],
        ["Test repeat purchase", "Run a pop-up or preorder test to measure return visits and price sensitivity."]
      ],
      sources: [
        ["Foot traffic data", "Use local observation, mobility data, nearby anchors, and transit patterns."],
        ["Rent comparables", "Compare lease rates, service charges, and fit-out costs in target areas."],
        ["Competitor menus", "Review nearby menus, pricing, reviews, opening hours, and delivery platform demand."]
      ],
      competitors: [
        ["Local cafes", "Neighborhood familiarity", "Inconsistent positioning", "Win with service and repeatable quality"],
        ["Chains", "Operational consistency", "Less local character", "Win with local identity"],
        ["Delivery platforms", "Convenience", "Lower experience value", "Win with in-person ritual"]
      ]
    },
    ai_automation: {
      customer: "Small businesses or teams with repetitive admin, sales, support, reporting, or operations work.",
      thesis: "AI automation is viable when the service solves a painful workflow with clear before-and-after time savings.",
      monetization: "Start with paid audits, workflow implementation packages, and recurring maintenance retainers.",
      findings: [
        ["Workflow specificity", "Generic automation messaging is weak; named workflows create stronger buyer interest."],
        ["Trust barrier", "Clients need simple explanations, human oversight, and clear failure handling."],
        ["Service packaging", "A productized offer is easier to sell than open-ended consulting."]
      ],
      risks: [
        ["Overpromising automation", "Unclear scope can create disappointment when edge cases require human review."],
        ["Client data sensitivity", "Small businesses may hesitate unless privacy and access controls are explained."],
        ["Low repeatability", "Custom projects can become hard to scale without reusable templates."]
      ],
      actions: [
        ["Pick one vertical", "Choose a narrow segment such as clinics, agencies, accountants, or local services."],
        ["Audit five workflows", "Document time spent, tools used, failure points, and measurable savings."],
        ["Sell a pilot package", "Offer a fixed-scope implementation with clear deliverables and support limits."],
        ["Create reusable playbooks", "Turn each successful pilot into a repeatable template and checklist."]
      ],
      sources: [
        ["Workflow interviews", "Collect current-process screenshots, time estimates, and tool stacks from target clients."],
        ["Automation tool docs", "Review Zapier, Make, CRM, helpdesk, spreadsheet, and AI provider documentation."],
        ["Local business directories", "Identify reachable segments and common operational patterns."]
      ],
      competitors: [
        ["Freelance automators", "Flexible delivery", "Variable quality", "Win with packaged outcomes"],
        ["No-code agencies", "Implementation speed", "Broad positioning", "Win with vertical specialization"],
        ["Internal staff", "Context knowledge", "Limited automation expertise", "Win with measurable time savings"]
      ]
    },
    education: {
      customer: "Learners who need a structured path, practice projects, feedback loops, and visible progress.",
      thesis: "A learning plan succeeds when it converts broad ambition into weekly milestones and portfolio evidence.",
      monetization: "Value comes from structured roadmaps, project feedback, accountability, and curated resources.",
      findings: [
        ["Milestone clarity", "Weekly outcomes prevent the plan from becoming passive content consumption."],
        ["Practice projects", "Portfolio artifacts are stronger proof of skill than completed lessons alone."],
        ["Feedback loop", "Learners improve faster when work is reviewed against clear criteria."]
      ],
      risks: [
        ["Passive learning", "Watching courses without projects creates weak retention and false progress."],
        ["Scope overload", "Too many resources can reduce completion and confidence."],
        ["No assessment", "Without benchmarks, learners cannot tell whether skill is improving."]
      ],
      actions: [
        ["Define weekly milestones", "Set one measurable outcome for each week of the 90-day plan."],
        ["Choose practice projects", "Build three projects that demonstrate the target skill in realistic situations."],
        ["Measure skill progress", "Use rubrics, peer feedback, and before/after portfolio reviews."],
        ["Schedule review cycles", "Reserve weekly time to revise work instead of only adding new material."]
      ],
      sources: [
        ["Curriculum sources", "Compare syllabi, course outlines, and respected reading lists."],
        ["Benchmark projects", "Study portfolios, case studies, and hiring tasks in the target field."],
        ["Community feedback", "Use critique groups, mentors, forums, or professional communities for review."]
      ],
      competitors: [
        ["Online courses", "Structured content", "Limited feedback", "Win with project execution"],
        ["Bootcamps", "Accountability", "High cost", "Win with flexible milestones"],
        ["Self-study", "Low cost", "No structure", "Win with clear progression"]
      ]
    },
    finance: {
      customer: "Founders, operators, or analysts choosing payment, finance, or investment tools under uncertainty.",
      thesis: "Finance decisions should compare cost, risk, integration effort, support, compliance, and switching friction.",
      monetization: "Value comes from reducing decision risk and clarifying trade-offs before committing to a provider.",
      findings: [
        ["Cost structure", "Fees, minimums, chargebacks, and international costs can change the real economics."],
        ["Integration depth", "Developer experience and ecosystem maturity often matter as much as headline pricing."],
        ["Risk profile", "Compliance, availability, support, and dispute handling should be evaluated early."]
      ],
      risks: [
        ["Hidden fees", "A cheaper headline rate can become expensive after volume, disputes, or currency needs."],
        ["Migration friction", "Changing providers later may require engineering work and customer communication."],
        ["Regulatory exposure", "Payment and finance workflows require careful compliance review."]
      ],
      actions: [
        ["Map transaction needs", "List currencies, geographies, billing models, refunds, disputes, and payout timing."],
        ["Compare integration effort", "Review API docs, SDKs, test mode, webhooks, and implementation examples."],
        ["Run a cost scenario", "Model fees across realistic monthly volume and edge cases."],
        ["Validate support risk", "Check incident history, support channels, and user complaints."]
      ],
      sources: [
        ["Pricing pages", "Compare public fees, limits, add-ons, and regional terms."],
        ["Developer documentation", "Review API coverage, SDK quality, webhook handling, and examples."],
        ["User reviews and status pages", "Check reliability, support, disputes, and outage history."]
      ],
      competitors: [
        ["Stripe", "Developer-first payments", "Can become complex at scale", "Strong for SaaS billing and APIs"],
        ["PayPal", "Broad consumer trust", "Developer experience varies", "Strong for familiar checkout"],
        ["Local providers", "Regional fit", "Narrower ecosystem", "Strong when local payment methods matter"]
      ]
    },
    ecommerce: {
      customer: "Online buyers who need a clear product promise, trustworthy purchase experience, and reliable fulfillment.",
      thesis: "An ecommerce opportunity is strongest when the product category has repeatable demand, defensible acquisition, and healthy contribution margin.",
      monetization: "Revenue depends on average order value, gross margin, repeat purchase, paid acquisition efficiency, and fulfillment reliability.",
      findings: [
        ["Demand concentration", "The best early signal is a narrow audience already searching for or buying similar products."],
        ["Margin discipline", "Shipping, returns, discounts, and ad costs can erase attractive headline margins."],
        ["Trust signals", "Reviews, product detail, delivery clarity, and support expectations influence conversion."]
      ],
      risks: [
        ["Acquisition cost", "Paid channels can become uneconomic if repeat purchase is weak."],
        ["Fulfillment complexity", "Stockouts, returns, delivery delays, and supplier quality can damage trust."],
        ["Commodity pressure", "Undifferentiated products invite price comparison and low loyalty."]
      ],
      actions: [
        ["Validate demand", "Test a narrow product category with landing pages, preorders, or small-batch inventory."],
        ["Model contribution margin", "Include product cost, payment fees, shipping, returns, support, and ads."],
        ["Study purchase objections", "Review competitor reviews, FAQs, return reasons, and support complaints."],
        ["Define repeat path", "Identify bundles, subscriptions, accessories, or lifecycle triggers."]
      ],
      sources: [
        ["Marketplace data", "Review Amazon, Etsy, Shopify stores, category rankings, reviews, and pricing."],
        ["Ad and search signals", "Use keyword demand, social ads, creator content, and search trends as directional input."],
        ["Fulfillment benchmarks", "Compare supplier terms, delivery times, return rates, and logistics costs."]
      ],
      competitors: [
        ["Marketplaces", "Existing demand", "High competition", "Win with sharper positioning"],
        ["DTC brands", "Brand control", "Higher acquisition cost", "Win with trust and retention"],
        ["Local retailers", "Immediate availability", "Limited digital reach", "Win with convenience"]
      ]
    },
    healthcare: {
      customer: "Patients, consumers, providers, or wellness users who need trustworthy outcomes and low-friction adoption.",
      thesis: "Healthcare opportunities require unusually high trust, clear user benefit, responsible claims, and careful source verification.",
      monetization: "Value may come from subscriptions, provider partnerships, employer programs, or improved operational efficiency.",
      findings: [
        ["Trust threshold", "Users need clear limits, evidence, privacy expectations, and responsible language."],
        ["Adoption friction", "Even useful tools fail if they add work for patients or providers."],
        ["Outcome clarity", "The strongest concept explains what improves and how that improvement is measured."]
      ],
      risks: [
        ["Regulatory sensitivity", "Claims, data handling, and medical context require expert review."],
        ["Privacy concern", "Users may hesitate if data use and storage are not clear."],
        ["Clinical ambiguity", "Wellness and medical claims must not be overstated."]
      ],
      actions: [
        ["Define the user context", "Separate patient, provider, payer, employer, and consumer wellness use cases."],
        ["Review claim boundaries", "List what the product can responsibly say and what requires expert validation."],
        ["Test adoption friction", "Map the workflow and remove steps that add burden."],
        ["Validate evidence needs", "Identify studies, guidelines, and primary data required before launch."]
      ],
      sources: [
        ["Clinical guidance", "Review official guidelines, peer-reviewed research, and trusted health organizations."],
        ["Privacy requirements", "Check regional privacy expectations, data sensitivity, and consent needs."],
        ["User workflow evidence", "Interview patients, providers, or wellness users about current behavior."]
      ],
      competitors: [
        ["Health apps", "Consumer familiarity", "Trust varies widely", "Win with credible scope"],
        ["Provider tools", "Clinical context", "Slow adoption", "Win with low workflow burden"],
        ["Manual coaching", "Human trust", "Hard to scale", "Win with structured support"]
      ]
    },
    real_estate: {
      customer: "Buyers, renters, investors, or operators comparing property decisions against financial and lifestyle constraints.",
      thesis: "Real estate decisions depend on local prices, financing, hold period, liquidity, comparable rents, and downside scenarios.",
      monetization: "Value comes from decision support, scenario modeling, local comparison, and risk-adjusted planning.",
      findings: [
        ["Local data dependency", "Neighborhood-level comps matter more than broad national trends."],
        ["Hold period", "Transaction costs make short timelines materially riskier."],
        ["Cash flow sensitivity", "Rates, vacancy, maintenance, taxes, and rent assumptions drive the outcome."]
      ],
      risks: [
        ["Local market shift", "Small area price changes can alter the conclusion quickly."],
        ["Financing risk", "Rates, lending terms, and affordability can change before purchase."],
        ["Maintenance surprises", "Repairs and building costs can invalidate optimistic scenarios."]
      ],
      actions: [
        ["Collect local comps", "Compare recent sale prices, rental listings, and days-on-market in the target area."],
        ["Model scenarios", "Build conservative, base, and stress cases for 5- and 10-year horizons."],
        ["Check financing", "Estimate monthly payment, cash required, rate sensitivity, and liquidity impact."],
        ["Define decision threshold", "Set the conditions under which buying, renting, or waiting wins."]
      ],
      sources: [
        ["Property listings", "Use local sales, rent listings, days-on-market, and comparable property data."],
        ["Financing data", "Review mortgage rates, bank terms, taxes, insurance, and transaction costs."],
        ["Local indicators", "Check employment, population, infrastructure, schools, and neighborhood demand."]
      ],
      competitors: [
        ["Buying", "Equity potential", "Less flexibility", "Best with long hold period"],
        ["Renting", "Flexibility", "No equity build", "Best with uncertain timeline"],
        ["Waiting", "Preserves liquidity", "May miss upside", "Best when assumptions are weak"]
      ]
    },
    b2b_service: {
      customer: "Business buyers who need a reliable outcome, clear scope, and low operational risk.",
      thesis: "A B2B service works when the pain is frequent, the buyer owns budget, and delivery can become repeatable.",
      monetization: "Start with a fixed-scope offer, then expand into retainers, templates, or recurring services.",
      findings: [
        ["Buyer trigger", "The best opportunities connect to a moment when the buyer must act."],
        ["Scope control", "Clear boundaries protect margin and delivery quality."],
        ["Repeatability", "Reusable playbooks make the service easier to sell and fulfill."]
      ],
      risks: [
        ["Custom work trap", "Too much bespoke delivery limits scale and margin."],
        ["Long sales cycles", "Business buyers may need proof, approvals, and timing alignment."],
        ["Outcome ambiguity", "Weak success metrics make value harder to prove."]
      ],
      actions: [
        ["Define the offer", "Write the exact problem solved, deliverables, timeline, and exclusions."],
        ["Interview target buyers", "Validate budget, urgency, current workaround, and purchase process."],
        ["Package a pilot", "Sell a fixed-scope version before building a broad service menu."],
        ["Document delivery", "Turn each project into reusable checklists and templates."]
      ],
      sources: [
        ["Buyer interviews", "Capture workflow, urgency, budget, and decision criteria."],
        ["Competitor offers", "Review service pages, pricing signals, case studies, and positioning."],
        ["Industry communities", "Use forums, directories, LinkedIn, and reviews to find repeated pain."]
      ],
      competitors: [
        ["Freelancers", "Flexible capacity", "Variable process", "Win with repeatable delivery"],
        ["Agencies", "Full-service support", "Higher cost", "Win with focused scope"],
        ["Internal teams", "Company context", "Limited bandwidth", "Win with speed and expertise"]
      ]
    },
    consumer_app: {
      customer: "Consumers who need a habit-forming, low-friction solution to a repeated personal problem.",
      thesis: "Consumer apps need a sharp use case, fast time-to-value, retention loop, and believable acquisition path.",
      monetization: "Revenue may come from subscriptions, freemium upgrades, transactions, or partnerships once retention is proven.",
      findings: [
        ["Habit potential", "The core behavior must repeat often enough to support retention."],
        ["Onboarding speed", "Users should experience value in the first session."],
        ["Acquisition fit", "Consumer growth needs a channel that matches the audience and use case."]
      ],
      risks: [
        ["Low retention", "Initial curiosity can fade quickly without a repeated trigger."],
        ["Crowded category", "Consumer apps often compete with many substitutes and free alternatives."],
        ["Monetization delay", "Payment usually follows retention proof, not the other way around."]
      ],
      actions: [
        ["Define the habit loop", "Identify trigger, action, reward, and repeat frequency."],
        ["Prototype first-session value", "Test whether users understand and benefit from the app in minutes."],
        ["Measure retention", "Track whether users return without reminders or incentives."],
        ["Test acquisition messages", "Compare three positioning angles with the target audience."]
      ],
      sources: [
        ["App store reviews", "Study complaints, ratings, feature requests, and retention clues."],
        ["Community discussions", "Review Reddit, forums, social posts, and creator content for repeated pain."],
        ["Comparable apps", "Analyze onboarding, pricing, notifications, and habit loops."]
      ],
      competitors: [
        ["Existing apps", "Installed behavior", "Feature fatigue", "Win with simpler value"],
        ["Manual habits", "No switching cost", "Low structure", "Win with convenience"],
        ["Content communities", "Engagement", "Limited workflow", "Win with actionability"]
      ]
    }
  };
  return profiles[industry] || null;
}

function getIntentProfile(intent, topic, industry) {
  const label = industryLabel(industry);
  const profiles = {
    startup_validation: {
      executive: `This report treats <strong>${escapeHtml(topic)}</strong> as a validation problem. The priority is not proving the idea is exciting; it is testing whether a specific buyer has a painful enough problem, a reachable channel, and a reason to act now in the ${label} space.`,
      findings: [
        ["Validation focus", "The first milestone is evidence of real demand, not a polished product."],
        ["Buyer clarity", "The report should identify who feels the pain and who controls the budget."],
        ["Fastest proof", "A focused pilot, landing page, interview sequence, or paid test is more useful than broad research."]
      ]
    },
    business_plan: {
      executive: `This report frames <strong>${escapeHtml(topic)}</strong> as an operating plan. The most important questions are customer demand, delivery model, unit economics, launch sequencing, and what must be proven before committing serious capital.`,
      findings: [
        ["Operating model", "The plan needs a clear path from first customer to repeatable delivery."],
        ["Unit economics", "Pricing, cost structure, and capacity should be modeled before launch."],
        ["Launch sequence", "The safest plan starts with a narrow proof point and expands after evidence appears."]
      ]
    },
    market_analysis: {
      executive: `This report frames <strong>${escapeHtml(topic)}</strong> as a market analysis. The goal is to understand segment quality, demand signals, competitive pressure, and what evidence would make the opportunity more or less attractive.`,
      findings: [
        ["Segment quality", "A smaller reachable segment can be more useful than a large abstract market."],
        ["Demand evidence", "Search behavior, spending patterns, reviews, and workflow pain should be compared."],
        ["Market timing", "The strongest opportunities have a clear reason why now is better than later."]
      ]
    },
    competitor_comparison: {
      executive: `This report compares <strong>${escapeHtml(topic)}</strong> through practical buyer criteria rather than brand preference. The strongest decision will come from comparing use case fit, cost, integration effort, trust, support, and switching risk.`,
      findings: [
        ["Decision criteria", "The comparison should start with the user's workflow, not vendor popularity."],
        ["Trade-off clarity", "Each option should be evaluated by where it is strongest and where it creates friction."],
        ["Implementation risk", "Integration, support, migration, and operational edge cases should be checked before selection."]
      ]
    },
    product_strategy: {
      executive: `This report treats <strong>${escapeHtml(topic)}</strong> as a product strategy question. The priority is deciding which customer problem deserves focus, what position the product should own, and what to build or avoid first.`,
      findings: [
        ["Positioning", "The product needs a sharp promise that a target customer can repeat in one sentence."],
        ["Scope control", "Early product strategy should reduce choices, not expand the feature list."],
        ["Adoption path", "The first workflow should be easy to try and valuable enough to repeat."]
      ]
    },
    learning_plan: {
      executive: `This report turns <strong>${escapeHtml(topic)}</strong> into a structured learning plan. The objective is to move from vague interest to weekly outcomes, practice projects, feedback, and visible proof of skill.`,
      findings: [
        ["Weekly milestones", "A good plan defines what the learner can demonstrate each week."],
        ["Project evidence", "Practice projects should create portfolio artifacts, not just notes."],
        ["Feedback rhythm", "Skill improves faster when work is reviewed and revised on a schedule."]
      ]
    },
    investment_thesis: {
      executive: `This report frames <strong>${escapeHtml(topic)}</strong> as an investment thesis draft. It separates thesis drivers, risks, valuation assumptions, evidence to verify, and decision triggers. It is not financial advice.`,
      findings: [
        ["Thesis drivers", "The strongest thesis identifies what must be true for upside to occur."],
        ["Risk boundaries", "Downside scenarios should be explicit before position sizing."],
        ["Evidence checklist", "Financials, management commentary, market data, and comparables need source review."]
      ]
    },
    general_research: {
      executive: `This report organizes <strong>${escapeHtml(topic)}</strong> into a decision-ready research draft. It highlights useful signals, open assumptions, recommended evidence, and practical next steps without claiming live verification.`,
      findings: [
        ["Clarify the question", "The most useful report starts by defining what decision the research should support."],
        ["Separate evidence from assumptions", "Estimates should be treated as structure until checked against real sources."],
        ["Choose the next proof point", "The report should end with what to verify next, not more open-ended reading."]
      ]
    }
  };
  return profiles[intent] || profiles.general_research;
}

function getDynamicBars(intent, industry, seed) {
  if (intent === "learning_plan") {
    return [
      ["Foundation clarity", seeded(`${seed}lb1`, 62, 88)],
      ["Practice intensity", seeded(`${seed}lb2`, 58, 86)],
      ["Feedback access", seeded(`${seed}lb3`, 42, 78)],
      ["Portfolio value", seeded(`${seed}lb4`, 64, 90)]
    ];
  }
  if (intent === "competitor_comparison") {
    return [
      ["Use case fit", seeded(`${seed}cb1`, 62, 90)],
      ["Integration effort", seeded(`${seed}cb2`, 42, 76)],
      ["Switching risk", seeded(`${seed}cb3`, 38, 72)],
      ["Total cost clarity", seeded(`${seed}cb4`, 52, 84)]
    ];
  }
  if (industry === "coffee_shop") {
    return [
      ["Location demand", seeded(`${seed}rb1`, 58, 88)],
      ["Menu margin", seeded(`${seed}rb2`, 52, 82)],
      ["Repeat purchase", seeded(`${seed}rb3`, 48, 78)],
      ["Lease sensitivity", seeded(`${seed}rb4`, 45, 74)]
    ];
  }
  if (industry === "saas" || industry === "ai_automation") {
    return [
      ["Workflow pain", seeded(`${seed}sb1`, 62, 90)],
      ["Buyer urgency", seeded(`${seed}sb2`, 52, 84)],
      ["Willingness to pay", seeded(`${seed}sb3`, 48, 82)],
      ["Delivery complexity", seeded(`${seed}sb4`, 42, 78)]
    ];
  }
  return [
    ["Opportunity clarity", seeded(`${seed}gb1`, 58, 88)],
    ["Evidence quality needed", seeded(`${seed}gb2`, 50, 82)],
    ["Execution effort", seeded(`${seed}gb3`, 42, 78)],
    ["Decision usefulness", seeded(`${seed}gb4`, 60, 88)]
  ];
}

function getDynamicReportContent({ topic, seed, intent, industry }) {
  const intentProfile = getIntentProfile(intent, topic, industry);
  const industryProfile = getIndustryProfile(industry, topic);
  const label = industryLabel(industry);
  const fallbackCompetitors = [
    ["Direct alternatives", "Comparable current solutions", "Limited source context", "Verify with live market research"],
    ["Manual workflow", "Existing user behavior", "Time-consuming and inconsistent", "Clarify what should be automated"],
    ["General tools", "Broad capability", "Weak fit for the exact job", "Win with focused execution"]
  ];

  return {
    executive: intentProfile.executive,
    thesis: industryProfile?.thesis || `The value of ${topic} depends on whether the user problem is specific, urgent, and supported by evidence.`,
    customer: industryProfile?.customer || `People evaluating ${topic} who need clarity before committing time or money.`,
    monetization: industryProfile?.monetization || "The strongest value path depends on saved time, reduced uncertainty, or a clearer decision.",
    findings: intentProfile.findings.concat(industryProfile?.findings || []),
    risks: industryProfile?.risks || [
      ["Evidence gap", "Important assumptions need source review before decisions are made."],
      ["Audience ambiguity", "The report becomes weaker if the target user or buyer is not specific."],
      ["Execution uncertainty", "The path forward needs concrete milestones, not only broad research."]
    ],
    financial: getDynamicFinancial(intent, industry, seed),
    actions: industryProfile?.actions || getDynamicActions(intent),
    sources: industryProfile?.sources || getDynamicSources(intent),
    competitors: industryProfile?.competitors || fallbackCompetitors,
    advantages: getDynamicAdvantages(intent, industry, topic),
    disadvantages: getDynamicDisadvantages(intent, industry),
    bars: getDynamicBars(intent, industry, seed),
    limitations: getDynamicLimitations(intent, industry)
  };
}

function getDynamicFinancial(intent, industry, seed) {
  if (intent === "learning_plan") {
    return [
      ["Weekly time budget", `${seeded(`${seed}lf1`, 6, 14)} focused hours per week recommended`],
      ["Project target", `${seeded(`${seed}lf2`, 2, 4)} portfolio artifacts by day 90`],
      ["Review cadence", "Weekly feedback or self-review checkpoints"]
    ];
  }
  if (industry === "coffee_shop") {
    return [
      ["Startup capital range", `$${seeded(`${seed}cf1`, 120, 420)}K illustrative setup and runway range`],
      ["Daily transaction target", `${seeded(`${seed}cf2`, 90, 260)} orders/day in a base-case model`],
      ["Margin sensitivity", "Rent, labor, waste, and average order value drive the model"]
    ];
  }
  if (industry === "saas") {
    return [
      ["Pilot revenue target", `$${seeded(`${seed}sf1`, 2, 12)}K MRR before expanding scope`],
      ["CAC sensitivity", "Founder-led sales should validate channels before paid acquisition"],
      ["Expansion path", "Retention and workflow depth matter more than broad feature count"]
    ];
  }
  if (industry === "ai_automation") {
    return [
      ["Pilot package", `$${seeded(`${seed}af1`, 1, 8)}K fixed-scope implementation test`],
      ["Retainer potential", `$${seeded(`${seed}af2`, 500, 2500)}/mo for monitoring and improvements`],
      ["Delivery leverage", "Reusable templates determine whether service work scales"]
    ];
  }
  if (industry === "finance" || intent === "competitor_comparison") {
    return [
      ["Cost scenario", "Model total cost across expected transaction volume and edge cases"],
      ["Switching cost", "Include engineering, operations, support, and customer communication"],
      ["Risk premium", "Reliability and dispute handling may matter more than small fee differences"]
    ];
  }
  return [
    ["Budget range", "Use conservative, base, and optimistic cases before committing"],
    ["Cost drivers", "Identify the two or three variables that most affect the outcome"],
    ["Decision threshold", "Define what evidence would justify moving forward"]
  ];
}

function getDynamicActions(intent) {
  const actions = {
    business_plan: [
      ["Write the operating model", "Define customer, offer, channel, delivery process, cost structure, and launch sequence."],
      ["Build a simple financial model", "Create conservative, base, and optimistic scenarios before spending heavily."],
      ["Run a proof test", "Validate demand with a narrow pilot, preorder, landing page, or customer interview sprint."],
      ["Review go/no-go criteria", "Decide which metrics must be true before scaling."]
    ],
    market_analysis: [
      ["Narrow the segment", "Define the reachable audience before using broad market estimates."],
      ["Collect demand signals", "Compare search behavior, reviews, spending patterns, and workflow pain."],
      ["Map alternatives", "List direct competitors, substitutes, and manual workarounds."],
      ["Identify proof gaps", "Decide which assumptions need source verification next."]
    ],
    competitor_comparison: [
      ["Define decision criteria", "Rank price, implementation effort, support, trust, and use case fit."],
      ["Build a comparison matrix", "Score each option against the same workflow requirements."],
      ["Test the edge cases", "Review refunds, migration, support, integrations, and failure scenarios."],
      ["Choose with a trigger", "Define what evidence would make one option clearly preferable."]
    ],
    product_strategy: [
      ["Choose the first workflow", "Pick the smallest repeated job that creates a visible user outcome."],
      ["Write positioning", "Describe the product promise in one sentence for one target customer."],
      ["Cut nonessential features", "Delay anything that does not support the first workflow."],
      ["Define success metrics", "Track completion, repeat usage, and willingness to pay."]
    ],
    general_research: [
      ["Clarify the decision", "Rewrite the question as the decision this research should support."],
      ["List assumptions", "Separate what is estimated from what needs evidence."],
      ["Prioritize sources", "Choose the most reliable source categories to verify next."],
      ["Create next steps", "Turn the report into a short action checklist."]
    ]
  };
  return actions[intent] || actions.general_research;
}

function getDynamicSources(intent) {
  const sources = {
    business_plan: [
      ["Customer evidence", "Interviews, preorders, surveys, or pilot usage from target buyers."],
      ["Cost benchmarks", "Supplier pricing, operating expenses, staffing assumptions, and comparable businesses."],
      ["Competitor references", "Pricing, positioning, reviews, offers, and customer complaints."]
    ],
    market_analysis: [
      ["Market reports", "Industry reports, public datasets, government statistics, and analyst commentary."],
      ["Demand signals", "Search trends, reviews, forums, job posts, and customer complaints."],
      ["Competitor landscape", "Pricing pages, product docs, app listings, and category directories."]
    ],
    competitor_comparison: [
      ["Product documentation", "Feature coverage, API docs, integrations, support docs, and limits."],
      ["Pricing pages", "Fees, plans, usage limits, add-ons, and regional availability."],
      ["User feedback", "Reviews, status pages, complaints, case studies, and migration stories."]
    ],
    product_strategy: [
      ["User interviews", "Workflow walkthroughs, current tools, pain points, and buying triggers."],
      ["Usage benchmarks", "Completion rates, activation moments, retention signals, and support requests."],
      ["Competitive UX", "Onboarding, positioning, pricing, and feature depth from adjacent products."]
    ],
    general_research: [
      ["Primary sources", "Official documents, public datasets, academic or industry research, and direct interviews."],
      ["Market references", "Competitor pages, reviews, reports, and customer discussions."],
      ["Decision evidence", "Any data that would change the recommendation or reduce uncertainty."]
    ]
  };
  return sources[intent] || sources.general_research;
}

function getDynamicAdvantages(intent, industry, topic) {
  return [
    ["Focused decision frame", `${intentLabel(intent)} keeps ${topic} tied to a practical next decision.`],
    ["Relevant assumptions", `The report emphasizes ${industryLabel(industry)} variables instead of generic research points.`],
    ["Actionable draft", "The output is structured to become interviews, tests, models, or a comparison checklist."]
  ];
}

function getDynamicDisadvantages(intent, industry) {
  return [
    ["Evidence limits", "The report does not include live source verification, so material claims still need verification."],
    ["Prompt sensitivity", `The ${intentLabel(intent)} draft improves when the audience, geography, budget, or constraints are specific.`],
    ["Industry nuance", `${industryLabel(industry)} details require local or expert validation before decisions are made.`]
  ];
}

function getDynamicLimitations(intent, industry) {
  return [
    ["Estimated draft", `This ${intentLabel(intent)} report uses available prompt context and illustrative assumptions for the ${industryLabel(industry)} context.`],
    ["Needs connected sources", "Live citations, current market data, official documents, interviews, and primary research would strengthen the final report."],
    ["Best used as a first draft", "Use this report to structure thinking, identify evidence gaps, and decide what to verify next."]
  ];
}

/* -- Report HTML builder -- */

function barRow(label, value) {
  return `
    <div class="bar-row">
      <span>${escapeHtml(label)}</span>
      <i><b data-width="${value}"></b></i>
      <strong>${value}</strong>
    </div>`;
}

function insightCard(title, text) {
  if (Array.isArray(text)) {
    const items = text.map(item => {
      if (Array.isArray(item)) {
        return `<li>${item.map(part => `<span>${escapeHtml(part)}</span>`).join("")}</li>`;
      }
      return `<li><span>${escapeHtml(item)}</span></li>`;
    }).join("");
    return `<div><strong>${escapeHtml(title)}</strong><ul class="comparison-list">${items}</ul></div>`;
  }

  return `<div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div>`;
}

function scorecardCard(card) {
  const rows = (card.scores || []).map(([label, score, why]) => `
    <li>
      <div>
        <strong>${escapeHtml(label)}</strong>
        <p>${escapeHtml(why)}</p>
      </div>
      <b>${escapeHtml(score)} <span>/ 10</span></b>
    </li>`).join("");

  return `
    <article class="scorecard-card">
      <h3>${escapeHtml(card.option)}</h3>
      <ul>${rows}</ul>
    </article>`;
}

function recommendationStep(item, index) {
  return `
    <article class="recommendation-card">
      <span>${index + 1}</span>
      <div>
        <h3>${escapeHtml(item.action)}</h3>
        <dl>
          <div><dt>Why</dt><dd>${escapeHtml(item.why)}</dd></div>
          <div><dt>Success</dt><dd>${escapeHtml(item.success)}</dd></div>
          <div><dt>Failure</dt><dd>${escapeHtml(item.failure)}</dd></div>
        </dl>
      </div>
    </article>`;
}

function reasoningStep(step, index, total) {
  return `
    <article>
      <span>${index + 1}</span>
      <div>
        <strong>${escapeHtml(step)}</strong>
        <p>${index < total - 1 ? "Leads to the next decision input." : "Produces the current recommendation."}</p>
      </div>
    </article>`;
}

function signalItem(title, text) {
  return `<li><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></li>`;
}

function comparisonRows(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(row => Array.isArray(row) && row.length)
    .map(row => row.map(cell => String(cell)));
}

function comparisonCount(data) {
  const rows = comparisonRows(data.competitors);
  return rows.length || data.competitorCount || 0;
}

function representativeAlternatives(data) {
  return comparisonRows(data.competitors).slice(0, 3);
}

function slugifyId(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "section";
}

function makeSection(title, purpose, layoutType, content) {
  return {
    id: slugifyId(title),
    title,
    purpose,
    layoutType,
    ...content
  };
}

function reasoningItem(observed, assumed, implication, recommendation, change) {
  return { observed, assumed, implication, recommendation, change };
}

function recommendation(action, why, success, failure) {
  return { action, why, success, failure };
}

function table(headers, rows) {
  return { headers, rows };
}

function getReportArchetype(data) {
  const prompt = `${data.prompt} ${data.topic}`.toLowerCase();
  if (/etf|rental apartment|€|20,000|20000|invest it/.test(prompt)) return "capital_allocation";
  if (/apartment|rent|buy|mortgage|real estate/.test(prompt) && /rent|buy|apartment|mortgage/.test(prompt)) return "buy_vs_rent";
  if (/agency/.test(prompt) && /ai|automation|marketing/.test(prompt)) return "agency";
  if (/go-to-market|go to market|gtm|selling|sales motion/.test(prompt) || (/saas/.test(prompt) && /dentist|clinic|dental/.test(prompt))) return "saas_gtm";
  if (/coffee|restaurant|cafe|shop/.test(prompt)) return "local_hospitality";
  if (data.intent === "learning_plan") return "learning";
  if (data.intent === "competitor_comparison") return "comparison";
  return "general";
}

function getFinalRecommendation(data) {
  const archetype = getReportArchetype(data);
  const recommendations = {
    buy_vs_rent: {
      decision: "Test first",
      confidence: "68%",
      biggestAssumption: "The conclusion depends on Riga sale prices, mortgage terms, rent inflation and how long you will hold the property.",
      nextStep: "Collect 10 comparable sale prices, 10 rent listings, two mortgage offers and estimated building costs before choosing.",
      deadline: "Make the decision after a two-week evidence sprint, then revisit every six months until 2030.",
      reverseConditions: ["Mortgage rate exceeds 5.0%", "Holding period falls below 6 years", "Purchase price exceeds verified rent-equivalent threshold"],
      confidenceLimits: ["No verified sale comparables", "Mortgage terms not confirmed", "Maintenance costs estimated"],
      confidenceUpside: "Confidence rises to 86% after sale comps, rent comps and two mortgage offers.",
      riskIfWrong: "Buying too early traps capital in a low-liquidity asset while renting stays cheaper."
    },
    agency: {
      decision: "Test first",
      confidence: "72%",
      biggestAssumption: "Enough Latvian businesses have repetitive workflows worth at least EUR 300-1,000 per month in saved time or revenue.",
      nextStep: "Interview 15 target businesses and sell one fixed-scope pilot before building a broad agency offer.",
      deadline: "Run a 30-day validation sprint and decide go/no-go by the end of month one.",
      reverseConditions: ["Fewer than 5 of 15 interviews reveal paid workflow pain", "No pilot buyer accepts EUR 1,000+", "Delivery requires custom work with no repeatable playbook"],
      confidenceLimits: ["No customer interviews completed", "Willingness to pay untested", "Delivery margin unknown"],
      confidenceUpside: "Confidence rises to 88% after one paid pilot and five documented workflow audits.",
      riskIfWrong: "The agency becomes low-margin custom implementation work with weak recurring revenue."
    },
    saas_gtm: {
      decision: "Go, narrowly",
      confidence: "70%",
      biggestAssumption: "Dental clinics feel an urgent admin or revenue problem and will pay for one clear workflow rather than a broad AI toolkit.",
      nextStep: "Interview 15 clinic owners, launch one landing page and test a single offer around missed calls, no-shows or admin automation.",
      deadline: "Validate channel and willingness to pay within 30 days before building more features.",
      reverseConditions: ["Fewer than 5 clinics report weekly workflow pain", "Landing page conversion stays below 5%", "Clinics reject EUR 99-299/mo pricing"],
      confidenceLimits: ["Clinic buying process unknown", "Onboarding friction untested", "Churn risk unmeasured"],
      confidenceUpside: "Confidence rises to 85% after 5 paid pilots and one repeatable onboarding flow.",
      riskIfWrong: "The product becomes a broad AI toolkit with high education cost and weak retention."
    },
    local_hospitality: {
      decision: "Wait until location evidence is strong",
      confidence: "64%",
      biggestAssumption: "Daily foot traffic, rent, labor and repeat purchase economics support a premium concept.",
      nextStep: "Observe three candidate streets at peak times, price the menu, and model break-even orders per day.",
      deadline: "Do not sign a lease until the site passes a two-week demand and cost test.",
      reverseConditions: ["Break-even requires more than 180 orders/day", "Rent exceeds 10% of conservative revenue", "Repeat purchase test underperforms target pricing"],
      confidenceLimits: ["No foot traffic count", "Lease terms unknown", "Ticket size untested"],
      confidenceUpside: "Confidence rises to 82% after foot traffic counts, supplier quotes and a paid pop-up test.",
      riskIfWrong: "A lease locks the business into fixed costs before repeat demand is proven."
    },
    capital_allocation: {
      decision: "Choose staged allocation",
      confidence: "69%",
      biggestAssumption: "The best choice depends on risk tolerance, time horizon, income stability and ability to operate an active business.",
      nextStep: "Split the decision into safety reserve, passive investment and one small active experiment rather than committing all EUR 20,000 at once.",
      deadline: "Decide allocation rules this week, then review after 90 days.",
      reverseConditions: ["Emergency reserve is incomplete", "Agency experiment fails to produce paid demand", "Property requires excessive leverage or repair risk"],
      confidenceLimits: ["Personal runway unknown", "Risk tolerance not quantified", "Property cash flow unverified"],
      confidenceUpside: "Confidence rises to 84% after defining runway, comparing ETF allocation and testing one paid agency offer.",
      riskIfWrong: "Capital gets concentrated into an illiquid or time-heavy path before risk is understood."
    },
    learning: {
      decision: "Go with milestones",
      confidence: "Medium-high",
      biggestAssumption: "Progress depends on weekly practice and feedback, not content consumption.",
      nextStep: "Define three portfolio projects and a weekly review cadence before choosing more courses.",
      deadline: "Use a 90-day plan with measurable weekly outputs."
    },
    comparison: {
      decision: "Choose after criteria test",
      confidence: "Medium",
      biggestAssumption: "The best option depends on weighted criteria, implementation effort and edge cases.",
      nextStep: "Score each option against the same criteria and test the top two with real workflow requirements.",
      deadline: "Make the choice after a one-week comparison sprint."
    },
    general: {
      decision: "Test first",
      confidence: "66%",
      biggestAssumption: "The prompt contains enough context for a useful first draft, but the evidence still needs verification.",
      nextStep: "Collect the three strongest pieces of evidence that would change the recommendation.",
      deadline: "Run a focused evidence review before committing resources.",
      reverseConditions: ["Primary evidence contradicts the core assumption", "Cost exceeds the acceptable threshold", "Decision-maker or buyer urgency is absent"],
      confidenceLimits: ["Limited prompt context", "No verified primary evidence", "Decision threshold not quantified"],
      confidenceUpside: "Confidence rises after primary evidence confirms the main assumption.",
      riskIfWrong: "The user commits resources before the strongest uncertainty is resolved."
    }
  };
  return recommendations[archetype] || recommendations.general;
}

function dynamicEvidence(archetype) {
  const evidence = {
    buy_vs_rent: [
      "Recent Riga apartment sale comparables for the target district",
      "Current rent listings for similar apartments",
      "Mortgage offers including rate, down payment and fees",
      "HOA, building fund, insurance and maintenance costs",
      "Transaction taxes, notary fees and broker fees",
      "Five-year local price trend and liquidity risk"
    ],
    agency: [
      "Interviews with target business owners or operators",
      "Screenshots or walkthroughs of current workflows",
      "Hours lost per process each week",
      "Decision-maker identity and budget owner",
      "Existing tools used and why they are insufficient",
      "Willingness to pay for a fixed-scope pilot"
    ],
    saas_gtm: [
      "Competitor pricing pages and packaging",
      "Keyword demand for dental admin, no-show and missed-call problems",
      "Interviews with clinic owners and office managers",
      "Landing page conversion from one specific promise",
      "Churn risk signals from workflow frequency",
      "Sales objections from the first 10 clinics"
    ],
    local_hospitality: [
      "Foot traffic counts by hour and day",
      "Nearby competitor menus and prices",
      "Rent, deposit, utilities and fit-out costs",
      "Supplier quotes for core menu items",
      "Average order value assumptions",
      "Repeat purchase signals from a pop-up or preorder test"
    ],
    capital_allocation: [
      "Personal runway and emergency reserve needs",
      "ETF fee, diversification and time-horizon assumptions",
      "Rental apartment down payment and cash-flow estimates",
      "AI agency pilot demand and operating capacity",
      "Tax implications and liquidity needs",
      "Downside case for each option"
    ],
    general: [
      "Primary source documents",
      "Customer or stakeholder interviews",
      "Comparable alternatives and pricing",
      "Cost, timing and risk assumptions",
      "Evidence that would change the conclusion"
    ]
  };
  return evidence[archetype] || evidence.general;
}

function dynamicRecommendations(archetype, data) {
  const topic = data.topic;
  const items = {
    buy_vs_rent: [
      recommendation("Build a buy-vs-rent spreadsheet for three Riga districts.", "The decision depends on local prices and rent, not a generic property rule.", "Proceed if ownership beats renting under conservative rent, rate and maintenance assumptions.", "Wait if the break-even requires optimistic appreciation or a holding period you cannot commit to."),
      recommendation("Request two mortgage offers before comparing scenarios.", "Monthly cost and down payment constraints can change the answer immediately.", "Continue if the payment leaves enough cash buffer after repairs and fees.", "Delay if the mortgage offer makes the decision fragile under a rate or income shock."),
      recommendation("Define a 2030 decision threshold.", "A clear threshold prevents emotional buying or endless waiting.", "Buy if verified total cost and lifestyle stability beat renting by your threshold.", "Rent if liquidity, job mobility or better investment use remains more valuable.")
    ],
    agency: [
      recommendation("Interview 15 Latvian business owners in one vertical.", "A narrow vertical reveals repeated workflow pain faster than broad agency positioning.", "Proceed if at least 5 describe a painful workflow worth EUR 300+/mo.", "Stop or reposition if they like AI in theory but will not name a paid problem."),
      recommendation("Sell one fixed-scope pilot before building service packages.", "Revenue is stronger evidence than interest.", "Proceed if one customer pays EUR 1,000-3,000 for a defined automation outcome.", "Revise the offer if prospects want free advice but avoid paid implementation."),
      recommendation("Document every pilot as a reusable playbook.", "Agency margin depends on repeatable delivery, not custom work forever.", "Scale if delivery steps repeat across customers.", "Stay small if each project requires a new process from scratch.")
    ],
    saas_gtm: [
      recommendation("Interview 15 dental clinic owners or office managers.", "The product must map to a painful clinic workflow, not generic AI enthusiasm.", "Proceed if at least 5 report missed calls, no-shows or admin work worth EUR 300+/mo.", "Change ICP if clinics see the problem as annoying but not worth paying for."),
      recommendation("Launch one landing page with one workflow promise.", "A narrow promise tests positioning before product complexity grows.", "Continue if targeted traffic converts to calls or waitlist signups above 5-8%.", "Rewrite positioning if visitors do not understand the outcome in 10 seconds."),
      recommendation("Test founder-led sales before paid acquisition.", "Dental SaaS requires trust, education and workflow proof.", "Proceed if clinics book demos from direct outreach.", "Delay scaling if demos require heavy custom explanation.")
    ],
    local_hospitality: [
      recommendation("Count foot traffic at candidate locations for two weeks.", "A coffee shop is a location economics problem before it is a brand problem.", "Proceed if conservative order volume covers rent, labor and waste.", "Walk away if the model only works with peak-hour optimism."),
      recommendation("Run a pop-up or preorder test.", "Repeat purchase matters more than opening-week curiosity.", "Continue if customers return and accept target pricing.", "Revise menu or positioning if demand is novelty-only."),
      recommendation("Calculate break-even orders per day before lease negotiation.", "Rent can quietly destroy a premium concept.", "Sign only if the site works under conservative average order value.", "Do not sign if break-even requires unrealistic daily volume.")
    ],
    capital_allocation: [
      recommendation("Reserve cash before choosing investments.", "EUR 20,000 is large enough to protect optionality and test upside.", "Proceed if emergency reserve and near-term obligations are covered.", "Do not invest all capital if one unexpected cost would force selling."),
      recommendation("Run a 90-day AI agency experiment with capped capital.", "The agency path has upside but requires sales and execution, not just investment.", "Continue if the experiment produces paid demand.", "Stop if it consumes time without paid customer evidence."),
      recommendation("Compare ETFs and property using liquidity-adjusted returns.", "Passive and real estate options differ in effort, liquidity and concentration risk.", "Allocate more to passive options if you value flexibility.", "Avoid property if down payment and repairs create a cash squeeze.")
    ],
    general: [
      recommendation(`Turn "${topic}" into a one-week evidence sprint.`, "The fastest improvement is replacing assumptions with targeted proof.", "Proceed if evidence supports the core decision threshold.", "Pause if the strongest assumption remains unverified."),
      recommendation("Write the decision rule before collecting more information.", "A decision rule prevents research from becoming endless reading.", "Continue if the next evidence directly changes the decision.", "Stop collecting data that does not affect the outcome."),
      recommendation("Review the final decision with one knowledgeable outsider.", "A second perspective catches blind spots and hidden constraints.", "Proceed if objections are answerable with evidence.", "Revise if the review reveals untested risks.")
    ]
  };
  return items[archetype] || items.general;
}

function decisionScorecards(archetype) {
  const cards = {
    buy_vs_rent: [
      { option: "Buy now", scores: [
        ["Cash flow", 5, "Monthly cost starts higher until equity accumulation offsets the gap."],
        ["Liquidity", 3, "Down payment and transaction costs reduce flexibility."],
        ["Long-term wealth", 8, "Ownership wins after the holding period crosses the break-even line."],
        ["Flexibility", 2, "Moving or changing plans becomes expensive."],
        ["Risk", 6, "Repair, rate and resale risks remain material."]
      ] },
      { option: "Rent until 2030", scores: [
        ["Cash flow", 7, "Lower upfront burden preserves optionality."],
        ["Liquidity", 9, "Capital remains available for investments or emergencies."],
        ["Long-term wealth", 5, "Wealth outcome depends on disciplined investing of the saved capital."],
        ["Flexibility", 9, "Relocation and timing remain easy."],
        ["Risk", 5, "Rent inflation and missed appreciation are the main risks."]
      ] }
    ],
    agency: [
      { option: "AI automation agency", scores: [
        ["Customer urgency", 7, "Workflow pain exists if interviews uncover repeated time loss."],
        ["Acquisition difficulty", 5, "Trust selling requires direct outreach and proof."],
        ["Margin potential", 7, "Margins work after delivery becomes repeatable."],
        ["Scaling constraint", 4, "Founder delivery capacity caps early growth."],
        ["Speed to revenue", 8, "Paid pilots can close before software is built."]
      ] }
    ],
    saas_gtm: [
      { option: "Dental AI SaaS", scores: [
        ["Willingness to pay", 6, "Clinics pay when the workflow maps to revenue or admin hours."],
        ["Onboarding friction", 4, "Clinic workflows require trust and setup help."],
        ["Retention driver", 7, "Recurring workflow pain supports retention if the product runs weekly."],
        ["Acquisition economics", 5, "Founder-led sales works first; paid acquisition waits."],
        ["Churn risk", 6, "Churn rises if the tool feels generic or hard to adopt."]
      ] }
    ],
    local_hospitality: [
      { option: "Specialty coffee shop", scores: [
        ["Location economics", 5, "The lease and foot traffic decide the model."],
        ["Ticket size", 6, "Premium pricing works after repeat demand is proven."],
        ["Operating leverage", 4, "Labor and rent create fixed-cost pressure."],
        ["Seasonality", 5, "Weather and tourism can shift daily demand."],
        ["Break-even risk", 6, "Orders per day must be validated before lease commitment."]
      ] }
    ],
    capital_allocation: [
      { option: "AI agency", scores: [["Expected return", 8, "Highest upside if sales work."], ["Downside", 5, "Loss is capped if capital exposure is small."], ["Liquidity", 8, "Cash stays flexible during validation."], ["Volatility", 6, "Revenue is uneven early."], ["Concentration risk", 6, "Time and focus concentrate in one active bet."]] },
      { option: "ETFs", scores: [["Expected return", 6, "Passive diversified return with no operating burden."], ["Downside", 6, "Market drawdowns remain possible."], ["Liquidity", 9, "Capital remains accessible."], ["Volatility", 5, "Portfolio value moves with markets."], ["Concentration risk", 8, "Diversification reduces single-asset risk."]] },
      { option: "Rental apartment", scores: [["Expected return", 5, "Return depends on price, rent and leverage."], ["Downside", 4, "Repairs and vacancy damage cash flow."], ["Liquidity", 2, "Exit is slow and transaction-heavy."], ["Volatility", 6, "Reported prices move slower than markets."], ["Concentration risk", 3, "One asset dominates the allocation."]] }
    ]
  };
  return cards[archetype] || [{ option: "Test first", scores: [["Decision clarity", 7, "The next evidence sprint can resolve the largest uncertainty."], ["Cost control", 8, "Testing limits downside before commitment."], ["Speed", 7, "A one-week sprint creates usable evidence quickly."]] }];
}

function reasoningChains(archetype) {
  const chains = {
    buy_vs_rent: [
      "Mortgage offer received",
      "Monthly ownership cost calculated",
      "Comparable rent collected",
      "Principal repayment and opportunity cost modeled",
      "Break-even holding period identified",
      "Buy only if holding period exceeds break-even by 18+ months"
    ],
    agency: [
      "Interview identifies repeated workflow pain",
      "Time lost per week quantified",
      "Budget owner confirms willingness to pay",
      "Fixed-scope pilot sold",
      "Delivery steps documented",
      "Scale only after repeatable margin appears"
    ],
    saas_gtm: [
      "Clinic workflow pain selected",
      "Buyer and trigger defined",
      "Landing page promise tested",
      "Demo calls booked from direct outreach",
      "Paid pilots activated",
      "Build product depth after retention signal"
    ],
    local_hospitality: [
      "Candidate street selected",
      "Foot traffic counted by daypart",
      "Ticket size and menu margin modeled",
      "Rent and staffing cost loaded",
      "Break-even orders per day calculated",
      "Lease signed only after demand clears threshold"
    ],
    capital_allocation: [
      "Emergency reserve protected",
      "Passive allocation baseline defined",
      "AI agency experiment capped",
      "Property cash-flow stress tested",
      "Downside compared across options",
      "Capital staged by evidence quality"
    ]
  };
  return chains[archetype] || ["Input defined", "Assumption stated", "Evidence collected", "Threshold tested", "Recommendation updated"];
}

function missingInformationImpact(archetype) {
  const info = {
    buy_vs_rent: [
      ["Second mortgage offer", "High", "High"],
      ["10 local sale comps", "High", "High"],
      ["Building maintenance reserve", "Medium", "Medium"],
      ["Expected holding period", "High", "High"]
    ],
    agency: [
      ["15 customer interviews", "High", "High"],
      ["Paid pilot acceptance", "High", "High"],
      ["Delivery time per workflow", "Medium", "Medium"],
      ["Decision-maker identity", "High", "Medium"]
    ],
    saas_gtm: [
      ["Clinic willingness to pay", "High", "High"],
      ["Landing page conversion", "High", "Medium"],
      ["Onboarding time", "Medium", "Medium"],
      ["Churn trigger interviews", "Medium", "Medium"]
    ],
    local_hospitality: [
      ["Foot traffic counts", "High", "High"],
      ["Lease terms", "High", "High"],
      ["Supplier quotes", "Medium", "Medium"],
      ["Pop-up repeat purchase", "High", "Medium"]
    ],
    capital_allocation: [
      ["Personal runway", "High", "High"],
      ["Risk tolerance", "High", "Medium"],
      ["Paid agency demand", "High", "High"],
      ["Property cash-flow estimate", "Medium", "Medium"]
    ]
  };
  return info[archetype] || [["Primary evidence", "High", "High"], ["Cost threshold", "Medium", "Medium"], ["Decision owner", "Medium", "Medium"]];
}

function contrarianAnalysis(archetype) {
  const views = {
    buy_vs_rent: ["A buyer would argue that Riga property appreciation offsets early cash-flow pain.", "That criticism changes the conclusion only if verified purchase price and mortgage terms create a break-even under six years."],
    agency: ["A skeptic would argue that AI agencies commoditize quickly.", "That criticism changes the conclusion if pilots cannot become repeatable playbooks with recurring retainers."],
    saas_gtm: ["A skeptic would argue dentists do not want another tool.", "That criticism changes the conclusion if onboarding takes more than one short setup session or the workflow lacks weekly usage."],
    local_hospitality: ["A skeptic would argue coffee shops fail from fixed costs, not lack of brand.", "That criticism changes the conclusion unless foot traffic and break-even orders clear the conservative case."],
    capital_allocation: ["A skeptic would argue ETFs beat active experiments after adjusting for time and failure risk.", "That criticism changes the conclusion if the agency test fails to produce paid demand inside 90 days."]
  };
  const view = views[archetype] || ["A skeptic would argue the current evidence is too thin.", "That criticism changes the conclusion if primary evidence contradicts the decision threshold."];
  return { criticism: view[0], effect: view[1] };
}

function dynamicRiskItems(archetype) {
  const risks = {
    buy_vs_rent: [
      { title: "Liquidity lock-in", text: "Transaction costs and down payment reduce flexibility before 2030." },
      { title: "Rate and income shock", text: "Mortgage affordability weakens if payments rise or income falls." },
      { title: "Maintenance surprise", text: "Repairs and building fund costs can erase expected savings." },
      { title: "Opportunity cost", text: "Capital tied in the apartment cannot fund higher-return alternatives." }
    ],
    general: [
      { title: "Evidence gap", text: "The strongest assumption remains unverified." },
      { title: "Execution risk", text: "The plan depends on follow-through, not research quality alone." },
      { title: "Cost drift", text: "Time and money can expand before the decision threshold is reached." },
      { title: "False certainty", text: "A polished report still needs primary evidence before commitment." }
    ]
  };
  return risks[archetype] || risks.general;
}

function buildDynamicSections(data) {
  const archetype = getReportArchetype(data);
  const final = getFinalRecommendation(data);
  const commonRisks = dynamicRiskItems(archetype);
  const evidence = dynamicEvidence(archetype);
  const recs = dynamicRecommendations(archetype, data);
  const scorecards = decisionScorecards(archetype);
  const chain = reasoningChains(archetype);
  const missingInfo = missingInformationImpact(archetype);
  const contrarian = contrarianAnalysis(archetype);

  const sectionSets = {
    buy_vs_rent: [
      makeSection("Decision Summary", "State the decision and current recommendation.", "paragraphs", { paragraphs: [`ResearchAI recommends <strong>${final.decision}</strong>. Buying versus renting in Riga should be decided by verified local costs, holding period and liquidity needs rather than headline property optimism.`] }),
      makeSection("Key Assumptions", "Make the decision variables explicit.", "reasoning", { items: [reasoningItem("The prompt compares buying now with renting until 2030.", "Mortgage rates, rent inflation and maintenance costs materially affect the result.", "The answer can change with only a few local inputs.", "Collect local comps before choosing.", "A lower mortgage rate or unusually cheap apartment would improve the buy case.")] }),
      makeSection("Decision Scorecard", "Score each option with explanations.", "scorecard", { scorecards }),
      makeSection("Reasoning Chain", "Show the logic from input to recommendation.", "reasoning_chain", { steps: chain }),
      makeSection("Buy vs Rent Scenarios", "Compare the realistic paths.", "scenarios", { scenarios: [
        { name: "Buy now", summary: "Useful if price, financing and holding period are attractive.", assumptions: ["Stable income", "Long holding period", "Maintenance buffer"], threshold: "Buy only if total monthly ownership cost and opportunity cost beat renting under conservative assumptions." },
        { name: "Rent until 2030", summary: "Useful if flexibility and liquidity are valuable.", assumptions: ["Rent remains manageable", "Capital can be invested elsewhere", "No urgent lifestyle need to own"], threshold: "Rent if ownership requires optimistic appreciation to win." },
        { name: "Wait 2-3 years", summary: "Useful if rates, prices or personal plans are uncertain.", assumptions: ["Savings continue", "Market supply improves", "No forced move"], threshold: "Wait if better evidence or personal stability is likely soon." }
      ] }),
      makeSection("Break-even Logic", "Show the formula instead of fake market size.", "table", table(["Input", "Why it matters", "Evidence needed"], [
        ["Purchase price + fees", "Sets the initial hurdle", "Sale comps, taxes, notary and broker costs"],
        ["Mortgage payment", "Determines monthly affordability", "Two bank offers"],
        ["Rent avoided", "Main ownership benefit", "Comparable rent listings"],
        ["Maintenance and HOA", "Frequently underestimated", "Building costs and reserve fund"],
        ["Holding period", "Spreads transaction costs", "Personal plan through 2030"]
      ])),
      makeSection("Sensitivity Analysis", "Identify what changes the answer.", "items", { items: [
        { title: "Interest rate sensitivity", text: "A higher rate weakens buying unless price falls enough to compensate." },
        { title: "Rent inflation sensitivity", text: "Fast rent growth improves buying, but only if ownership costs are controlled." },
        { title: "Liquidity sensitivity", text: "Cash needs or mobility needs strengthen the case for renting." }
      ] }),
      makeSection("Risks", "Name the downside cases.", "items", { items: commonRisks }),
      makeSection("Contrarian View", "Test the recommendation against the strongest objection.", "contrarian", { contrarian }),
      makeSection("Missing Information Impact", "Prioritize evidence by decision impact.", "missing_info", { rows: missingInfo }),
      makeSection("Recommended Next Steps", "Make the decision testable.", "recommendations", { recommendations: recs }),
      makeSection("Evidence To Verify", "List exact evidence to collect.", "evidence", { items: evidence }),
      makeSection("Final Recommendation", "Close with a decision.", "final", { finalRecommendation: final })
    ],
    agency: [
      makeSection("Go / No-Go Summary", "Decide whether the agency deserves a test.", "paragraphs", { paragraphs: [`Recommendation: <strong>${final.decision}</strong>. An AI automation agency can be attractive if one customer segment has repeated, measurable workflow pain and will pay for a fixed outcome.`] }),
      makeSection("Target Customer Hypothesis", "Define the first buyer.", "items", { items: [
        { title: "Initial ICP", text: "Choose one vertical such as clinics, accountants, agencies, real estate offices or local service businesses." },
        { title: "Buyer", text: "Target the person who owns time, cost or revenue leakage, not a casual AI enthusiast." },
        { title: "Trigger", text: "Prioritize workflows that already cause missed revenue, slow response time or manual admin overload." }
      ] }),
      makeSection("Workflow Pain Map", "Make the analysis concrete.", "reasoning", { items: [reasoningItem("Small businesses lose time in admin, sales follow-up and reporting.", "They will pay only when the pain is frequent and measurable.", "The offer should sell time saved or revenue recovered, not AI implementation.", "Audit five workflows before pitching.", "Weak pain or unclear ownership should stop the agency idea.")] }),
      makeSection("Decision Scorecard", "Evaluate the agency as a business model.", "scorecard", { scorecards }),
      makeSection("Reasoning Chain", "Show how evidence turns into go/no-go.", "reasoning_chain", { steps: chain }),
      makeSection("Offer Design", "Package one sellable service.", "table", table(["Offer", "What it includes", "Success condition"], [
        ["Workflow audit", "Map current tools, time lost and automation opportunities", "Customer identifies one painful workflow"],
        ["Pilot implementation", "Build one automation with human review and handoff", "Pilot saves time or recovers revenue"],
        ["Monthly retainer", "Monitoring, improvements and support", "Client relies on workflow weekly"]
      ])),
      makeSection("Pricing Model", "Show illustrative economics.", "table", table(["Metric", "Illustrative assumption", "Decision use"], [
        ["Pilot price", "EUR 1,000-3,000", "Tests willingness to pay"],
        ["Retainer", "EUR 300-1,500/mo", "Tests recurring value"],
        ["Capacity", "2-4 pilots/month solo", "Limits early revenue"],
        ["Break-even", "First 2-3 paid pilots", "Validates offer before scaling"]
      ])),
      makeSection("Distribution Plan", "Choose channels that fit trust selling.", "items", { items: [
        { title: "Founder-led outreach", text: "Send specific workflow observations, not generic AI pitches." },
        { title: "Local proof", text: "Use one case study from the same market before broad content marketing." },
        { title: "Partner channel", text: "Accountants, web agencies or IT support firms can introduce workflow problems." }
      ] }),
      makeSection("Contrarian View", "Test the recommendation against the strongest objection.", "contrarian", { contrarian }),
      makeSection("Missing Information Impact", "Prioritize evidence by decision impact.", "missing_info", { rows: missingInfo }),
      makeSection("Validation Plan", "Concrete next steps.", "recommendations", { recommendations: recs }),
      makeSection("Evidence To Verify", "List exact evidence to collect.", "evidence", { items: evidence }),
      makeSection("Final Recommendation", "Close with a decision.", "final", { finalRecommendation: final })
    ],
    saas_gtm: [
      makeSection("Positioning", "Define the wedge.", "paragraphs", { paragraphs: [`Position this as a dental workflow product, not a broad AI tools platform. The strongest wedge is likely one costly clinic problem such as missed calls, no-shows, intake admin or follow-up.`] }),
      makeSection("ICP", "Identify the first customer.", "items", { items: [
        { title: "Primary buyer", text: "Independent dental clinic owner or office manager." },
        { title: "Pain threshold", text: "At least several hours per week lost or measurable missed revenue." },
        { title: "Buying trigger", text: "Staff overload, missed calls, no-shows or slow patient follow-up." }
      ] }),
      makeSection("Pain Points", "Translate pain into product demand.", "reasoning", { items: [reasoningItem("Dental teams run on phone, calendar and manual admin workflows.", "They will not buy generic AI; they buy fewer missed bookings or less admin burden.", "The first product promise should be narrow and measurable.", "Validate one workflow before building a toolkit.", "If clinics will not quantify the problem, the GTM should pause.")] }),
      makeSection("Decision Scorecard", "Evaluate the SaaS GTM bet.", "scorecard", { scorecards }),
      makeSection("Reasoning Chain", "Show the path from pain to retention.", "reasoning_chain", { steps: chain }),
      makeSection("Channel Strategy", "Select first channels.", "table", table(["Channel", "Why it works", "Test"], [
        ["Direct outreach", "Specific clinic problems can be personalized", "50 clinics, 10 replies, 5 calls"],
        ["Dental communities", "Trust and peer proof matter", "Post one practical workflow teardown"],
        ["Referral partners", "IT/web vendors already serve clinics", "Secure two partner conversations"]
      ])),
      makeSection("Offer & Pricing", "Use assumptions visibly.", "table", table(["Hypothesis", "Illustrative assumption", "What validates it"], [
        ["Starter price", "EUR 99-299/mo", "Clinics accept price for one workflow"],
        ["Conversion", "5-10% from qualified demos", "Demos produce paid pilots"],
        ["Payback", "Founder-led sales first", "CAC stays mostly time-based"],
        ["Main sensitivity", "Urgency of the workflow pain", "Problem appears weekly, not occasionally"]
      ])),
      makeSection("Competitor Alternatives", "Map substitutes.", "table", table(["Alternative", "Why clinics use it", "Weakness"], [
        ["Manual admin", "Known and low cash cost", "Time loss and inconsistency"],
        ["Practice management software", "System of record", "Leaves the AI workflow layer unresolved"],
        ["Generic AI tools", "Flexible", "No clinic-specific workflow ownership"]
      ])),
      makeSection("Contrarian View", "Test the recommendation against the strongest objection.", "contrarian", { contrarian }),
      makeSection("Missing Information Impact", "Prioritize evidence by decision impact.", "missing_info", { rows: missingInfo }),
      makeSection("30-Day Launch Plan", "Make GTM executable.", "recommendations", { recommendations: recs }),
      makeSection("Evidence To Verify", "List exact evidence to collect.", "evidence", { items: evidence }),
      makeSection("Final Recommendation", "Close with a decision.", "final", { finalRecommendation: final })
    ],
    local_hospitality: [
      makeSection("Decision Summary", "Decide whether to proceed.", "paragraphs", { paragraphs: [`Recommendation: <strong>${final.decision}</strong>. A specialty coffee shop should be treated as a location and unit-economics decision before brand or design decisions.`] }),
      makeSection("Demand Hypothesis", "Define what must be true.", "reasoning", { items: [reasoningItem("A coffee shop depends on repeat local behavior.", "Foot traffic and repeat purchase matter more than broad category growth.", "The concept works only if daily volume covers rent, labor and waste.", "Test the location and menu before signing a lease.", "Weak repeat demand should stop the project.")] }),
      makeSection("Decision Scorecard", "Evaluate the shop as a local operating model.", "scorecard", { scorecards }),
      makeSection("Reasoning Chain", "Show how site economics drive the decision.", "reasoning_chain", { steps: chain }),
      makeSection("Location Economics", "Show the model inputs.", "table", table(["Input", "Why it matters", "Evidence needed"], [
        ["Daily orders", "Main revenue driver", "Foot traffic counts and competitor observation"],
        ["Average order value", "Determines revenue per visit", "Menu pricing and bundle tests"],
        ["Rent + utilities", "Largest fixed burden", "Lease quote and service charges"],
        ["Labor", "Controls service quality and margin", "Staffing plan by daypart"],
        ["Waste", "Erodes food and beverage margin", "Menu complexity and supplier terms"]
      ])),
      makeSection("Break-even Scenarios", "Make numbers illustrative and testable.", "scenarios", { scenarios: [
        { name: "Conservative", summary: "Lower foot traffic, slower repeat purchase.", assumptions: ["Small menu", "Owner involvement", "Tight labor"], threshold: "Proceed only if rent remains manageable." },
        { name: "Base case", summary: "Steady morning and weekend demand.", assumptions: ["Reliable repeat customers", "Clear premium positioning"], threshold: "Requires daily orders to cover fixed cost with margin." },
        { name: "Upside", summary: "Strong local habit and brand pull.", assumptions: ["High repeat rate", "Events or partnerships"], threshold: "Use only after proof, not before lease." }
      ] }),
      makeSection("Contrarian View", "Test the recommendation against the strongest objection.", "contrarian", { contrarian }),
      makeSection("Missing Information Impact", "Prioritize evidence by decision impact.", "missing_info", { rows: missingInfo }),
      makeSection("Validation Plan", "Concrete next steps.", "recommendations", { recommendations: recs }),
      makeSection("Evidence To Verify", "List exact evidence to collect.", "evidence", { items: evidence }),
      makeSection("Final Recommendation", "Close with a decision.", "final", { finalRecommendation: final })
    ],
    capital_allocation: [
      makeSection("Decision Summary", "Compare allocation paths.", "paragraphs", { paragraphs: [`Recommendation: <strong>${final.decision}</strong>. Do not treat AI agency, ETFs and rental property as interchangeable; they differ in effort, liquidity, downside and learning value.`] }),
      makeSection("Option Comparison", "Compare choices directly.", "table", table(["Option", "Upside", "Main risk", "Best if"], [
        ["AI agency", "High learning and income upside", "Execution and sales risk", "You can sell and deliver pilots"],
        ["ETFs", "Diversified passive exposure", "Market volatility", "You value simplicity and liquidity"],
        ["Rental apartment", "Asset ownership and rental income", "Concentration and repair risk", "You have enough capital and local deal evidence"]
      ])),
      makeSection("Decision Scorecard", "Evaluate each capital option.", "scorecard", { scorecards }),
      makeSection("Reasoning Chain", "Show how capital moves from safety to upside.", "reasoning_chain", { steps: chain }),
      makeSection("Financial Logic", "Use explicit assumptions.", "table", table(["Variable", "Question to answer", "Decision effect"], [
        ["Runway", "How much cash must remain untouched?", "Sets investable amount"],
        ["Time horizon", "When do you need the money?", "Controls ETF/property suitability"],
        ["Agency capacity", "Can you sell and deliver?", "Controls active-business upside"],
        ["Property leverage", "Can EUR 20,000 safely support purchase costs?", "Can rule out property"]
      ])),
      makeSection("Sensitivity Analysis", "What changes the answer.", "items", { items: [
        { title: "Liquidity need", text: "ETFs and cash reserve become more attractive than property." },
        { title: "If you can sell services", text: "A small AI agency experiment can have asymmetric learning and revenue upside." },
        { title: "If property requires leverage stress", text: "Rental apartment should wait until capital and deal evidence improve." }
      ] }),
      makeSection("Contrarian View", "Test the recommendation against the strongest objection.", "contrarian", { contrarian }),
      makeSection("Missing Information Impact", "Prioritize evidence by decision impact.", "missing_info", { rows: missingInfo }),
      makeSection("90-Day Test Plan", "Concrete next steps.", "recommendations", { recommendations: recs }),
      makeSection("Evidence To Verify", "List exact evidence to collect.", "evidence", { items: evidence }),
      makeSection("Final Recommendation", "Close with a decision.", "final", { finalRecommendation: final })
    ],
    general: [
      makeSection("Decision Summary", "Frame the decision.", "paragraphs", { paragraphs: [`Recommendation: <strong>${final.decision}</strong>. The report should be used to identify what is already clear, what is assumed and what evidence would change the conclusion.`] }),
      makeSection("Reasoning Snapshot", "Show transparent reasoning.", "reasoning", { items: [reasoningItem("The prompt asks for structured guidance.", "Some context is missing and should be verified.", "A first draft is useful if it leads to specific evidence collection.", "Run a short validation sprint.", "New evidence updates the recommendation.")] }),
      makeSection("Decision Scorecard", "Score the current decision quality.", "scorecard", { scorecards }),
      makeSection("Reasoning Chain", "Show the logic from question to test.", "reasoning_chain", { steps: chain }),
      makeSection("Risks", "Name the downside cases.", "items", { items: commonRisks }),
      makeSection("Contrarian View", "Test the recommendation against the strongest objection.", "contrarian", { contrarian }),
      makeSection("Missing Information Impact", "Prioritize evidence by decision impact.", "missing_info", { rows: missingInfo }),
      makeSection("Recommendations", "Concrete next steps.", "recommendations", { recommendations: recs }),
      makeSection("Evidence To Verify", "List exact evidence to collect.", "evidence", { items: evidence }),
      makeSection("Final Recommendation", "Close with a decision.", "final", { finalRecommendation: final })
    ]
  };

  return sectionSets[archetype] || sectionSets.general;
}

function renderDynamicSection(section) {
  if (!section || !section.title) return "";
  const id = slugifyId(section.id || section.title || "section");
  const purpose = section.purpose ? `<span>${escapeHtml(section.purpose)}</span>` : "";
  let body = "";
  const safeParagraph = value => escapeHtml(value)
    .replace(/&lt;strong&gt;/g, "<strong>")
    .replace(/&lt;\/strong&gt;/g, "</strong>");

  if (section.layoutType === "paragraphs") {
    body = (section.paragraphs || []).map(p => `<div class="executive-brief"><p>${safeParagraph(p)}</p></div>`).join("");
  } else if (section.layoutType === "items") {
    body = `<ul class="signal-list">${(section.items || []).map(item => signalItem(item.title, item.text)).join("")}</ul>`;
  } else if (section.layoutType === "reasoning") {
    body = `<div class="insight-grid">${(section.items || []).map(item => insightCard("Observed", item.observed) + insightCard("Assumed", item.assumed) + insightCard("Implication", item.implication) + insightCard("Recommendation", item.recommendation) + insightCard("What would change this", item.change)).join("")}</div>`;
  } else if (section.layoutType === "reasoning_chain") {
    const steps = section.steps || [];
    body = `<div class="reasoning-chain">${steps.map((step, i) => reasoningStep(step, i, steps.length)).join("")}</div>`;
  } else if (section.layoutType === "scorecard") {
    body = `<div class="scorecard-grid">${(section.scorecards || []).map(scorecardCard).join("")}</div>`;
  } else if (section.layoutType === "table") {
    const headers = section.headers || [];
    const rows = section.rows || [];
    body = `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  } else if (section.layoutType === "scenarios") {
    body = `<div class="insight-grid">${(section.scenarios || []).map(scenario => insightCard(scenario.name, [
      ["Summary", scenario.summary],
      ["Assumptions", (scenario.assumptions || []).join("; ")],
      ["Decision threshold", scenario.threshold]
    ])).join("")}</div>`;
  } else if (section.layoutType === "recommendations") {
    body = `<div class="recommendation-list">${(section.recommendations || []).map(recommendationStep).join("")}</div>`;
  } else if (section.layoutType === "evidence") {
    body = `<ul class="signal-list">${(section.items || []).map(item => signalItem(item, "Collect and verify this before making the decision.")).join("")}</ul>`;
  } else if (section.layoutType === "missing_info") {
    body = `<div class="table-wrap"><table><thead><tr><th>Missing evidence</th><th>Expected impact</th><th>Chance of changing recommendation</th></tr></thead><tbody>${(section.rows || []).map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  } else if (section.layoutType === "contrarian") {
    body = `<div class="insight-grid">${insightCard("Strongest objection", section.contrarian?.criticism || "The current recommendation depends on unverified evidence.")}${insightCard("Does it change the conclusion?", section.contrarian?.effect || "It changes the conclusion only if evidence crosses the stated thresholds.")}</div>`;
  } else if (section.layoutType === "final") {
    const final = section.finalRecommendation || {};
    body = `<div class="confidence-grid final-grid">
      ${insightCard("Decision", final.decision || "Test first")}
      ${insightCard("Confidence", final.confidence || "66%")}
      ${insightCard("Biggest assumption", final.biggestAssumption || "The strongest assumption still needs verification.")}
      ${insightCard("This recommendation reverses if", final.reverseConditions || ["Primary evidence contradicts the core assumption."])}
      ${insightCard("Limited because", final.confidenceLimits || ["Primary evidence has not been collected."])}
      ${insightCard("Confidence improves when", final.confidenceUpside || "The highest-impact evidence is verified.")}
      ${insightCard("Next verification step", final.nextStep || "Collect the evidence most likely to change the decision.")}
      ${insightCard("Time horizon", final.deadline || "Set a deadline before committing resources.")}
      ${insightCard("Risk if wrong", final.riskIfWrong || "Resources move before uncertainty is reduced.")}
    </div>`;
  }

  if (!body.trim()) return "";

  return `
    <section class="report-section" id="${id}">
      <div class="section-title">
        <div>
          <p class="section-kicker">${escapeHtml(section.title)}</p>
          <h2>${escapeHtml(section.title)}</h2>
        </div>
        ${purpose}
      </div>
      ${body}
    </section>`;
}

function buildDynamicReportHTML(data) {
  const sections = (data.sections || []).filter(section => section && section.title);
  const final = data.finalRecommendation || getFinalRecommendation(data);

  return `
    <section class="report-hero" id="summary">
      <p class="eyebrow"><span aria-hidden="true"></span> Research report</p>
      <h1 id="reportMainTitle">${escapeHtml(data.title)}</h1>
      <p id="reportQuestion">Research question: "${escapeHtml(data.prompt)}"</p>
      <div class="report-stats">
        <div><strong>${escapeHtml(final.decision || "Draft")}</strong><span>Decision</span></div>
        <div><strong>${sections.length}</strong><span>Sections</span></div>
        <div><strong>${escapeHtml(final.confidence || "Medium")}</strong><span>Confidence</span></div>
        <div><strong>${escapeHtml(data.launchWindow || "30 days")}</strong><span>Time horizon</span></div>
      </div>
    </section>
    ${sections.map(renderDynamicSection).join("")}`;
}

function buildReportHTML(data) {
  if (Array.isArray(data.sections) && data.sections.length) {
    return buildDynamicReportHTML(data);
  }

  const findingsHtml = data.findings.map(([t, p]) => insightCard(t, p)).join("");
  const advantagesHtml = data.advantages.map(([t, p]) => signalItem(t, p)).join("");
  const disadvantagesHtml = data.disadvantages.map(([t, p]) => signalItem(t, p)).join("");
  const risksHtml = data.risks.map(([t, p]) => signalItem(t, p)).join("");
  const barsHtml = data.bars.map(([l, v]) => barRow(l, v)).join("");
  const segmentHtml = data.segmentBars.map(([l, v]) => barRow(l, v)).join("");
  const financialHtml = data.financial.map(([t, p]) => insightCard(t, p)).join("");
  const actionsHtml = data.actions.map(([t, p], i) =>
    `<div><span>${i + 1}</span><strong>${escapeHtml(t)}</strong><p>${escapeHtml(p)}</p></div>`
  ).join("");
  const sourcesHtml = data.sources.map(([t, p]) => insightCard(t, p)).join("");
  const limitationsHtml = (data.limitations || []).map(([t, p]) => insightCard(t, p)).join("");
  const competitorRows = comparisonRows(data.competitors);
  const competitorsHtml = competitorRows.map(([a, b, c, d]) =>
    `<tr><td>${escapeHtml(a)}</td><td>${escapeHtml(b)}</td><td>${escapeHtml(c)}</td><td>${escapeHtml(d)}</td></tr>`
  ).join("");
  const competitorFallbackHtml = `<tr><td colspan="4">No structured comparison rows are available in this report.</td></tr>`;
  const representativeHtml = representativeAlternatives(data).length
    ? `<p>Representative alternatives include:</p>
      <ul class="signal-list">
        ${representativeAlternatives(data).map(([name, context]) => signalItem(name, context || "Review this alternative during source verification.")).join("")}
      </ul>`
    : "";

  return `
    <section class="report-hero" id="summary">
      <p class="eyebrow"><span aria-hidden="true"></span> Research report</p>
      <h1 id="reportMainTitle">${escapeHtml(data.title)}</h1>
      <p id="reportQuestion">Research question: "${escapeHtml(data.prompt)}"</p>
      <div class="report-stats">
        <div><strong>Draft</strong><span>Estimate type</span></div>
        <div><strong>12</strong><span>Sections</span></div>
        <div><strong>${data.signals}</strong><span>Signals</span></div>
        <div><strong>${data.launchWindow}</strong><span>Execution window</span></div>
      </div>
    </section>

    <section class="report-section executive-section" id="executive">
      <div class="section-title">
        <div>
          <p class="section-kicker">Executive Summary</p>
          <h2>What matters most</h2>
        </div>
        <span>Draft analysis</span>
      </div>
      <div class="executive-brief">
        <p>${data.executive}</p>
      </div>
      <div class="insight-grid">
        ${insightCard("Strategic thesis", data.thesis)}
        ${insightCard("Best customer", data.customer)}
        ${insightCard("Monetization", data.monetization)}
      </div>
    </section>

    <section class="report-section" id="findings">
      <div class="section-title">
        <div>
          <p class="section-kicker">Key Findings</p>
          <h2>Signals worth reviewing first</h2>
        </div>
        <span>Structured estimate</span>
      </div>
      <div class="insight-grid">${findingsHtml}</div>
    </section>

    <section class="report-section" id="analysis">
      <div class="section-title">
        <div>
          <p class="section-kicker">Analysis</p>
          <h2>Context and decision logic</h2>
        </div>
        <span>Prompt-based</span>
      </div>
      <p>
        This analysis of <strong>${escapeHtml(data.topic)}</strong> evaluates market dynamics,
        competitive positioning, and execution feasibility. Scores below reflect estimated
        illustrative signals derived from your prompt. Verify critical assumptions with primary data before making decisions.
      </p>
      <div class="chart-card">${barsHtml}</div>
    </section>

    <section class="report-section split" id="tradeoffs">
      <div>
        <div class="section-title"><div><p class="section-kicker">Upside</p><h2>Advantages</h2></div></div>
        <ul class="signal-list positive">${advantagesHtml}</ul>
      </div>
      <div>
        <div class="section-title"><div><p class="section-kicker">Constraints</p><h2>Disadvantages</h2></div></div>
        <ul class="signal-list warning">${disadvantagesHtml}</ul>
      </div>
    </section>

    <section class="report-section" id="risks">
      <div class="section-title">
        <div>
          <p class="section-kicker">Risks & Assumptions</p>
          <h2>What changes the conclusion</h2>
        </div>
        <span>Needs review</span>
      </div>
      <ul class="signal-list risk">${risksHtml}</ul>
    </section>

    <section class="report-section" id="market">
      <div class="section-title">
        <div>
          <p class="section-kicker">Market Context</p>
          <h2>Estimated opportunity shape</h2>
        </div>
        <span>${escapeHtml(data.demand)} signal</span>
      </div>
      <p>
        Estimated total addressable market for <strong>${escapeHtml(data.topic)}</strong> is
        approximately <strong>${data.marketSize}</strong>, with ${comparisonCount(data)} representative
        competitors identified. Demand appears <strong>${data.demand.toLowerCase()}</strong>
        based on category benchmarks and search intent patterns.
      </p>
      ${representativeHtml}
      <div class="chart-card">${segmentHtml}</div>
    </section>

    <section class="report-section" id="competitors">
      <div class="section-title">
        <div>
          <p class="section-kicker">Competitive Review</p>
          <h2>Alternatives and positioning gaps</h2>
        </div>
        <span>Opportunity mapped</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Category</th><th>Current Experience</th><th>Weakness</th><th>Opportunity</th></tr>
          </thead>
          <tbody>${competitorsHtml || competitorFallbackHtml}</tbody>
        </table>
      </div>
    </section>

    <section class="report-section" id="financial">
      <div class="section-title">
        <div>
          <p class="section-kicker">Estimates</p>
          <h2>Financial perspective</h2>
        </div>
        <span>Model estimate</span>
      </div>
      <div class="insight-grid">${financialHtml}</div>
      <p class="report-disclaimer">Figures are illustrative estimates. Not financial advice.</p>
    </section>

    <section class="report-section" id="action">
      <div class="section-title">
        <div>
          <p class="section-kicker">Recommendations</p>
          <h2>Prioritized next actions</h2>
        </div>
        <span>Next 90 days</span>
      </div>
      <div class="timeline">${actionsHtml}</div>
    </section>

    <section class="report-section" id="sources">
      <div class="section-title">
        <div>
          <p class="section-kicker">Source Guidance</p>
          <h2>Recommended evidence to verify</h2>
        </div>
        <span>Evidence guidance</span>
      </div>
      <div class="insight-grid">${sourcesHtml}</div>
      <p class="report-disclaimer">This report suggests source categories only. Verify material claims against primary sources before acting.</p>
    </section>

    <section class="report-section confidence-section" id="confidence">
      <div class="section-title">
        <div>
          <p class="section-kicker">Confidence & Limitations</p>
          <h2>How to interpret this draft</h2>
        </div>
        <span>Transparent limits</span>
      </div>
      <div class="confidence-grid">${limitationsHtml}</div>
    </section>`;
}

function getTreeSections(data) {
  if (Array.isArray(data?.sections) && data.sections.length) {
    return [
      ["summary", "Cover"],
      ...data.sections
        .filter(section => section && section.title)
        .map(section => [section.id || slugifyId(section.title), section.title])
    ];
  }

  return [
    ["summary", "Cover"],
    ["executive", "Executive"],
    ["findings", "Findings"],
    ["analysis", "Analysis"],
    ["tradeoffs", "Trade-offs"],
    ["risks", "Risks"],
    ["market", "Market"],
    ["competitors", "Competitors"],
    ["financial", "Financial"],
    ["action", "Recommendations"],
    ["sources", "Sources"],
    ["confidence", "Limitations"]
  ];
}

function buildTreeNav(data = currentReport) {
  const sections = getTreeSections(data);

  els.treeNav.innerHTML = sections.map(([id, label], i) => {
    const safeId = slugifyId(id || label || `section-${i + 1}`);
    return `<a class="tree-link${i === 0 ? " active" : ""}" href="#${safeId}"><span>${i + 1}</span><b>${escapeHtml(label)}</b><em aria-hidden="true"></em></a>`;
  }).join("");
}

function applyBarWidths(container) {
  container.querySelectorAll("[data-width]").forEach(bar => {
    bar.style.setProperty("--bar-width", `${bar.dataset.width}%`);
    bar.classList.remove("bar-filled");
  });
  requestAnimationFrame(() => {
    container.querySelectorAll("[data-width]").forEach(bar => {
      bar.classList.add("bar-filled");
    });
  });
}

function renderReport(data) {
  currentReport = normalizeReport(data);
  currentPrompt = currentReport.prompt;
  els.reportContent.innerHTML = buildReportHTML(currentReport);
  applyBarWidths(els.reportContent);

  els.reportTopTitle.textContent = currentReport.title;
  els.reportMeta.textContent = `Generated ${relativeTime(currentReport.createdAt)} - 12 sections - draft estimates`;
  els.metricConfidence.textContent = "Draft";
  els.metricDepth.textContent = "Professional";

  buildTreeNav(currentReport);
  setupSectionObserver();
  updateFavoriteButton();
  showReportContent(true);
}

function showReportContent(hasReport) {
  els.reportEmpty.hidden = hasReport;
  els.reportLayout.hidden = !hasReport;
}

/* -- UI helpers -- */

function showView(name) {
  Object.values(views).forEach(view => view.classList.remove("active"));
  views[name].classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });

  document.querySelectorAll("[data-view]").forEach(el => {
    if (el.dataset.view) {
      el.classList.toggle("active", el.dataset.view === name);
    }
  });

  if (name === "report") {
    if (currentReport) {
      showReportContent(true);
    } else {
      const reports = getReports();
      if (reports.length) {
        renderReport(reports[0]);
      } else {
        showReportContent(false);
      }
    }
  }

  closeSidebar();
}

function showToast(message, type) {
  els.toast.textContent = message;
  els.toast.className = `toast show${type ? ` toast-${type}` : ""}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove("show");
  }, 3200);
}

function setCheckoutLoading(isLoading) {
  if (!els.proCheckoutBtn) return;
  els.proCheckoutBtn.disabled = isLoading;
  els.proCheckoutBtn.textContent = isLoading ? "Opening Stripe..." : "Upgrade to Pro";
}

function getCheckoutStatus() {
  try {
    return new URLSearchParams(window.location.search).get("checkout");
  } catch {
    return "";
  }
}

async function reloadClerkUser() {
  if (!authState.clerk?.user?.reload) {
    updateAuthStateFromClerk();
    console.log("[ResearchAI] Clerk user reloaded", false);
    return;
  }

  await authState.clerk.user.reload();
  console.log("[ResearchAI] Clerk user reloaded", true);
  updateAuthStateFromClerk();
}

async function handleCheckoutReturn() {
  const status = getCheckoutStatus();
  if (status === "success") {
    await reloadClerkUser();
    await refreshServerUsage();
    showToast("Payment received. Pro account activation will be completed after account setup.");
  } else if (status === "cancelled") {
    showToast("Checkout cancelled. You can upgrade to Pro anytime.", "info");
  }

  const billingStatus = getBillingReturnStatus();
  if (billingStatus === "returned") {
    await reloadClerkUser();
    await refreshServerUsage();
    showToast("Billing details refreshed.");
  }
}

async function startProCheckout() {
  if (!els.proCheckoutBtn) return;

  if (!authState.signedIn) {
    showToast("Sign in or create an account before upgrading to Pro.", "info");
    openSignIn();
    return;
  }

  setCheckoutLoading(true);

  try {
    const token = await getClerkSessionToken();
    if (!token) {
      throw new Error("Authentication session is not ready.");
    }

    const response = await fetch(researchAIConfig.api.checkoutEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        userId: authState.userId,
        email: authState.email
      })
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || payload?.ok === false || !payload?.url) {
      throw new Error(payload?.error?.message || "Checkout could not be started.");
    }

    window.location.href = payload.url;
  } catch (error) {
    console.error("[ResearchAI] checkout failed:", error);
    showToast("Checkout is temporarily unavailable. Please try again soon.", "warn");
    setCheckoutLoading(false);
  }
}

function getBillingReturnStatus() {
  try {
    return new URLSearchParams(window.location.search).get("billing");
  } catch {
    return "";
  }
}

async function startBillingPortal() {
  if (!authState.signedIn) {
    showToast("Sign in to manage billing.", "info");
    openSignIn();
    return;
  }

  if (!isProUser()) {
    showToast("Billing Portal is available for Pro subscribers.", "info");
    return;
  }

  const button = document.getElementById("manageBillingBtn");
  if (button) {
    button.disabled = true;
    button.textContent = "Opening billing...";
  }

  try {
    const payload = await authenticatedApi(researchAIConfig.api.billingPortalEndpoint, {
      method: "POST",
      body: JSON.stringify({})
    });

    if (!payload?.url) {
      throw new Error("Billing Portal URL was not returned.");
    }

    window.location.href = payload.url;
  } catch (error) {
    console.error("[ResearchAI] billing portal failed:", error);
    showToast(error.message || "Billing Portal is temporarily unavailable.", "warn");
    if (button) {
      button.disabled = false;
      button.textContent = "Manage Subscription";
    }
  }
}

function showInputError(message) {
  els.inputError.textContent = message;
  els.inputError.hidden = !message;
  els.researchInput.classList.toggle("has-error", Boolean(message));
  els.researchInput.setAttribute("aria-invalid", message ? "true" : "false");
}

function setPrompt(prompt) {
  currentPrompt = prompt.trim();
  els.researchInput.value = currentPrompt;
  showInputError("");
  updatePreview(currentPrompt);
}

function updatePreview(prompt) {
  if (!prompt.trim()) {
    els.previewTitle.textContent = "Your Research Topic";
    els.previewScore.textContent = "-";
    els.previewScore.setAttribute("aria-label", "Report preview not available yet");
    els.previewMarket.textContent = "$-";
    els.previewCompetitors.textContent = "-";
    els.previewDemand.textContent = "-";
    els.previewWindow.textContent = "-";
    return;
  }

  const data = reportController.createPreview(prompt);
  els.previewTitle.textContent = data.title;
  els.previewScore.textContent = "Draft";
  els.previewScore.setAttribute("aria-label", `Draft completeness preview using ${data.confidence} percent decorative completeness`);
  els.previewScore.style.setProperty("--score-pct", `${data.confidence}%`);
  els.previewMarket.textContent = data.marketSize;
  els.previewCompetitors.textContent = String(comparisonCount(data));
  els.previewDemand.textContent = data.demand;
  els.previewWindow.textContent = data.launchWindow;
}

function renderRecentReports() {
  const reports = getReports().slice(0, 5);

  if (!reports.length) {
    els.recentEmpty.hidden = false;
    els.continueCard.hidden = true;
    continuePrompt = "";
    els.recentReportsList.querySelectorAll(".report-row").forEach(el => el.remove());
    return;
  }

  els.recentEmpty.hidden = true;
  els.recentReportsList.querySelectorAll(".report-row").forEach(el => el.remove());

  reports.forEach(report => {
    const row = document.createElement("div");
    row.className = `report-row${report.pinned ? " pinned" : ""}`;
    row.innerHTML = `
      <span>${escapeHtml(initials(report.title))}</span>
      <div>
        <strong>${escapeHtml(report.title)}</strong>
        <p>${escapeHtml(formatReportType(report))} - ${Array.isArray(report.sections) ? report.sections.length : 12} sections - ${relativeTime(report.createdAt)}${report.pinned ? " - pinned" : ""}</p>
      </div>
      <div class="report-row-actions">
        <button type="button" data-action="open" aria-label="Open ${escapeHtml(report.title)}">Open</button>
        <button type="button" data-action="pin" aria-label="${report.pinned ? "Unpin" : "Pin"} ${escapeHtml(report.title)}">${report.pinned ? "Unpin" : "Pin"}</button>
        <button type="button" data-action="delete" aria-label="Delete ${escapeHtml(report.title)}">Delete</button>
      </div>`;
    row.addEventListener("click", e => {
      const action = e.target.closest("[data-action]")?.dataset.action || "open";
      if (action === "delete") {
        deleteReport(report.id);
        return;
      }
      if (action === "pin") {
        toggleReportPin(report.id);
        return;
      }
      renderReport(report);
      showView("report");
    });
    els.recentReportsList.appendChild(row);
  });

  const latest = reports[0];
  els.continueCard.hidden = false;
  continuePrompt = latest.prompt;
  els.continueText.textContent = `Continue "${latest.title}" with deeper pricing, competitors and assumptions.`;
}

async function saveReport(data) {
  const reports = getReports();
  const entry = normalizeReport({
    ...data,
    id: hashCode(data.prompt + Date.now()),
    createdAt: new Date().toISOString(),
    reportType: data.intent || data.category || "general_research",
    contentHtml: "",
    pinned: false,
    favorite: false
  });

  if (authState.signedIn && !isDeveloperMode()) {
    const payload = await authenticatedApi(researchAIConfig.api.reportsEndpoint, {
      method: "POST",
      body: JSON.stringify({
        report: entry,
        countUsage: !data._usageCounted
      })
    });
    if (Array.isArray(payload.reports)) {
      cacheServerReports(payload.reports);
    } else if (payload.report) {
      saveReports([payload.report, ...reports.filter(report => report.id !== payload.report.id)]);
    }
    applyServerUsage(payload.usage);
    renderRecentReports();
    return normalizeReport(payload.report || entry);
  }

  reports.unshift(entry);
  saveReports(reports);
  renderRecentReports();
  return entry;
}

function formatReportType(report) {
  return String(report.reportType || report.intent || report.category || "general_research")
    .replace(/_/g, " ")
    .replace(/\b\w/g, ch => ch.toUpperCase());
}

function updateFavoriteButton() {
  if (!currentReport) return;
  const pinned = Boolean(currentReport.pinned || currentReport.favorite);
  els.favoriteReport.textContent = pinned ? "* Pinned" : "* Pin";
  els.favoriteReport.setAttribute("aria-label", pinned ? "Unpin report" : "Pin report");
  els.favoriteReport.classList.toggle("is-favorite", pinned);
}

async function toggleReportPin(id) {
  const reports = getReports();
  const idx = reports.findIndex(r => r.id === id);
  if (idx === -1) return;

  reports[idx].pinned = !reports[idx].pinned;
  reports[idx].favorite = reports[idx].pinned;
  if (currentReport && currentReport.id === id) {
    currentReport.pinned = reports[idx].pinned;
    currentReport.favorite = reports[idx].pinned;
  }
  saveReports(reports);
  if (authState.signedIn && !isDeveloperMode()) {
    authenticatedApi(researchAIConfig.api.reportsEndpoint, {
      method: "PATCH",
      body: JSON.stringify({ id: String(id), pinned: reports[idx].pinned })
    }).then(payload => {
      if (Array.isArray(payload.reports)) {
        cacheServerReports(payload.reports);
        renderRecentReports();
      }
    }).catch(error => {
      console.warn("[ResearchAI] pin sync unavailable:", error);
    });
  }
  updateFavoriteButton();
  renderRecentReports();
  showToast(reports[idx].pinned ? "Report pinned" : "Report unpinned");
}

async function deleteReport(id) {
  const reports = getReports();
  const report = reports.find(r => r.id === id);
  const nextReports = reports.filter(r => r.id !== id);
  saveReports(nextReports);
  if (authState.signedIn && !isDeveloperMode()) {
    authenticatedApi(researchAIConfig.api.reportsEndpoint, {
      method: "DELETE",
      body: JSON.stringify({ id: String(id) })
    }).then(payload => {
      if (Array.isArray(payload.reports)) {
        cacheServerReports(payload.reports);
        renderRecentReports();
      }
    }).catch(error => {
      console.warn("[ResearchAI] delete sync unavailable:", error);
    });
  }
  if (currentReport && currentReport.id === id) {
    currentReport = nextReports[0] || null;
    if (currentReport) renderReport(currentReport);
    else showReportContent(false);
  }
  renderRecentReports();
  showToast(report ? `Deleted "${report.title}"` : "Report deleted");
}

function toggleFavorite() {
  if (!currentReport) return;
  toggleReportPin(currentReport.id);
}

/* -- Research flow -- */

function startResearch() {
  const prompt = els.researchInput.value.trim();

  if (!prompt) {
    showInputError("Enter a research question to generate your report.");
    els.researchInput.focus();
    return;
  }

  if (prompt.length < 8) {
    showInputError("Please enter a more detailed question (at least 8 characters).");
    els.researchInput.focus();
    return;
  }

  if (!isDeveloperMode() && !authState.signedIn) {
    showToast("Sign in to generate and save reports across devices.", "info");
    openSignIn();
    return;
  }

  showInputError("");
  currentPrompt = prompt;
  els.loadingPrompt.textContent = researchAIConfig.generationMode === "gemini"
    ? `Preparing a live AI report for "${prompt}". If live AI is unavailable, ResearchAI will show a local sample report instead.`
    : `Building a local sample report for "${prompt}". Live source verification is not being performed.`;

  showView("loading");

  let progress = 0;
  els.loadingSteps.forEach((step, index) => {
    step.classList.toggle("active", index === 0);
    step.classList.remove("done");
  });

  els.progressBar.style.width = "0%";
  els.progressValue.textContent = "0%";
  els.progressLabel.textContent = loadingLabels[0];
  els.progressTrack.setAttribute("aria-valuenow", "0");

  if (loadingInterval) clearInterval(loadingInterval);

  loadingInterval = setInterval(() => {
    progress += Math.floor(Math.random() * 7) + 4;
    progress = Math.min(progress, 100);

    const activeStep = Math.min(loadingLabels.length - 1, Math.floor(progress / 12.5));

    els.progressBar.style.width = `${progress}%`;
    els.progressValue.textContent = `${progress}%`;
    els.progressLabel.textContent = loadingLabels[activeStep];
    els.progressTrack.setAttribute("aria-valuenow", String(progress));

    els.loadingSteps.forEach((step, index) => {
      step.classList.toggle("active", index === activeStep);
      step.classList.toggle("done", index < activeStep);
    });

    if (progress >= 100) {
      clearInterval(loadingInterval);
      loadingInterval = null;

      els.loadingSteps.forEach(step => {
        step.classList.remove("active");
        step.classList.add("done");
      });

      setTimeout(async () => {
        try {
          const saved = await reportController.generateAndSaveReport(currentPrompt);
          renderReport(saved);
          showView("report");
          if (saved.aiFallback) {
            showToast("Live AI is temporarily unavailable. Showing a sample report instead.", "warn");
          } else {
            showToast("Report generated successfully");
          }
        } catch (err) {
          handleGenerationError(err);
        }
      }, 600);
    }
  }, 380);
}

function cancelLoading() {
  if (loadingInterval) {
    clearInterval(loadingInterval);
    loadingInterval = null;
  }
  showView("dashboard");
  showToast("Research cancelled");
}

/* -- Panels -- */

function formatSubscriptionStatus(status) {
  if (!status) return isProUser() ? "Active" : "Free";
  return String(status)
    .replace(/_/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function renderBillingSettingsSection() {
  const plan = isProUser() ? "Pro" : "Free";
  const status = formatSubscriptionStatus(billingState.subscriptionStatus);

  if (isProUser()) {
    const renewalText = billingState.subscriptionStatus
      ? "Renewal and invoice dates are available inside Stripe Billing Portal."
      : "Renewal details are available inside Stripe Billing Portal.";
    return `
      <div class="settings-group billing-settings">
        <h3>Billing</h3>
        <div class="billing-row">
          <span>Current Plan</span>
          <strong>${escapeHtml(plan)}</strong>
        </div>
        <div class="billing-row">
          <span>Subscription Status</span>
          <strong>${escapeHtml(status)}</strong>
        </div>
        <div class="billing-row">
          <span>Next Renewal</span>
          <strong>${escapeHtml(renewalText)}</strong>
        </div>
        <button class="accent-btn" type="button" id="manageBillingBtn">Manage Subscription</button>
        <p>Manage payment method, invoices, billing history and cancellation through Stripe.</p>
      </div>`;
  }

  return `
    <div class="settings-group billing-settings">
      <h3>Billing</h3>
      <div class="billing-row">
        <span>Current Plan</span>
        <strong>Free</strong>
      </div>
      <p>Free includes 5 reports per month. Pro unlocks unlimited reports, priority AI generation, export tools, saved research history and future premium features.</p>
      <button class="accent-btn" type="button" id="settingsUpgradeBtn">Upgrade to Pro</button>
    </div>`;
}

function openPanel(name) {
  const titles = {
    templates: "Research Templates",
    history: "Report History",
    favorites: "Pinned Reports",
    settings: "Settings"
  };

  els.panelTitle.textContent = titles[name] || "Panel";
  els.panelBody.innerHTML = "";

  if (name === "templates") {
    const templateGrid = document.querySelector(".template-grid");
    if (templateGrid) {
      els.panelBody.innerHTML = templateGrid.outerHTML;
      els.panelBody.querySelectorAll(".template-card").forEach(card => {
        card.addEventListener("click", () => {
          closePanel();
          setPrompt(card.dataset.prompt);
          startResearch();
        });
      });
    }
  } else if (name === "history") {
    renderHistoryPanel(false);
  } else if (name === "favorites") {
    renderHistoryPanel(true);
  } else if (name === "settings") {
    const resetUsageControl = isDeveloperMode()
      ? `<button class="ghost-btn danger-btn" type="button" id="resetUsageBtn">Reset usage counter</button>`
      : "";
    els.panelBody.innerHTML = `
      <div class="settings-group">
        <h3>Workspace</h3>
        <p>Signed-in workspaces save reports to ResearchAI's database and keep a local browser cache for faster access.</p>
        <button class="ghost-btn" type="button" id="clearHistoryBtn">Clear local cache</button>
        ${resetUsageControl}
      </div>
      ${renderBillingSettingsSection()}
      <div class="settings-group">
        <h3>About</h3>
        <p>ResearchAI Public Beta. Reports use live AI or local fallback generation. Live source verification is not active yet.</p>
        <p class="settings-version">Version 1.0.0-beta</p>
      </div>`;
    refreshServerUsage().then(() => {
      if (els.panelOverlay && !els.panelOverlay.hidden && els.panelTitle.textContent === "Settings") {
        const billingSection = els.panelBody.querySelector(".billing-settings");
        if (billingSection) {
          billingSection.outerHTML = renderBillingSettingsSection();
          on(document.getElementById("manageBillingBtn"), "click", startBillingPortal);
          on(document.getElementById("settingsUpgradeBtn"), "click", startProCheckout);
        }
      }
    });
    on(document.getElementById("clearHistoryBtn"), "click", () => {
      localStorage.removeItem(STORAGE_KEY);
      currentReport = null;
      renderRecentReports();
      showReportContent(false);
      showToast("Local report cache cleared");
      closePanel();
    });
    if (isDeveloperMode()) {
      on(document.getElementById("resetUsageBtn"), "click", () => {
        localStorage.removeItem(USAGE_KEY);
        updateUsageUI();
        showToast("Usage counter reset");
      });
    }
    on(document.getElementById("manageBillingBtn"), "click", startBillingPortal);
    on(document.getElementById("settingsUpgradeBtn"), "click", startProCheckout);
  }

  if (!els.panelOverlay) return;

  els.panelOverlay.hidden = false;
  requestAnimationFrame(() => els.panelOverlay.classList.add("open"));
  els.panelClose?.focus();
  document.body.classList.add("panel-open");
}

function renderHistoryPanel(favoritesOnly) {
  const reports = getReports().filter(r => !favoritesOnly || r.pinned);

  if (!reports.length) {
    els.panelBody.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon" aria-hidden="true">${favoritesOnly ? "*" : "H"}</div>
        <h3>${favoritesOnly ? "No pinned reports yet" : "No saved reports yet"}</h3>
        <p>${favoritesOnly ? "Pin priority reports to keep them at the top of your workspace." : "Generate a report and it will be saved here automatically."}</p>
      </div>`;
    return;
  }

  els.panelBody.innerHTML = `<div class="history-list">${reports.map(r => `
    <div class="history-item" data-id="${escapeHtml(r.id)}">
      <span class="history-icon">${escapeHtml(initials(r.title))}</span>
      <div>
        <strong>${escapeHtml(r.title)}</strong>
        <p>${escapeHtml(formatReportType(r))} - ${relativeTime(r.createdAt)}${r.pinned ? " - pinned" : ""}</p>
      </div>
      <div class="history-actions">
        <button type="button" data-action="open">Open</button>
        <button type="button" data-action="pin">${r.pinned ? "Unpin" : "Pin"}</button>
        <button type="button" data-action="delete">Delete</button>
      </div>
    </div>`).join("")}</div>`;

  els.panelBody.querySelectorAll(".history-item").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = btn.dataset.id;
      const action = e.target.closest("[data-action]")?.dataset.action || "open";
      if (action === "delete") {
        deleteReport(id);
        renderHistoryPanel(favoritesOnly);
        return;
      }
      if (action === "pin") {
        toggleReportPin(id);
        renderHistoryPanel(favoritesOnly);
        return;
      }
      const report = getReports().find(r => r.id === id);
      if (!report) return;
      renderReport(report);
      closePanel();
      showView("report");
    });
  });
}

function closePanel() {
  if (!els.panelOverlay) return;
  els.panelOverlay.classList.remove("open");
  document.body.classList.remove("panel-open");
  setTimeout(() => {
    els.panelOverlay.hidden = true;
  }, 280);
}

/* -- Mobile sidebar -- */

function toggleSidebar() {
  if (!els.appSidebar || !els.mobileMenuBtn) return;
  const open = els.appSidebar.classList.toggle("open");
  els.mobileMenuBtn.setAttribute("aria-expanded", String(open));
  if (els.sidebarBackdrop) els.sidebarBackdrop.hidden = !open;
}

function closeSidebar() {
  if (!els.appSidebar || !els.mobileMenuBtn) return;
  els.appSidebar.classList.remove("open");
  els.mobileMenuBtn.setAttribute("aria-expanded", "false");
  if (els.sidebarBackdrop) els.sidebarBackdrop.hidden = true;
}

/* -- Section observer -- */

let sectionObserver = null;

function setupSectionObserver() {
  if (sectionObserver) sectionObserver.disconnect();

  sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      if (!id) return;
      document.querySelectorAll(".tree-link").forEach(link => {
        link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
      });
    });
  }, { rootMargin: "-36% 0px -54% 0px", threshold: 0.01 });

  document.querySelectorAll(".report-section[id], .report-hero[id]").forEach(section => {
    sectionObserver.observe(section);
  });
}

/* -- Topic refresh -- */

function refreshTopics() {
  if (!els.topicCloud) return;
  const shuffled = [...topicPool].sort(() => Math.random() - 0.5).slice(0, 8);
  els.topicCloud.innerHTML = shuffled.map(t => `<button type="button">${t}</button>`).join("");
  bindTopicButtons();
  showToast("Topics refreshed");
}

function bindTopicButtons() {
  if (!els.topicCloud) return;
  els.topicCloud.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => {
      setPrompt(`Create a professional research report about ${button.textContent}`);
      els.researchInput?.focus();
    });
  });
}

/* -- Exports -- */

function hasRenderableReport() {
  if (currentReport && els.reportContent?.innerText?.trim()) return true;
  showToast("Generate a report first", "info");
  return false;
}

async function copyReport() {
  if (!hasRenderableReport()) return;
  try {
    await navigator.clipboard.writeText(els.reportContent.innerText);
    showToast("Report copied to clipboard");
  } catch {
    showToast("Copy unavailable in this browser", "warn");
  }
}

async function shareReport() {
  if (!hasRenderableReport()) return;
  const data = {
    title: "ResearchAI Report",
    text: currentReport ? `Research report: ${currentReport.prompt}` : "ResearchAI Report",
    url: window.location.href
  };

  if (navigator.share) {
    try {
      await navigator.share(data);
    } catch {
      showToast("Share cancelled");
    }
  } else {
    try {
      await navigator.clipboard.writeText(els.reportContent.innerText);
      showToast("Report text copied for sharing");
    } catch {
      showToast("Share unavailable", "warn");
    }
  }
}

function exportPdf() {
  if (!hasRenderableReport()) return;
  showToast("Opening print dialog. Choose Save as PDF in your browser to export.");
  setTimeout(() => window.print(), 400);
}

function exportDocx() {
  if (!hasRenderableReport()) return;
  const blob = new Blob([els.reportContent.innerText], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ResearchAI-${Date.now()}.doc`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Word-compatible .doc file exported");
}

function exportMarkdown() {
  if (!hasRenderableReport()) return;
  const title = currentReport ? currentReport.title : "Research Report";
  const text = `# ${title}\n\n> ${currentPrompt}\n\n${els.reportContent.innerText.replace(/\n{3,}/g, "\n\n")}`;
  const blob = new Blob([text], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ResearchAI-${Date.now()}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Markdown exported");
}

function handleContinueFromCard() {
  if (!continuePrompt) return;
  setPrompt(`${continuePrompt} with deeper pricing, competitors and assumptions`);
  startResearch();
}

function handleContinueFromReport() {
  if (!currentReport) return;
  showView("dashboard");
  setTimeout(() => {
    setPrompt(`${currentReport.prompt} with deeper pricing, competitors and assumptions`);
    els.researchInput?.focus();
  }, 300);
}

function handleCollapseTree() {
  if (!els.researchTree || !els.collapseTree) return;
  els.researchTree.classList.toggle("collapsed");
  els.collapseTree.textContent = els.researchTree.classList.contains("collapsed") ? ">" : "<";
}

/* -- Event bindings -- */

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach(el => {
    el.addEventListener("click", e => {
      e.preventDefault();
      if (el.id === "openReportBtn" && !getReports().length && !currentReport) {
        showToast("Generate a report first", "info");
      }
      showView(el.dataset.view);
    });
  });

  document.querySelectorAll(".start-research").forEach(btn => {
    btn.addEventListener("click", () => {
      showView("dashboard");
      setTimeout(() => {
        els.researchInput?.focus();
      }, 200);
    });
  });

  on(els.researchForm, "submit", e => {
    e.preventDefault();
    startResearch();
  });

  document.querySelectorAll(".suggestions button").forEach(btn => {
    btn.addEventListener("click", () => {
      setPrompt(btn.textContent);
      els.researchInput?.focus();
    });
  });

  document.querySelectorAll(".template-card").forEach(card => {
    card.addEventListener("click", () => {
      setPrompt(card.dataset.prompt);
      startResearch();
    });
  });

  bindTopicButtons();

  on(els.researchInput, "input", () => {
    showInputError("");
    updatePreview(els.researchInput.value);
  });

  on(els.researchInput, "keydown", e => {
    if (e.key === "Escape") {
      els.researchInput.value = "";
      showInputError("");
      updatePreview("");
    }
  });

  document.querySelectorAll("[data-panel]").forEach(btn => {
    btn.addEventListener("click", () => openPanel(btn.dataset.panel));
  });

  document.querySelectorAll("[data-coming-soon]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      showToast(`${btn.dataset.comingSoon} is not active yet`, "info");
    });
  });

  on(els.panelClose, "click", closePanel);
  on(els.panelOverlay, "click", e => {
    if (e.target === els.panelOverlay) closePanel();
  });

  on(els.cancelLoading, "click", cancelLoading);
  on(els.refreshTopics, "click", refreshTopics);
  on(els.continueBtn, "click", handleContinueFromCard);

  on(els.startFreeBtn, "click", () => {
    showView("dashboard");
    els.researchInput?.focus();
    showToast("Free plan: 5 reports per month");
  });

  on(els.proCheckoutBtn, "click", startProCheckout);
  on(els.signInBtn, "click", openSignIn);
  on(els.signUpBtn, "click", openSignUp);
  on(els.signOutBtn, "click", signOut);

  on(els.copyReport, "click", copyReport);
  on(els.shareReport, "click", shareReport);
  on(els.exportPdf, "click", exportPdf);
  on(els.exportDocx, "click", exportDocx);
  on(els.exportMarkdown, "click", exportMarkdown);
  on(els.continueResearch, "click", handleContinueFromReport);
  on(els.favoriteReport, "click", toggleFavorite);
  on(els.collapseTree, "click", handleCollapseTree);
  on(els.mobileMenuBtn, "click", toggleSidebar);
  on(els.sidebarBackdrop, "click", closeSidebar);

  document.addEventListener("keydown", e => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      showView("dashboard");
      els.researchInput?.focus();
    }
    if (e.key === "Escape") {
      if (els.panelOverlay && !els.panelOverlay.hidden) closePanel();
      else closeSidebar();
    }
  });
}

/* -- Placeholder rotation -- */

let placeholderIndex = 0;

function rotatePlaceholder() {
  if (!els.researchInput) return;
  if (document.activeElement === els.researchInput || els.researchInput.value) return;
  placeholderIndex = (placeholderIndex + 1) % placeholders.length;
  els.researchInput.placeholder = placeholders[placeholderIndex];
}

/* -- Init -- */

function init() {
  try {
    if (els.researchInput) {
      els.researchInput.placeholder = placeholders[0];
    }
  } catch (err) {
    console.error("[ResearchAI] placeholder setup failed:", err);
  }

  try {
    updateUsageUI();
  } catch (err) {
    console.error("[ResearchAI] updateUsageUI failed:", err);
  }

  try {
    renderRecentReports();
  } catch (err) {
    console.error("[ResearchAI] renderRecentReports failed:", err);
  }

  try {
    bindEvents();
  } catch (err) {
    console.error("[ResearchAI] bindEvents failed:", err);
  }

  try {
    initAuth().then(handleCheckoutReturn).catch(err => {
      console.error("[ResearchAI] auth initialization failed:", err);
    });
  } catch (err) {
    console.error("[ResearchAI] initAuth failed:", err);
  }

  try {
    buildTreeNav();
    showReportContent(false);

    const reports = getReports();
    if (reports.length) {
      currentReport = reports[0];
    }
    setInterval(rotatePlaceholder, 2800);
  } catch (err) {
    console.error("[ResearchAI] post-bind init failed:", err);
  }
}

init();
