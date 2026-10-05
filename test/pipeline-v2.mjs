// Offline test of pipeline v2 with made-up reads (no AI calls). Run: node test/pipeline-v2.mjs
import assert from "assert/strict";
import { runPipelineV2, pipelineV2Mode } from "../api/_lib/pipeline-v2.js";

assert.equal(pipelineV2Mode({}), "off");
assert.equal(pipelineV2Mode({ pipeline: ["v2-shadow"] }), "shadow");
assert.equal(pipelineV2Mode({ pipeline: "v2" }), "off"); // only the exact test value turns it on

const scan = { player: "ALEX DE'MARCO", year: 2025, brand: "Topps", set: "Chrome", cardNumber: "RA-XY5", parallel: "Rookie Autograph", numberedTo: 250, rookie: true, autograph: true, serialNumber: null };
const raw = {
  main: { ...scan, evidence: { playerNameText: "ALEX DE'MARCO" } },
  combined: { playerNameText: "ALEX DEMARCO", cardNumberText: "RA-XYS", jerseyNumberText: "12", sport: "football", parallelColor: "pink", parallelFinish: "plain_refractor", stampedSerial: "1?/250" },
  strong: { playerNameText: "ALEX DEMARCO", cardNumberText: "RA-XYS", jerseyNumberText: "12", stampedSerial: null },
};
const verification = { identity: { yearOk: true }, outside: { catalog: { status: "not_configured" } }, parallelId: { status: "none" } };
const r = await runPipelineV2({ scan, raw, verification, serialImage: false, tiebreak: null });
assert.equal(r.scan.player, "ALEX DEMARCO");
assert.equal(r.scan.cardNumber, "RA-XYS");
assert.equal(r.product.id, "2025-topps-chrome-football");
assert.equal(r.subset.id, "rookie_auto");
assert.equal(r.parallel.name, "Pink Refractor");
assert.equal(r.pipeline.fields.parallel.status, "confirmed");
assert.equal(r.pipeline.fields.cardNumber.status, "unconfirmed"); // no card list yet
assert.equal(r.pipeline.fields.set.status, "confirmed");

// Unknown finish → Pink vs Pink Lava stays open, nothing guessed.
const r2 = await runPipelineV2({ scan, raw: { ...raw, combined: { ...raw.combined, parallelFinish: "unknown" } }, verification, serialImage: false, tiebreak: null });
assert.equal(r2.parallel.status, "ambiguous");
assert.equal(r2.scan.parallel, null);
assert.equal(r2.pipeline.fields.parallel.status, "unconfirmed");

// Unknown product → no checklist, everything checklist-based stays Unconfirmed.
const r3 = await runPipelineV2({ scan: { ...scan, set: "Something Else" }, raw, verification, serialImage: false, tiebreak: null });
assert.equal(r3.product.status, "no_product");
assert.equal(r3.pipeline.fields.set.status, "unconfirmed");
assert.equal(r3.pipeline.fields.parallel.status, "unconfirmed");
console.log("pipeline-v2: all checks passed");
// A serial seen by both checks (not confirmed) must never become "no serial".
{
  const v = { ...verification, detailCheck: { stampedSerial: "1?/250" } };
  const rr = { ...raw, strong: { ...raw.strong, stampedSerial: "1?/250" } };
  const r4 = await runPipelineV2({ scan: { ...scan, numberedTo: null }, raw: rr, verification: v, serialImage: false, tiebreak: null });
  assert.equal(r4.pipeline.fields.serial.status, "unconfirmed");
  console.log("pipeline-v2: serial-hint check passed");
}
