/* ResearchAI - Frontend demo application */

const STORAGE_KEY = "researchai_reports_v1";
const USAGE_KEY = "researchai_usage_v1";
const FREE_LIMIT = 5;

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
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveReports(reports) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports.slice(0, 50)));
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
  if (/coffee|restaurant|cafe|shop|retail|store/.test(p)) return "retail";
  if (/apartment|house|real estate|rent|mortgage|property|buy a home/.test(p)) return "realestate";
  if (/invest|stock|valuation|thesis|equity|portfolio/.test(p)) return "investment";
  if (/learn|roadmap|skill|course|education|study/.test(p)) return "learning";
  if (/competitor|competition|rival/.test(p)) return "competitive";
  if (/market|tam|sam|sizing|segment/.test(p)) return "market";
  if (/saas|startup|business plan|validate|launch/.test(p)) return "startup";
  if (/health|wellness|fitness|medical/.test(p)) return "health";
  if (/travel|tourism|destination/.test(p)) return "travel";
  return "general";
}

function extractTopic(prompt) {
  return prompt
    .replace(/^(create|analyze|research|build|estimate|validate|should i|compare)\s+(a|an|the|whether|if)-\s*/i, "")
    .replace(/[?.!]+$/, "")
    .trim() || "this opportunity";
}

function analyzePrompt(prompt) {
  const seed = hashCode(prompt);
  const category = detectCategory(prompt);
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

  return {
    prompt,
    title,
    topic,
    category,
    confidence,
    marketSize: formatMoney(marketB),
    competitorCount,
    signals,
    launchWindow: `${months} mo`,
    demand,
    bars: barSets[category === "market" ? "market" : category === "startup" ? "startup" : "default"],
    segmentBars,
    ...categoryContent
  };
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
      <div class="confidence-grid">
        <div>
          <strong>Estimated in demo mode</strong>
          <p>Market sizing, timing, financial ranges and signal strength are illustrative values generated from the prompt and template logic.</p>
        </div>
        <div>
          <strong>Needs connected sources</strong>
          <p>Live citations, current market data, official documents and primary research would make the final report stronger.</p>
        </div>
        <div>
          <strong>Best used as a first draft</strong>
          <p>Use this report to structure the decision, identify assumptions and decide what evidence to verify next.</p>
        </div>
      </div>
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
  currentReport = data;
  els.reportContent.innerHTML = buildReportHTML(data);
  applyBarWidths(els.reportContent);

  els.reportTopTitle.textContent = data.title;
  els.reportMeta.textContent = `Generated ${relativeTime(data.createdAt)} - 12 sections - demo estimates`;
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

  const data = analyzePrompt(prompt);
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
  const reports = getReports().slice(0, 3);

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
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "report-row";
    btn.innerHTML = `
      <span>${escapeHtml(initials(report.title))}</span>
      <div>
        <strong>${escapeHtml(report.title)}</strong>
        <p>${report.category} - 12 sections - ${relativeTime(report.createdAt)}${report.favorite ? " - *" : ""}</p>
      </div>
      <em>Open</em>`;
    btn.addEventListener("click", () => {
      renderReport(report);
      showView("report");
    });
    els.recentReportsList.appendChild(btn);
  });

  const latest = reports[0];
  els.continueCard.hidden = false;
  continuePrompt = latest.prompt;
  els.continueText.textContent = `Continue "${latest.title}" with deeper pricing, competitors and assumptions.`;
}

function saveReport(data) {
  const reports = getReports();
  const entry = { ...data, id: hashCode(data.prompt + Date.now()), createdAt: new Date().toISOString(), favorite: false };
  reports.unshift(entry);
  saveReports(reports);
  renderRecentReports();
  return entry;
}

function updateFavoriteButton() {
  if (!currentReport) return;
  const fav = currentReport.favorite;
  els.favoriteReport.textContent = fav ? "* Favorited" : "* Favorite";
  els.favoriteReport.setAttribute("aria-label", fav ? "Remove from favorites" : "Add to favorites");
  els.favoriteReport.classList.toggle("is-favorite", fav);
}

function toggleFavorite() {
  if (!currentReport) return;
  const reports = getReports();
  const idx = reports.findIndex(r => r.id === currentReport.id);
  if (idx === -1) return;

  reports[idx].favorite = !reports[idx].favorite;
  currentReport.favorite = reports[idx].favorite;
  saveReports(reports);
  updateFavoriteButton();
  renderRecentReports();
  showToast(currentReport.favorite ? "Added to favorites" : "Removed from favorites");
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

      setTimeout(() => {
        incrementUsage();
        const analyzed = analyzePrompt(currentPrompt);
        const saved = saveReport(analyzed);
        renderReport(saved);
        showView("report");
        showToast("Report generated successfully");
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
    favorites: "Favorite Reports",
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
  const reports = getReports().filter(r => !favoritesOnly || r.favorite);

  if (!reports.length) {
    els.panelBody.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon" aria-hidden="true">${favoritesOnly ? "*" : "H"}</div>
        <h3>${favoritesOnly ? "No favorites yet" : "No reports yet"}</h3>
        <p>${favoritesOnly ? "Star a report to save it here." : "Generate your first report from the dashboard."}</p>
      </div>`;
    return;
  }

  els.panelBody.innerHTML = `<div class="history-list">${reports.map(r => `
    <button type="button" class="history-item" data-id="${r.id}">
      <span class="history-icon">${escapeHtml(initials(r.title))}</span>
      <div>
        <strong>${escapeHtml(r.title)}</strong>
        <p>${relativeTime(r.createdAt)} - demo estimates${r.favorite ? " - *" : ""}</p>
      </div>
    </button>`).join("")}</div>`;

  els.panelBody.querySelectorAll(".history-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const report = getReports().find(r => r.id === Number(btn.dataset.id));
      if (report) {
        renderReport(report);
        closePanel();
        showView("report");
      }
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
