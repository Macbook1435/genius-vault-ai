// Unit tests for the generic v2 helpers. Run: node test/unit.mjs
// Uses made-up names and numbers only.
import assert from "assert/strict";
import { cleanCardNumber, lookAlikeKey, resolveCardNumberReads, fitsFormat } from "../api/_lib/card-number.js";
import { resolvePlayerNameReads, samePlayer } from "../api/_lib/player-name.js";
import { parallelKey } from "../api/_lib/parallel-key.js";
import { matchParallel, isCardTypeNotParallel } from "../api/_lib/parallel-match.js";
import { findProduct, findSubset } from "../api/_lib/checklist-registry.js";

let n = 0;
const t = (name, fn) => { fn(); n++; };

// --- card numbers ---
t("labels", () => {
  assert.equal(cleanCardNumber("#AB-7"), "AB-7");
  assert.equal(cleanCardNumber("No. 101"), "101");
  assert.equal(cleanCardNumber("Card # 45"), "45");
  assert.equal(cleanCardNumber("ID# XY–12"), "XY-12");
  assert.equal(cleanCardNumber("xy — 12"), "XY-12");
  assert.equal(cleanCardNumber("NOV-3"), "NOV-3");   // real prefix kept
  assert.equal(cleanCardNumber("IDA-5"), "IDA-5");   // real prefix kept
});
t("look-alikes", () => {
  assert.equal(lookAlikeKey("QR-XT5"), lookAlikeKey("QR-XTS"));
  assert.equal(lookAlikeKey("QR-1TS"), lookAlikeKey("QR-ITS"));
  assert.notEqual(lookAlikeKey("QR-15"), lookAlikeKey("QR-ITS"));
});
t("agreement", () => {
  assert.equal(resolveCardNumberReads(["QR-XTS", "QR-XTS", "QR-XT5"]).value, "QR-XTS");
  assert.equal(resolveCardNumberReads(["QR-ITS", "QR-1TS", "QR-IT5"]).value, "QR-ITS");
  assert.equal(resolveCardNumberReads(["QR-XTS", "QR-15", "QR-XTS"]).value, "QR-XTS");
  assert.equal(resolveCardNumberReads(["B-7", "B-7", "AB-7"]).value, "AB-7");          // dropped prefix
  assert.equal(resolveCardNumberReads(["AB-7", "AB-7", "AG-7"]).value, "AB-7");        // majority
  assert.equal(resolveCardNumberReads(["AB-7", "CD-9", null]).value, null);           // tie, no format
  assert.equal(resolveCardNumberReads(["AB-7", "77", null], { formats: [{ regex: "^AB-\\d+$" }] }).value, "AB-7");
  assert.equal(resolveCardNumberReads(["F15-1", "F15-1", "FIS-1"]).value, "F15-1");   // real mixed part kept
  assert.equal(resolveCardNumberReads(["F15-1", "FIS-1"]).value, null);               // 2-read tie, no format
  assert.equal(resolveCardNumberReads(["F15-1", "FIS-1"], { formats: [{ regex: "^F15-\\d+$" }] }).value, "F15-1");
  assert.equal(resolveCardNumberReads(["QR-ITS", "QR-ATS", "QR-1TS"], { formats: [{ regex: "^QR-[A-Z]{2,5}$" }] }).value, "QR-ITS");
  assert.equal(resolveCardNumberReads(["14", "14", "14"], { jerseyNumbers: ["14"] }).value, null); // jersey
  assert.equal(resolveCardNumberReads(["131", "131", "131"]).value, "131");
  assert.equal(resolveCardNumberReads(["131", "31", "31"]).value, "31");              // digit prefix not assumed
  assert.equal(resolveCardNumberReads([null, null, null]).status, "unreadable");
  assert.equal(resolveCardNumberReads(["225", null, null]).value, null);               // one read only
  assert.ok(fitsFormat("350", [{ range: [301, 400] }]));
  assert.ok(!fitsFormat("250", [{ range: [301, 400] }]));
});

// --- player names ---
t("names", () => {
  assert.equal(resolvePlayerNameReads(["JOHN SMITH", "JOHN SMITH", "JOHN SMlTH"]).value, "JOHN SMITH");
  assert.equal(resolvePlayerNameReads(["ALEX DE'MARCO", "ALEX DEMARCO", "ALEX DEMARCO"]).value, "ALEX DEMARCO");   // lone apostrophe dropped
  assert.equal(resolvePlayerNameReads(["Sam O'Neil", "SAM O'NEIL", "Sam ONeil"]).value, "Sam O'Neil");            // kept: 2 reads saw it
  assert.equal(resolvePlayerNameReads(["José Pérez", "JOSE PEREZ", "Jose Perez"]).status, "agreed");
  assert.equal(resolvePlayerNameReads(["Chris Lane Jr.", "CHRIS LANE JR", "Chris Lane"]).value.endsWith("Jr."), true);
  assert.equal(resolvePlayerNameReads(["Mike Brown", "Matt Green", "Kyle White"]).value, null);
  assert.equal(resolvePlayerNameReads(["Jordan Ellison", "Jordan Elison", null]).status, "one_letter_majority");
  assert.ok(samePlayer("Ty Mc-Neal", "TY MCNEAL"));
});

// --- parallel keys + matching ---
t("keys", () => {
  assert.equal(parallelKey("Pink Refractors"), parallelKey("Pink Refractor"));
  assert.equal(parallelKey("Football Leather Green"), parallelKey("Green Football Leather Refractor"));
  assert.equal(parallelKey("Ray Wave Refractor"), parallelKey("RayWave"));
  assert.equal(parallelKey("Rookie Prizm Blue Ice"), parallelKey("Blue Ice Prizms"));
  assert.equal(parallelKey("Refractor"), "refractor");
  assert.equal(parallelKey("Rookie"), "");
  assert.ok(isCardTypeNotParallel("Rookies Autograph Variation"));
  assert.ok(!isCardTypeNotParallel("Gold Wave"));
});
const list = [
  { name: "Refractor", numberedTo: 499, verified: true }, { name: "Pink Refractor", numberedTo: 250, verified: true },
  { name: "Pink Lava Refractor", numberedTo: 250, verified: true }, { name: "Gold Wave Refractor", numberedTo: 50, verified: true },
  { name: "Gold Refractor", numberedTo: 50, verified: true }, { name: "Odd Refractor", numberedTo: 77, verified: false },
];
t("matching", () => {
  assert.equal(matchParallel(list, { numberedTo: 250, color: "pink", finish: "plain_refractor" }).parallel.name, "Pink Refractor");
  assert.equal(matchParallel(list, { numberedTo: 250, color: "pink", finish: "lava" }).parallel.name, "Pink Lava Refractor");
  assert.equal(matchParallel(list, { numberedTo: 250, color: "pink", finish: "unknown" }).status, "ambiguous");
  assert.equal(matchParallel(list, { numberedTo: 250, color: "magenta", finish: "plain_refractor" }).parallel.name, "Pink Refractor");
  assert.equal(matchParallel(list, { numberedTo: 77, color: null, finish: "plain_refractor" }).status, "single_source");
  assert.equal(matchParallel(list, { numberedTo: 250, color: "pink", finish: "plain_refractor" }).status, "confirmed");
  assert.equal(matchParallel(list, { numberedTo: "any", color: "gold", finish: "wave" }).status, "probable");
  assert.equal(matchParallel(list, { numberedTo: null, color: null, finish: "no_shine" }).status, "base");
  assert.equal(matchParallel(list, { numberedTo: 999, color: "red", finish: "plain_refractor" }).status, "no_match");
});

// --- registry ---
t("products", () => {
  const fb = findProduct({ year: 2025, brand: "Topps", set: "Chrome", sport: "football" });
  assert.equal(fb.product?.id, "2025-topps-chrome-football");
  const bb = findProduct({ year: 2025, brand: "Topps", set: "Chrome", sport: "baseball" });
  assert.equal(bb.product?.id, "2025-topps-chrome-baseball");
  assert.equal(findProduct({ year: 2025, brand: "Topps", set: "Chrome", sport: "unknown" }).status, "ambiguous");
  assert.equal(findProduct({ year: 2025, brand: "Topps", set: "Chrome Black", sport: "football" }).status, "no_product");
  assert.equal(findProduct({ year: 2024, brand: "Topps", set: "Chrome", sport: "football" }).status, "no_product");
  assert.equal(findProduct({ year: 2025, brand: "Topps", set: "Bowman Chrome", sport: "baseball" }).product?.id, "2025-bowman-chrome-baseball");
  assert.equal(findProduct({ year: 2025, brand: "Panini", set: "Prizm", sport: "football" }).product?.id, "2025-panini-prizm-football");
  assert.equal(findProduct({ year: 2025, brand: "Donruss", set: "Optic", sport: "football" }).product?.id, "2025-donruss-optic-football");
  const p = fb.product;
  assert.equal(findSubset(p, { cardNumber: "RA-ABC", autograph: true, rookie: true }).subset.id, "rookie_auto");
  assert.equal(findSubset(p, { cardNumber: "350", autograph: false, rookie: true }).subset.id, "base_rookie");
  assert.equal(findSubset(p, { cardNumber: "12", autograph: false, rookie: false }).subset.id, "base_vet");
  assert.equal(findSubset(p, { cardNumber: null, autograph: true, rookie: true }).subset.id, "rookie_auto");
  assert.equal(findSubset(p, { cardNumber: "ZZ-9", autograph: false, rookie: false }).numberFits, false);
  const ra = findSubset(p, { cardNumber: "RA-ABC", autograph: true, rookie: true }).subset;
  assert.equal(matchParallel(ra.parallels, { numberedTo: 250, color: "pink", finish: "unknown" }).candidates.map((c) => c.name).sort().join("|"), "Pink Lava Refractor|Pink Refractor");
});
t("logo-only and insert products", () => {
  const sc = findProduct({ year: 2025, brand: "Topps", set: "First Class", sport: "football" });
  assert.equal(sc.product?.id, "2025-topps-signature-class-football");
  assert.equal(findProduct({ year: 2025, brand: "Topps", set: "Signature Class", sport: "football" }).product?.id, "2025-topps-signature-class-football");
  assert.equal(findSubset(sc.product, { cardNumber: "FC-7", rookie: true, autograph: false }).subset.id, "first_class");
  assert.equal(findSubset(sc.product, { cardNumber: "SC-AB", autograph: true }).subset.id, "sig_classics"); // letters → autograph set
  assert.equal(findSubset(sc.product, { cardNumber: "SC-12", autograph: false }).subset.id, "star_cast");   // digits → insert
  // Paper and chrome versions share numbers; the finish decides.
  const base = findSubset(sc.product, { cardNumber: "120", rookie: true, autograph: false }).subset;
  assert.equal(matchParallel(base.parallels, { numberedTo: 50, color: "orange", finish: "no_shine" }).status, "ambiguous"); // Orange vs Orange Lava (paper)
  assert.equal(matchParallel(base.parallels, { numberedTo: 50, color: "orange", finish: "lava" }).parallel?.name, "Orange Lava Refractor");
  assert.equal(matchParallel(base.parallels, { numberedTo: 35, color: "gold", finish: "no_shine" }).parallel?.name, "Gold");
  assert.equal(matchParallel(base.parallels, { numberedTo: 35, color: "gold", finish: "plain_refractor" }).parallel?.name, "Gold Refractor");
  const rs = findProduct({ year: 2025, brand: "Topps", set: "Resurgence", sport: "football" });
  assert.equal(rs.product?.id, "2025-topps-resurgence-football");
  const ra = findSubset(rs.product, { cardNumber: "150", rookie: true, autograph: true }).subset;
  assert.equal(ra.id, "rookie_auto");
  assert.deepEqual(matchParallel(ra.parallels, { numberedTo: 10, color: "pink", finish: "unknown" }).candidates.map((c) => c.name).sort(), ["Pink Power Surge", "Pink Static"]);
  assert.equal(findSubset(rs.product, { cardNumber: "RRS-AB", rookie: true, autograph: true }).subset.id, "rookie_relic_sigs");
});
console.log(`unit: ${n} groups passed`);
