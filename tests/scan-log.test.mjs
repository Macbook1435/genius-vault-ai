import test from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
const { writeScanLog, recordScanCorrection, countApiCalls } = await import("../api/_lib/scan-log.js");
const { takeCardsightCalls } = await import("../api/cardsight.js");
const ID = "11111111-2222-4333-8444-555555555555";

test("writeScanLog posts one row and returns its id", async () => {
  const calls = [];
  globalThis.fetch = async (url, opts) => { calls.push({ url, opts }); return new Response(JSON.stringify([{ id: ID }]), { status: 201 }); };
  assert.equal(await writeScanLog({ card: { player: "Sam Example" } }), ID);
  assert.match(calls[0].url, /\/rest\/v1\/gv_scan_log\?select=id$/);
  assert.equal(calls[0].opts.method, "POST");
  assert.equal(JSON.parse(calls[0].opts.body).card.player, "Sam Example");
});

test("a database error never fails the scan", async () => {
  globalThis.fetch = async () => new Response("nope", { status: 500 });
  assert.equal(await writeScanLog({}), null);
  globalThis.fetch = async () => { throw new Error("offline"); };
  assert.equal(await writeScanLog({}), null);
});

test("corrections patch only a valid log id", async () => {
  const calls = [];
  globalThis.fetch = async (url, opts) => { calls.push({ url, opts }); return new Response("", { status: 204 }); };
  await recordScanCorrection("not-an-id", { parallelId: "null" });
  assert.equal(calls.length, 0);
  await recordScanCorrection(ID, { parallelId: "null" });
  assert.equal(calls[0].opts.method, "PATCH");
  assert.match(calls[0].url, new RegExp(`id=eq\\.${ID}$`));
});

test("API call totals go to the usage counter, and zero calls are skipped", async () => {
  const calls = [];
  globalThis.fetch = async (url, opts) => { calls.push({ url, opts }); return new Response("", { status: 204 }); };
  await countApiCalls("cardsight", 0);
  assert.equal(calls.length, 0);
  await countApiCalls("cardsight", 4);
  assert.match(calls[0].url, /\/rest\/v1\/rpc\/gv_count_api_calls$/);
  assert.deepEqual(JSON.parse(calls[0].opts.body), { p_api: "cardsight", p_calls: 4 });
  globalThis.fetch = async () => { throw new Error("offline"); };
  await countApiCalls("cardsight", 1); // never throws
});

test("takeCardsightCalls returns and resets the count", () => {
  takeCardsightCalls();
  assert.equal(takeCardsightCalls(), 0);
});

test("GV_SCAN_LOG=0 turns logging off", async () => {
  process.env.GV_SCAN_LOG = "0";
  globalThis.fetch = async () => { throw new Error("should not be called"); };
  assert.equal(await writeScanLog({}), null);
  delete process.env.GV_SCAN_LOG;
});
