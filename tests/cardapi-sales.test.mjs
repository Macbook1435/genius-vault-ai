import test from "node:test";
import assert from "node:assert/strict";

process.env.OPENAI_API_KEY ||= "offline-test";
const lib = await import("../api/_lib/cardapi-sales.js");
const { fetchCardApiComps } = await import("../api/scan.js");

const addison = { player: "Jordan Addison", year: "2023", brand: "Panini", set: "Flawless", cardNumber: "RP-JAN",
  parallel: "Ruby", numberedTo: 15, rookie: true, autograph: false, memorabilia: true, grade: "", gradingCompany: "" };
const row = (id, title, price, extra = {}) => ({ id, title, price, currency: "USD", listing_type: "auction",
  sale_date: "2026-11-20", listing_url: `https://www.ebay.com/itm/${id}`, price_confirmed: true, ...extra });

const mockFetch = (rows, status = 200, seen = []) => async (url, init) => {
  seen.push({ url: new URL(url), init });
  return new Response(JSON.stringify({ data: rows, pagination: { total: rows.length } }), { status });
};

test("stays off without a key", async () => {
  delete process.env.THECARDAPI_KEY;
  assert.equal(lib.cardApiConfigured(), false);
  const out = await lib.fetchCardApiSales(addison, { fetchImpl: () => { throw new Error("should not call"); } });
  assert.equal(out.status, "not_configured");
});

test("query puts the player in quotes and sends the key only as a header", async () => {
  process.env.THECARDAPI_KEY = "tca_test_secret";
  const seen = [];
  await lib.fetchCardApiSales(addison, { fetchImpl: mockFetch([], 200, seen) });
  const { url, init } = seen[0];
  assert.equal(url.origin + url.pathname, "https://www.thecardapi.com/api/v1/market/sales");
  assert.equal(url.searchParams.get("q"), '"Jordan Addison" Panini Flawless');
  assert.equal(url.searchParams.get("graded"), "false");
  assert.equal(init.headers["x-market-api-key"], "tca_test_secret");
  assert.ok(!url.href.includes("tca_test_secret"));
});

test("never uses asking prices: unconfirmed best offers and null prices are dropped", () => {
  assert.equal(lib.mapCardApiRow(row(1, "x", null)), null);
  assert.equal(lib.mapCardApiRow(row(2, "x", 50, { listing_type: "best_offer", price_confirmed: false, original_price: 80 })), null);
  assert.equal(lib.mapCardApiRow(row(3, "x", 50, { listing_type: "best_offer", price_confirmed: true })).price, 50);
  assert.equal(lib.mapCardApiRow(row(4, "x", 50, { listing_url: "javascript:alert(1)" })).url, null);
});

test("strict title audit keeps only the exact card, including hyphenated numbers", async () => {
  process.env.THECARDAPI_KEY = "tca_test_secret";
  const rows = [
    row(11, "2023 Panini Flawless Jordan Addison Rookie Patch #RP-JAN Ruby 08/15 RC", 210),
    row(12, "2023 Panini Flawless Jordan Addison RPJAN Ruby Rookie Patch /15", 190),
    row(13, "2023 Panini Flawless Jordan Addison Rookie Patch #RP-JAN Sapphire 05/10", 400),
    row(14, "2023 Panini Flawless Jordan Addison Rookie Patch Auto #RPA-JAN Ruby /15", 500),
    row(15, "2023 Panini Flawless Jordan Addison #RP-JAN Ruby 08/15 PSA 9", 350),
    row(11, "2023 Panini Flawless Jordan Addison Rookie Patch #RP-JAN Ruby 08/15 RC", 210),
  ];
  const out = await fetchCardApiComps(addison, "s", "t", { fetchImpl: mockFetch(rows) });
  assert.equal(out.source, "thecardapi_sold");
  assert.equal(out.status, "comps_found");
  assert.deepEqual(out.items.map((i) => i.id), [11, 12]);
  assert.equal(out.median, 200);
  assert.equal(out.matchAudit.candidateCount, 5);
  assert.equal(out.cardApiRows, 6);
  assert.ok(out.items.every((i) => i.match.matchedFields.includes("Print run") && i.match.matchedFields.includes("Parallel")));
});

test("quota and key errors fail closed with no prices", async () => {
  process.env.THECARDAPI_KEY = "tca_test_secret";
  for (const [status, provider] of [[429, "quota_reached"], [401, "key_rejected"], [403, "plan_limit"]]) {
    const out = await fetchCardApiComps(addison, "s", "t", { fetchImpl: mockFetch([], status) });
    assert.equal(out.count, 0);
    assert.equal(out.providerStatus, provider);
    assert.equal(out.status, "comps_search_failed");
  }
  const slow = await fetchCardApiComps(addison, "s", "t", { timeoutMs: 20,
    fetchImpl: (u, { signal }) => new Promise((_, rej) => signal.addEventListener("abort", () => rej(Object.assign(new Error("a"), { name: "AbortError" })))) });
  assert.equal(slow.providerStatus, "timeout");
});

test("uses only the tca_ token when notes were pasted around it, and never logs it", async () => {
  process.env.THECARDAPI_KEY = "# My notes\n- line one\n tca_abc123DEF456 \n";
  assert.equal(lib.cardApiKey(), "tca_abc123DEF456");
  const seen = [];
  await lib.fetchCardApiSales(addison, { fetchImpl: mockFetch([], 200, seen) });
  assert.equal(seen[0].init.headers["x-market-api-key"], "tca_abc123DEF456");
  const logs = [];
  const orig = console.warn;
  console.warn = (...a) => logs.push(a.join(" "));
  try {
    await lib.fetchCardApiSales(addison, { fetchImpl: async () => { throw new TypeError("bad header tca_abc123DEF456"); } });
    await lib.fetchCardApiSales(addison, { fetchImpl: async () => new Response("key tca_abc123DEF456 rejected", { status: 401 }) });
  } finally { console.warn = orig; }
  assert.ok(logs.length >= 2);
  assert.ok(logs.every((l) => !l.includes("abc123DEF456")));
  process.env.THECARDAPI_KEY = "has spaces and no token";
  assert.equal(lib.cardApiConfigured(), false);
});
