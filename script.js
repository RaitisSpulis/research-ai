/* ResearchAI - Frontend demo application */

const STORAGE_KEY = "researchai_reports_v1";
const USAGE_KEY = "researchai_usage_v1";
const FREE_LIMIT = 5;

const researchAIConfig = {
  generationMode: "demo",
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
  usageText: document.getElementById("usageText"),
  usageBar: document.getElementById("usageBar"),
  usageFill: document.getElementById("usageFill"),
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

let currentPrompt = "";
let currentReport = null;
let continuePrompt = "";
let loadingInterval = null;
let toastTimer = null;

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
  "Labeling demo estimates...",
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sortReports(reports.map(normalizeReport)).slice(0, 50)));
}

function normalizeReport(report) {
  return {
    ...report,
    id: report.id || hashCode(`${report.prompt || report.title || "report"}${report.createdAt || Date.now()}`),
    title: report.title || titleFromPrompt(report.prompt || "Professional Research Report"),
    prompt: report.prompt || "",
    reportType: report.reportType || report.intent || report.category || "general_research",
    createdAt: report.createdAt || new Date().toISOString(),
    contentHtml: report.contentHtml || "",
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
  const now = new Date();
  const month = `${now.getFullYear()}-${now.getMonth()}`;
  const count = getUsage() + 1;
  localStorage.setItem(USAGE_KEY, JSON.stringify({ month, count }));
  updateUsageUI();
  return count;
}

function updateUsageUI() {
  if (!els.usageText || !els.usageBar || !els.usageFill) return;
  const used = getUsage();
  els.usageText.textContent = `${used} of ${FREE_LIMIT} reports used this month`;
  els.usageBar.setAttribute("aria-valuenow", String(used));
  els.usageFill.style.width = `${Math.min(100, (used / FREE_LIMIT) * 100)}%`;
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

  return {
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
}

/* -- AI service layer -- */

class GenerationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GenerationError";
    this.code = code;
  }
}

const generationErrorMessages = {
  provider_unavailable: "This report provider is not available yet. Demo Mode is still available.",
  invalid_configuration: "Report generation is not configured correctly. Please switch back to Demo Mode.",
  generation_failed: "ResearchAI could not generate the report. Please try again."
};

class ReportProvider {
  constructor(config = {}) {
    this.config = config;
  }

  generateReport() {
    throw new GenerationError("provider_unavailable", "Provider has not implemented report generation.");
  }

  createPreview() {
    throw new GenerationError("provider_unavailable", "Provider has not implemented preview generation.");
  }
}

class DemoProvider extends ReportProvider {
  async generateReport(prompt) {
    return analyzePrompt(prompt);
  }

  createPreview(prompt) {
    return analyzePrompt(prompt);
  }
}

class GeminiProvider extends ReportProvider {
  async generateReport() {
    // TODO: Implement Gemini generation through a backend/API boundary. Do not expose API keys in this frontend.
    throw new GenerationError("provider_unavailable", "GeminiProvider is a placeholder.");
  }

  createPreview(prompt) {
    return analyzePrompt(prompt);
  }
}

class OpenRouterProvider extends ReportProvider {
  async generateReport() {
    // TODO: Implement OpenRouter generation through a backend/API boundary. Do not expose API keys in this frontend.
    throw new GenerationError("provider_unavailable", "OpenRouterProvider is a placeholder.");
  }

  createPreview(prompt) {
    return analyzePrompt(prompt);
  }
}

class AIService {
  constructor(config) {
    this.config = config;
    this.providers = {
      demo: new DemoProvider(config.providers.demo),
      gemini: new GeminiProvider(config.providers.gemini),
      openrouter: new OpenRouterProvider(config.providers.openrouter)
    };
  }

  getProvider() {
    const mode = this.config.generationMode;
    const provider = this.providers[mode];
    if (!provider) {
      throw new GenerationError("invalid_configuration", `Unknown generation mode: ${mode}`);
    }
    return provider;
  }

  async generateReport(prompt) {
    try {
      return await this.getProvider().generateReport(prompt);
    } catch (err) {
      if (err instanceof GenerationError) throw err;
      throw new GenerationError("generation_failed", err.message);
    }
  }

  createPreview(prompt) {
    try {
      return this.getProvider().createPreview(prompt);
    } catch {
      return new DemoProvider(this.config.providers.demo).createPreview(prompt);
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

  async generateReport(prompt) {
    return await this.aiService.generateReport(prompt);
  }

  async generateAndSaveReport(prompt) {
    return saveReport(await this.generateReport(prompt));
  }
}

const aiService = new AIService(researchAIConfig);
const reportController = new ReportController(aiService);

function getGenerationErrorMessage(error) {
  if (error instanceof GenerationError && generationErrorMessages[error.code]) {
    return generationErrorMessages[error.code];
  }
  return generationErrorMessages.generation_failed;
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
      executive: `This demo analysis of <strong>${escapeHtml(topic)}</strong> outlines a balanced investment view. Catalysts include product momentum and market expansion, while risks center on valuation, competition, and macro sensitivity. This report is a structured framework - not financial advice.`,
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
        ["Week 5-8: Build", "Ship 2 small AI projects with real users or demos."],
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
      ["Data limitations", "Demo mode uses illustrative estimates. Verify important decisions with primary sources."],
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
      executive: `This demo report treats <strong>${escapeHtml(topic)}</strong> as a validation problem. The priority is not proving the idea is exciting; it is testing whether a specific buyer has a painful enough problem, a reachable channel, and a reason to act now in the ${label} space.`,
      findings: [
        ["Validation focus", "The first milestone is evidence of real demand, not a polished product."],
        ["Buyer clarity", "The report should identify who feels the pain and who controls the budget."],
        ["Fastest proof", "A focused pilot, landing page, interview sequence, or paid test is more useful than broad research."]
      ]
    },
    business_plan: {
      executive: `This demo report frames <strong>${escapeHtml(topic)}</strong> as an operating plan. The most important questions are customer demand, delivery model, unit economics, launch sequencing, and what must be proven before committing serious capital.`,
      findings: [
        ["Operating model", "The plan needs a clear path from first customer to repeatable delivery."],
        ["Unit economics", "Pricing, cost structure, and capacity should be modeled before launch."],
        ["Launch sequence", "The safest plan starts with a narrow proof point and expands after evidence appears."]
      ]
    },
    market_analysis: {
      executive: `This demo report frames <strong>${escapeHtml(topic)}</strong> as a market analysis. The goal is to understand segment quality, demand signals, competitive pressure, and what evidence would make the opportunity more or less attractive.`,
      findings: [
        ["Segment quality", "A smaller reachable segment can be more useful than a large abstract market."],
        ["Demand evidence", "Search behavior, spending patterns, reviews, and workflow pain should be compared."],
        ["Market timing", "The strongest opportunities have a clear reason why now is better than later."]
      ]
    },
    competitor_comparison: {
      executive: `This demo report compares <strong>${escapeHtml(topic)}</strong> through practical buyer criteria rather than brand preference. The strongest decision will come from comparing use case fit, cost, integration effort, trust, support, and switching risk.`,
      findings: [
        ["Decision criteria", "The comparison should start with the user's workflow, not vendor popularity."],
        ["Trade-off clarity", "Each option should be evaluated by where it is strongest and where it creates friction."],
        ["Implementation risk", "Integration, support, migration, and operational edge cases should be checked before selection."]
      ]
    },
    product_strategy: {
      executive: `This demo report treats <strong>${escapeHtml(topic)}</strong> as a product strategy question. The priority is deciding which customer problem deserves focus, what position the product should own, and what to build or avoid first.`,
      findings: [
        ["Positioning", "The product needs a sharp promise that a target customer can repeat in one sentence."],
        ["Scope control", "Early product strategy should reduce choices, not expand the feature list."],
        ["Adoption path", "The first workflow should be easy to try and valuable enough to repeat."]
      ]
    },
    learning_plan: {
      executive: `This demo report turns <strong>${escapeHtml(topic)}</strong> into a structured learning plan. The objective is to move from vague interest to weekly outcomes, practice projects, feedback, and visible proof of skill.`,
      findings: [
        ["Weekly milestones", "A good plan defines what the learner can demonstrate each week."],
        ["Project evidence", "Practice projects should create portfolio artifacts, not just notes."],
        ["Feedback rhythm", "Skill improves faster when work is reviewed and revised on a schedule."]
      ]
    },
    investment_thesis: {
      executive: `This demo report frames <strong>${escapeHtml(topic)}</strong> as an investment thesis draft. It separates thesis drivers, risks, valuation assumptions, evidence to verify, and decision triggers. It is not financial advice.`,
      findings: [
        ["Thesis drivers", "The strongest thesis identifies what must be true for upside to occur."],
        ["Risk boundaries", "Downside scenarios should be explicit before position sizing."],
        ["Evidence checklist", "Financials, management commentary, market data, and comparables need source review."]
      ]
    },
    general_research: {
      executive: `This demo report organizes <strong>${escapeHtml(topic)}</strong> into a decision-ready research draft. It highlights useful signals, open assumptions, recommended evidence, and practical next steps without claiming live verification.`,
      findings: [
        ["Clarify the question", "The most useful report starts by defining what decision the research should support."],
        ["Separate evidence from assumptions", "Demo estimates should be treated as structure until checked against real sources."],
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
    ["Direct alternatives", "Comparable current solutions", "Limited context in demo mode", "Verify with live market research"],
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
    ["Demo-only evidence", "The report does not use live sources, so important claims still need verification."],
    ["Prompt sensitivity", `The ${intentLabel(intent)} draft improves when the audience, geography, budget, or constraints are specific.`],
    ["Industry nuance", `${industryLabel(industry)} details may require local or expert validation before decisions are made.`]
  ];
}

function getDynamicLimitations(intent, industry) {
  return [
    ["Estimated in demo mode", `This ${intentLabel(intent)} report uses local template logic and illustrative assumptions for the ${industryLabel(industry)} context.`],
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

  return `<div><strong>${escapeHtml(title)}</strong><p>${text}</p></div>`;
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

function buildReportHTML(data) {
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
  const competitorFallbackHtml = `<tr><td colspan="4">No structured comparison rows are available in this demo report.</td></tr>`;
  const representativeHtml = representativeAlternatives(data).length
    ? `<p>Representative alternatives include:</p>
      <ul class="signal-list">
        ${representativeAlternatives(data).map(([name, context]) => signalItem(name, context || "Review this alternative during source verification.")).join("")}
      </ul>`
    : "";

  return `
    <section class="report-hero" id="summary">
      <p class="eyebrow"><span aria-hidden="true"></span> Professional report draft</p>
      <h1 id="reportMainTitle">${escapeHtml(data.title)}</h1>
      <p id="reportQuestion">Research question: "${escapeHtml(data.prompt)}"</p>
      <div class="report-stats">
        <div><strong>Demo</strong><span>Estimate type</span></div>
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
        <span>Demo analysis</span>
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
          <h2>What could change the conclusion</h2>
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
      <p class="report-disclaimer">Figures are illustrative estimates for demo purposes. Not financial advice.</p>
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
        <span>Demo mode</span>
      </div>
      <div class="insight-grid">${sourcesHtml}</div>
      <p class="report-disclaimer">This demo suggests source categories only. It does not fetch, verify, or cite live sources yet.</p>
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

function buildTreeNav() {
  const sections = [
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

  els.treeNav.innerHTML = sections.map(([id, label], i) =>
    `<a class="tree-link${i === 0 ? " active" : ""}" href="#${id}"><span>${i + 1}</span><b>${label}</b><em aria-hidden="true"></em></a>`
  ).join("");
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
  els.reportContent.innerHTML = currentReport.contentHtml || buildReportHTML(currentReport);
  applyBarWidths(els.reportContent);

  els.reportTopTitle.textContent = currentReport.title;
  els.reportMeta.textContent = `Generated ${relativeTime(currentReport.createdAt)} - 12 sections - demo estimates`;
  els.metricConfidence.textContent = "Demo";
  els.metricDepth.textContent = "Professional";

  buildTreeNav();
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
    els.previewScore.setAttribute("aria-label", "Demo estimate preview not available yet");
    els.previewMarket.textContent = "$-";
    els.previewCompetitors.textContent = "-";
    els.previewDemand.textContent = "-";
    els.previewWindow.textContent = "-";
    return;
  }

  const data = reportController.createPreview(prompt);
  els.previewTitle.textContent = data.title;
  els.previewScore.textContent = "Demo";
  els.previewScore.setAttribute("aria-label", `Demo estimate preview using ${data.confidence} percent decorative completeness`);
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
        <p>${escapeHtml(formatReportType(report))} - 12 sections - ${relativeTime(report.createdAt)}${report.pinned ? " - pinned" : ""}</p>
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

function saveReport(data) {
  const reports = getReports();
  const entry = normalizeReport({
    ...data,
    id: hashCode(data.prompt + Date.now()),
    createdAt: new Date().toISOString(),
    reportType: data.intent || data.category || "general_research",
    contentHtml: buildReportHTML(data),
    pinned: false,
    favorite: false
  });
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

function toggleReportPin(id) {
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
  updateFavoriteButton();
  renderRecentReports();
  showToast(reports[idx].pinned ? "Report pinned" : "Report unpinned");
}

function deleteReport(id) {
  const reports = getReports();
  const report = reports.find(r => r.id === id);
  const nextReports = reports.filter(r => r.id !== id);
  saveReports(nextReports);
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

  if (getUsage() >= FREE_LIMIT) {
    showToast("Free demo limit reached (5/month). Paid plans are not active yet.", "warn");
    return;
  }

  showInputError("");
  currentPrompt = prompt;
  els.loadingPrompt.textContent = `Demo mode: building a local sample report for "${prompt}". No web research is being performed.`;

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
          incrementUsage();
          renderReport(saved);
          showView("report");
          showToast("Report generated successfully");
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
    els.panelBody.innerHTML = `
      <div class="settings-group">
        <h3>Workspace</h3>
        <p>Demo reports are stored locally in this browser. No data is sent to a server.</p>
        <button class="ghost-btn" type="button" id="clearHistoryBtn">Clear report history</button>
        <button class="ghost-btn danger-btn" type="button" id="resetUsageBtn">Reset usage counter</button>
      </div>
      <div class="settings-group">
        <h3>About</h3>
        <p>ResearchAI Public Beta - demo mode. Reports are generated locally from templates and illustrative estimates. Live source verification is not active yet.</p>
        <p class="settings-version">Version 1.0.0-beta</p>
      </div>`;
    on(document.getElementById("clearHistoryBtn"), "click", () => {
      localStorage.removeItem(STORAGE_KEY);
      currentReport = null;
      renderRecentReports();
      showReportContent(false);
      showToast("History cleared");
      closePanel();
    });
    on(document.getElementById("resetUsageBtn"), "click", () => {
      localStorage.removeItem(USAGE_KEY);
      updateUsageUI();
      showToast("Usage counter reset");
    });
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
        <p>${favoritesOnly ? "Pin important reports to keep them at the top of your workspace." : "Generate a local demo report and it will be saved here automatically."}</p>
      </div>`;
    return;
  }

  els.panelBody.innerHTML = `<div class="history-list">${reports.map(r => `
    <div class="history-item" data-id="${r.id}">
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
      const id = Number(btn.dataset.id);
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

async function copyReport() {
  try {
    await navigator.clipboard.writeText(els.reportContent.innerText);
    showToast("Report copied to clipboard");
  } catch {
    showToast("Copy unavailable in this browser", "warn");
  }
}

async function shareReport() {
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
      await navigator.clipboard.writeText(window.location.href);
      showToast("Share link copied");
    } catch {
      showToast("Share unavailable", "warn");
    }
  }
}

function exportPdf() {
  showToast("Opening print dialog. Browser print can save as PDF.");
  setTimeout(() => window.print(), 400);
}

function exportDocx() {
  const blob = new Blob([els.reportContent.innerText], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ResearchAI-${Date.now()}.doc`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Demo document exported as a basic .doc file");
}

function exportMarkdown() {
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
        if (els.researchInput?.value.trim()) startResearch();
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
    showToast("Demo mode: 5 local reports per month");
  });

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
