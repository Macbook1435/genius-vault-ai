import test from "node:test";
import assert from "node:assert/strict";
import { findProduct, findSubset, scannerChecklistReference } from "../api/_lib/checklist-registry.js";
import { findExactCardReference } from "../api/_data/exact-card-references.js";
import { buildFieldVerification } from "../api/_lib/verification.js";

test("Absolute Rookie Force accepts an RF-style number without inventing a parallel", () => {
  const card = { year: 2025, sport: "football", brand: "Panini", set: "Absolute Rookie Force", cardNumber: "RF-KWS", rookie: true, autograph: false };
  const found = findProduct(card);
  assert.equal(found.status, "matched");
  assert.equal(found.product.id, "2025-panini-absolute-football");
  const subset = findSubset(found.product, card);
  assert.equal(subset.status, "matched");
  assert.equal(subset.subset.id, "rookie_force");
  assert.equal(subset.numberFits, true);
  const checklist = scannerChecklistReference(card);
  assert.equal(checklist.status, "needs_source_review");
  assert.equal(checklist.checklist, null);
});

test("Absolute reference rejects unrelated number formats", () => {
  const card = { year: 2025, sport: "football", brand: "Panini", set: "Absolute Rookie Force", cardNumber: "340", rookie: true, autograph: false };
  assert.equal(findSubset(findProduct(card).product, card).numberFits, false);
  assert.equal(scannerChecklistReference(card).status, "subset_uncertain");
});

test("Kyle Williams exact-card reference confirms identity without inventing a parallel", () => {
  const card = {
    year: 2025, sport: "football", brand: "Panini", set: "Absolute Rookie Force",
    player: "Kyle Williams", cardNumber: "RF-KWS", rookie: true, autograph: false,
  };
  assert.equal(findExactCardReference(card)?.cardNumber, "RF-KWS");
  const verification = buildFieldVerification(card, { parallelId: { status: "unknown" } }, {});
  assert.equal(verification.fields.year.status, "confirmed");
  assert.equal(verification.fields.set.status, "confirmed");
  assert.equal(verification.fields.cardNumber.status, "confirmed");
  assert.equal(verification.fields.parallel.status, "unconfirmed");
  assert.equal(verification.fields.autograph.status, "unconfirmed");
});
