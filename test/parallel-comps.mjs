// Offline tests for parallel-specific sold comps. Run: node test/parallel-comps.mjs
// Uses made-up parallel names and ids only.
import assert from "assert/strict";
import { pickParallel, parallelCompsPlan } from "../api/cardsight.js";

const list = [
  { id: "p-bg", name: "Teal Sparkle" }, { id: "p-b", name: "Teal" }, { id: "p-g", name: "Amber /10", numberedTo: 10 },
  { id: "p-r", name: "Crimson Refractor", numberedTo: 99 }, { id: "p-x", name: "Violet", isPartial: true, cards: ["other-card"] },
];
let n = 0; const t = (name, fn) => { fn(); n++; };

t("exact name matches its own parallel, not a shorter one", () => {
  assert.equal(pickParallel(list, { name: "Teal Sparkle" }).parallel.id, "p-bg");
  assert.equal(pickParallel(list, { name: "teal" }).parallel.id, "p-b");
});
t("word order and the word 'parallel' do not matter", () => {
  assert.equal(pickParallel(list, { name: "Sparkle Teal Parallel" }).parallel.id, "p-bg");
});
t("a dropped finish word is allowed, a different color is not", () => {
  assert.equal(pickParallel(list, { name: "Crimson" }).parallel.id, "p-r");
  assert.equal(pickParallel(list, { name: "Scarlet" }).status, "not_in_catalog");
});
t("print run must agree when both are known", () => {
  assert.equal(pickParallel(list, { name: "Crimson Refractor", numberedTo: 50 }).status, "not_in_catalog");
  assert.equal(pickParallel(list, { name: "Crimson Refractor", numberedTo: 99 }).parallel.id, "p-r");
});
t("partial parallels only count for their own cards", () => {
  assert.equal(pickParallel(list, { name: "Violet", cardId: "this-card" }).status, "not_in_catalog");
  assert.equal(pickParallel(list, { name: "Violet", cardId: "other-card" }).parallel.id, "p-x");
});
t("two equal fits stay unmatched", () => {
  assert.equal(pickParallel([{ id: "a", name: "Teal" }, { id: "b", name: "Teal" }], { name: "Teal" }).status, "ambiguous");
});
t("plan: confirmed parallel -> parallel comps", () => {
  assert.deepEqual(parallelCompsPlan({ parallel: "Teal Sparkle", fieldStatus: "confirmed" }), { mode: "parallel", name: "Teal Sparkle" });
});
t("plan: unconfirmed parallel -> no comps", () => {
  assert.equal(parallelCompsPlan({ parallel: "Teal Sparkle", fieldStatus: "unconfirmed" }).mode, "blocked");
});
t("plan: no parallel read, nothing pending -> base comps", () => {
  assert.equal(parallelCompsPlan({ parallel: null, fieldStatus: "unconfirmed", pidStatus: "no_checklist" }).mode, "base");
  assert.equal(parallelCompsPlan({ parallel: "Base", fieldStatus: "confirmed", pidStatus: "base" }).mode, "base");
});
t("plan: checklist says it could be a parallel -> no comps", () => {
  for (const s of ["ambiguous", "probable", "no_match"]) assert.equal(parallelCompsPlan({ parallel: null, pidStatus: s }).mode, "blocked");
});
console.log(`parallel-comps: ${n} tests passed`);
t("plan: any verification step unsure blocks comps", () => {
  assert.equal(parallelCompsPlan({ parallel: null, pidStatuses: ["probable", "no_checklist"] }).mode, "blocked");
  assert.equal(parallelCompsPlan({ parallel: null, pidStatuses: ["no_checklist", "ambiguous"] }).mode, "blocked");
  assert.equal(parallelCompsPlan({ parallel: null, pidStatuses: ["no_checklist", "base"] }).mode, "base");
});
console.log("parallel-comps: multi-step check passed");
import { baseLookalikes, parallelOptions } from "../api/cardsight.js";
t("shiny-base lookalikes: unnumbered Holo/Refractor/Silver only", () => {
  const l = baseLookalikes([{ name: "Holo" }, { name: "Silver Prizm" }, { name: "Refractor" }, { name: "Gold Refractor", numberedTo: 50 }, { name: "Teal Sparkle" }, { name: "Holo", numberedTo: 99 }]);
  assert.deepEqual(l, ["Holo", "Silver Prizm", "Refractor"]);
  assert.deepEqual(baseLookalikes([{ name: "Rainbow Foil" }, { name: "Gold", numberedTo: 2018 }]), []);
});
t("picker options: Base first, partial parallels from other cards removed", () => {
  const o = parallelOptions([{ id: "p1", name: "Teal", numberedTo: 99 }, { id: "p2", name: "Holo" }, { id: "p3", name: "Violet", isPartial: true, cards: ["x"] }], "me");
  assert.equal(o[0].name, "Base"); assert.equal(o[0].id, "null");
  assert.deepEqual(o.map((x) => x.id), ["null", "p2", "p1"]);
});
console.log("parallel-comps: picker checks passed");
t("confirmed unnumbered card never matches a numbered parallel", () => {
  const l = [{ id: "n", name: "Blue", numberedTo: 249 }];
  assert.equal(pickParallel(l, { name: "Blue" }).status, "matched");
  assert.equal(pickParallel(l, { name: "Blue", unnumbered: true }).status, "not_in_catalog");
});
console.log("parallel-comps: unnumbered check passed");
import { suggestOptionIds } from "../api/cardsight.js";
t("shortlist maps to catalog names; vague words and numbered-on-unnumbered skipped", () => {
  const opts = [{ id: "null", name: "Base" }, { id: "h", name: "Holo" }, { id: "tg", name: "Rookie Teal Sparkle" }, { id: "th", name: "Rookie Teal Hyper" },
    { id: "ts", name: "Rookie Teal Scope" }, { id: "t249", name: "Teal", numberedTo: 249 }, { id: "tm", name: "Teal Mojo", numberedTo: 55 }];
  assert.deepEqual(suggestOptionIds(opts, ["Teal Sparkle", "Teal Hyper", "Base", "Holo"], { unnumbered: true }), ["tg", "th", "null", "h"]);
  assert.deepEqual(suggestOptionIds(opts, ["Teal"], { unnumbered: true }), ["tg", "th", "ts"]);
  assert.deepEqual(suggestOptionIds(opts, ["Teal"], { unnumbered: false }), ["t249"]);
});
console.log("parallel-comps: shortlist checks passed");
