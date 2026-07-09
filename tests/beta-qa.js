const assert = require("assert");
const crypto = require("crypto");

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(key, value) {
      this.headers[key] = value;
    },
    end(value) {
      this.body = value;
    },
    json() {
      return this.body ? JSON.parse(this.body) : null;
    }
  };
}

async function testClerkTokenBasics() {
  const { getAuthToken, getExpectedClerkIssuer, verifyClerkToken } = require("../api/_clerk-token");

  process.env.CLERK_PUBLISHABLE_KEY = "pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk";
  assert.strictEqual(getAuthToken({ headers: { authorization: "Bearer test-token" } }), "test-token");
  assert.strictEqual(getExpectedClerkIssuer(), "https://example.clerk.accounts.dev");

  const badAlgToken = [
    Buffer.from(JSON.stringify({ alg: "HS256", kid: "kid" })).toString("base64url"),
    Buffer.from(JSON.stringify({ iss: "https://example.clerk.accounts.dev", exp: Math.floor(Date.now() / 1000) + 60 })).toString("base64url"),
    "signature"
  ].join(".");
  assert.strictEqual(await verifyClerkToken(badAlgToken), null);
  assert.strictEqual(await verifyClerkToken("not.a.jwt"), null);
}

function testStripeWebhookSignature() {
  const { constructStripeEvent, getSubscriptionTiming, verifyStripeSignature } = require("../api/stripe-webhook")._test;
  const secret = "whsec_test_secret";
  const payload = JSON.stringify({
    id: "evt_test",
    type: "checkout.session.completed",
    data: { object: { client_reference_id: "user_123" } }
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  const header = `t=${timestamp},v1=${signature}`;

  assert.doesNotThrow(() => verifyStripeSignature(payload, header, secret));
  assert.strictEqual(constructStripeEvent(payload, header, secret).type, "checkout.session.completed");
  assert.throws(() => verifyStripeSignature(payload, `t=${timestamp},v1=bad`, secret), /invalid/i);
  assert.throws(() => verifyStripeSignature(payload, "", secret), /missing/i);

  const timing = getSubscriptionTiming({
    cancel_at_period_end: true,
    current_period_end: 1786233600
  });
  assert.strictEqual(timing.cancelAtPeriodEnd, true);
  assert.strictEqual(timing.currentPeriodEnd, "2026-08-09T00:00:00.000Z");
}

async function testSupabaseUsageAndOwnershipQueries() {
  const supabase = require("../api/_supabase");
  process.env.SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_test";

  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("/rest/v1/usage")) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([{ user_id: "user_a", month: "2026-07", count: 5, monthly_limit: 5 }])
      };
    }
    if (String(url).includes("/rest/v1/reports")) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([{ id: "user_a:report_1", user_id: "user_a", report_data: {} }])
      };
    }
    return { ok: true, status: 200, text: async () => "[]" };
  };

  try {
    await assert.rejects(() => supabase.assertUsageAvailable("user_a", false, "2026-07"), error => error.code === "free_limit_reached");
    await assert.doesNotReject(() => supabase.assertUsageAvailable("user_a", true, "2026-07"));
    await supabase.updateReportPin("user_a", "user_a:report_1", true);
    assert(calls.some(call => call.url.includes("user_id=eq.user_a") && call.url.includes("id=eq.user_a%3Areport_1")));
  } finally {
    global.fetch = originalFetch;
  }
}

async function testGenerateAuthAndDemoFlow() {
  const handler = require("../api/generate");
  const originalFetch = global.fetch;
  process.env.SITE_URL = "https://researchai.app";

  const demoResponse = createResponse();
  await handler({
    method: "POST",
    headers: { origin: "https://researchai.app" },
    body: { prompt: "Research AI agency market", mode: "demo" }
  }, demoResponse);
  assert.strictEqual(demoResponse.statusCode, 200);
  assert.strictEqual(demoResponse.json().ok, true);

  const geminiResponse = createResponse();
  await handler({
    method: "POST",
    headers: { origin: "https://researchai.app" },
    body: { prompt: "Research AI agency market", mode: "gemini" }
  }, geminiResponse);
  assert.strictEqual(geminiResponse.statusCode, 401);
  assert.strictEqual(geminiResponse.json().error.code, "auth_required");

  global.fetch = originalFetch;
}

function testFrontendStaticSmoke() {
  const fs = require("fs");
  const script = fs.readFileSync("script.js", "utf8");
  const index = fs.readFileSync("index.html", "utf8");

  assert(script.includes("function escapeHtml"));
  assert(script.includes("startBillingPortal"));
  assert(script.includes("billingPortalEndpoint"));
  assert(index.includes("proCheckoutBtn"));
  assert(!script.includes("STRIPE_SECRET_KEY"));
  assert(!script.includes("SUPABASE_SERVICE_ROLE_KEY"));
  assert(!script.includes("CLERK_SECRET_KEY"));
}

async function main() {
  await testClerkTokenBasics();
  testStripeWebhookSignature();
  await testSupabaseUsageAndOwnershipQueries();
  await testGenerateAuthAndDemoFlow();
  testFrontendStaticSmoke();
  console.log("beta QA mocks passed");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
