// Offline tests for the CardSight lookup-by-details fallback. Run: node test/catalog-lookup.mjs
// Uses made-up names, numbers and ids only.
import assert from "assert/strict";
import { pickCatalogCard } from "../api/cardsight.js";

const base = { id: "a1", name: "Sam Example", number: "XU7", releaseName: "Brandco Refresh", setName: "Base Set", releaseYear: "2019" };
let n = 0; const t = (name, fn) => { fn(); n++; };

t("one exact fit matches", () => {
  const r = pickCatalogCard([base, { ...base, id: "b2", number: "XU8" }], { player: "SAM EXAMPLE", number: "#XU7", year: 2019 });
  assert.equal(r.status, "matched"); assert.equal(r.card.id, "a1");
});
t("wrong number or player never matches", () => {
  assert.equal(pickCatalogCard([base], { player: "Sam Example", number: "XU9", year: 2019 }).status, "no_match");
  assert.equal(pickCatalogCard([base], { player: "Pat Other", number: "XU7", year: 2019 }).status, "no_match");
});
t("wrong year never matches", () => {
  assert.equal(pickCatalogCard([base], { player: "Sam Example", number: "XU7", year: 2020 }).status, "no_match");
});
t("variations and parallel-only cards are skipped", () => {
  const r = pickCatalogCard([base, { ...base, id: "v1", variationOf: "a1" }, { ...base, id: "p1", isParallelOnly: true }], { player: "Sam Example", number: "XU7", year: 2019 });
  assert.equal(r.status, "matched"); assert.equal(r.card.id, "a1");
});
t("two fits narrowed by set words", () => {
  const other = { ...base, id: "c3", releaseName: "Brandco Shine" };
  const r = pickCatalogCard([base, other], { player: "Sam Example", number: "XU7", year: 2019, set: "Refresh", brand: "Brandco" });
  assert.equal(r.status, "matched"); assert.equal(r.card.id, "a1");
});
t("two fits with no way to choose stays unmatched", () => {
  const other = { ...base, id: "c3", releaseName: "Brandco Shine" };
  const r = pickCatalogCard([base, other], { player: "Sam Example", number: "XU7", year: 2019 });
  assert.equal(r.status, "ambiguous"); assert.equal(r.card, null);
});
t("missing number means no lookup", () => {
  assert.equal(pickCatalogCard([base], { player: "Sam Example", number: null }).status, "not_enough_details");
});
console.log(`catalog-lookup: ${n} tests passed`);
t("non-auto card skips autograph sets", () => {
  const cards = [{ ...base, id: "au1", setName: "Autographs", attributes: ["AUTO"] }, { ...base, id: "au2", setName: "Rookie Autographs" }, base];
  const r = pickCatalogCard(cards, { player: "Sam Example", number: "XU7", year: 2019, autograph: false, memorabilia: false });
  assert.equal(r.status, "matched"); assert.equal(r.card.id, "a1");
});
t("auto card keeps only autograph sets", () => {
  const cards = [{ ...base, id: "au1", setName: "Autographs", attributes: ["AUTO"] }, base];
  const r = pickCatalogCard(cards, { player: "Sam Example", number: "XU7", year: 2019, autograph: true });
  assert.equal(r.status, "matched"); assert.equal(r.card.id, "au1");
});
t("autograph unknown keeps all (stays ambiguous)", () => {
  const cards = [{ ...base, id: "au1", setName: "Autographs", attributes: ["AUTO"] }, base];
  assert.equal(pickCatalogCard(cards, { player: "Sam Example", number: "XU7", year: 2019 }).status, "ambiguous");
});
console.log(`catalog-lookup: extra autograph tests passed`);
import { isAutoCard } from "../api/cardsight.js";
t("same number, auto vs non-auto version picked by the scan", () => {
  const cards = [{ ...base, id: "plain", setName: "Base Set" }, { ...base, id: "sig", setName: "Rookie Signatures", attributes: ["AUTO"] }];
  assert.equal(pickCatalogCard(cards, { player: "Sam Example", number: "XU7", year: 2019, autograph: true }).card.id, "sig");
  assert.equal(pickCatalogCard(cards, { player: "Sam Example", number: "XU7", year: 2019, autograph: false }).card.id, "plain");
  assert.equal(isAutoCard({ attributes: ["Autograph"] }), true);
  assert.equal(isAutoCard({ setName: "Brandco Rookie Signatures" }), true);
  assert.equal(isAutoCard({ setName: "Brandco Base Set", attributes: ["Rookie"] }), false);
});
t("patch card keeps only relic versions", () => {
  const cards = [{ ...base, id: "plain" }, { ...base, id: "rel", setName: "Rookie Relic Signatures", attributes: ["AUTO"] }];
  assert.equal(pickCatalogCard(cards, { player: "Sam Example", number: "XU7", year: 2019, autograph: true, memorabilia: true }).card.id, "rel");
});
console.log("catalog-lookup: version checks passed");
