// Regression checks for sold-price bucket isolation. No API keys or network calls required.
import test from "node:test";
import assert from "node:assert/strict";
import { saleBucket } from "../api/cardsight.js";

const parallels = [
  { id: "red", name: "Red Pandora" },
  { id: "blue", name: "Blue Pandora" },
  { id: "gold", name: "Gold", numberedTo: 25 }
];
const record = (title, parallel_id = null) => ({ title, parallel_id });

test("clear Red Pandora listing belongs only to Red Pandora", () => {
  assert.equal(saleBucket(record("2025 Donruss Mason Graham #340 Red Pandora"), parallels), "red");
});
test("provider tag conflicting with title is excluded", () => {
  assert.equal(saleBucket(record("Mason Graham #340 Red Pandora", "blue"), parallels), "skip");
});
test("unnumbered base listing remains base", () => {
  assert.equal(saleBucket(record("2025 Donruss Mason Graham #340"), parallels), "null");
});
test("untagged serial numbered sale cannot contaminate base pricing", () => {
  assert.equal(saleBucket(record("Mason Graham #340 13/25"), parallels), "skip");
  assert.equal(saleBucket(record("Mason Graham #340 13/25"), []), "skip");
});
test("matching Gold /25 parallel is accepted", () => {
  assert.equal(saleBucket(record("Mason Graham #340 Gold 13/25"), parallels), "gold");
});
test("raw pricing excludes graded listings", () => {
  assert.equal(saleBucket(record("Mason Graham #340 PSA 10 Red Pandora"), parallels), "skip");
});
test("non-auto pricing excludes autograph listings", () => {
  assert.equal(saleBucket(record("Mason Graham #340 Auto"), parallels), "skip");
});
test("untagged base remains base without catalog parallels", () => {
  assert.equal(saleBucket(record("Mason Graham #340"), []), "null");
});
