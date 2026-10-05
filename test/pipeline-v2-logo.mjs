// Offline tests: logo route and copyright-year rules (made-up reads). Run: node test/pipeline-v2-logo.mjs
import assert from "assert/strict";
import { runPipelineV2, v2Extras } from "../api/_lib/pipeline-v2.js";

const LOGO = "2025-topps-resurgence-football";
assert.ok(v2Extras("strong").properties.productLogo.enum.includes(LOGO));
assert.ok(v2Extras("combined").prompt.includes(LOGO));

const base = { player: "ALEX DEMARCO", year: null, brand: "Topps", set: "Rookie", cardNumber: "150", parallel: null, numberedTo: 10, rookie: true, autograph: true };
const reads = (a = {}, b = {}, m = {}) => ({
  main: { ...base, evidence: { playerNameText: "ALEX DEMARCO", copyrightLineText: null }, ...m },
  combined: { playerNameText: "ALEX DEMARCO", cardNumberText: "150", sport: "football", parallelColor: "pink", parallelFinish: "unknown", eventYears: ["2025"], productLogo: LOGO, copyrightYearSeen: "2026", ...a },
  strong: { playerNameText: "ALEX DEMARCO", cardNumberText: "150", copyrightYearText: "2026", productLogo: LOGO, ...b },
});
const ver = { identity: {}, outside: { catalog: { status: "not_configured" } }, parallelId: { status: "none" } };
const run = (raw, scan = base) => runPipelineV2({ scan, raw, verification: ver, serialImage: true, tiebreak: null });

// Both checks see the logo, number fits, © 2026 fits a 2025 product → set + year confirmed.
let r = await run(reads());
assert.equal(r.product.id, LOGO);
assert.equal(r.product.route, "logo");
assert.equal(r.pipeline.fields.set.status, "confirmed");
assert.equal(r.pipeline.fields.year.status, "confirmed");
assert.equal(r.pipeline.fields.year.value, 2025);
assert.equal(r.subset.id, "rookie_auto");
assert.equal(r.parallel.status, "ambiguous"); // two pink /10 parallels → not guessed

// Checks disagree on the logo → no product.
r = await run(reads({}, { productLogo: "none" }));
assert.equal(r.product.status, "no_product");
assert.equal(r.pipeline.fields.set.status, "unconfirmed");

// Logo agrees but the card number fits none of its formats → not used.
r = await run(reads({ cardNumberText: "QX-77" }, { cardNumberText: "QX-77" }, { cardNumber: "QX-77" }), { ...base, cardNumber: "QX-77" });
assert.equal(r.product.status, "no_product");

// Copyright reads earlier than the printed draft year are ignored; product only "probable".
r = await run(reads({ copyrightYearSeen: "2023" }, { copyrightYearText: "2023" }));
assert.equal(r.product.id, LOGO);
assert.equal(r.product.yearConfirmed, false);
assert.equal(r.pipeline.fields.set.status, "unconfirmed");
assert.equal(r.pipeline.fields.year.status, "unconfirmed");
assert.equal(r.year.ignored.length, 2);

// A year that fits neither the product nor its copyright years blocks the product.
r = await run(reads({ copyrightYearSeen: "2028", eventYears: [] }, { copyrightYearText: "2028" }));
assert.equal(r.product.status, "no_product");

// Printed set name + © next year → product year confirmed.
const tc = { ...base, set: "Chrome", cardNumber: "350", autograph: false, numberedTo: null };
r = await run(reads({ cardNumberText: "350", productLogo: "none", parallelColor: null, parallelFinish: "no_shine" }, { cardNumberText: "350", productLogo: "none" }), tc);
assert.equal(r.product.id, "2025-topps-chrome-football");
assert.equal(r.product.route, "printed_name");
assert.equal(r.pipeline.fields.year.value, 2025);
assert.equal(r.pipeline.fields.year.status, "confirmed");
// 2 of 3: main scan + check B see the logo, check A does not → used.
r = await run(reads({ productLogo: "none" }, {}, { productLogo: LOGO }));
assert.equal(r.product.route, "logo");
// A check naming a different product blocks the logo route.
r = await run(reads({ productLogo: "none" }, { productLogo: "2025-topps-chrome-football" }, { productLogo: LOGO }));
assert.equal(r.product.status, "no_product");

// Zoomed copyright crop: two agreeing close-up reads outrank full-photo misreads.
const withCrop = (y1, y2, a = {}, b = {}) => ({ ...reads({ copyrightYearSeen: "2023", ...a }, { copyrightYearText: "2023", ...b }, { year: 2023 }), copyright: { status: "ok", reads: [{ by: "close-up A", year: y1 }, { by: "close-up B", year: y2 }] } });
r = await run(withCrop("2026", "2026", { eventYears: [] }));
assert.equal(r.year.closeup, 2026);
assert.equal(r.product.yearConfirmed, true);
assert.equal(r.pipeline.fields.year.value, 2025);
assert.equal(r.pipeline.fields.year.status, "confirmed");
assert.ok(r.pipeline.fields.year.basis.startsWith("Zoomed-in"));
assert.equal(r.year.superseded.length, 3);
// Close-up reads disagree → no override; full-photo 2023 reads (no event year) block the product.
r = await run(withCrop("2026", "2028", { eventYears: [] }));
assert.equal(r.year.closeup, null);
assert.equal(r.product.status, "no_product");
// One close-up read missing → just one more read, not an override.
r = await run(withCrop("2026", null));
assert.equal(r.year.closeup, null);
console.log("pipeline-v2 logo/year: all checks passed");
// Parallel tiebreak: confirms only when two independent closer looks agree.
{
  const tbScan = { ...base, numberedTo: 10 };
  const raw = { ...reads({ eventYears: [] }, {}, {}), copyright: { status: "ok", reads: [{ by: "close-up A", year: "2026" }, { by: "close-up B", year: "2026" }] } };
  let x = await runPipelineV2({ scan: tbScan, raw, verification: ver, serialImage: true, tiebreak: async (c) => ({ answer: c[0].name, reason: "t", agreed: false, second: c[1].name }) });
  assert.equal(x.parallel.status, "probable");
  assert.equal(x.pipeline.fields.parallel.status, "unconfirmed");
  x = await runPipelineV2({ scan: tbScan, raw, verification: ver, serialImage: true, tiebreak: async (c) => ({ answer: c[0].name, reason: "t", agreed: true }) });
  assert.equal(x.parallel.status, "confirmed");
  console.log("pipeline-v2 tiebreak: all checks passed");
}
