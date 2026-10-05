// Product checklist registry: find the product (year + sport + brand + set), the subset
// (base / rookies / rookie autographs / ...) and the parallel — all from data files in
// api/_data/checklists. No individual cards are coded here.
import { PRODUCTS } from "../_data/checklists/index.js";
import { cleanCardNumber, fitsFormat } from "./card-number.js";

const norm = (v) => String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export function listProducts() {
  return PRODUCTS.map((p) => ({ id: p.id, label: p.label, year: p.year, sport: p.sport, subsets: p.subsets.map((s) => s.id) }));
}

/**
 * Find the product for a card. Requires year, brand and set words to fit; sport must not
 * conflict. If two products fit equally (e.g. same brand/set in two sports and sport is
 * unknown), nothing is chosen.
 */
export function findProduct(card, products = PRODUCTS) {
  const text = ` ${norm(card.brand)} ${norm(card.set)} `;
  const brand = norm(card.brand);
  const sport = norm(card.sport);
  const scored = [];
  for (const p of products) {
    if (!card.year || Number(card.year) !== p.year) continue;
    if (sport && sport !== "unknown" && sport !== "other" && p.sport && sport !== p.sport) continue;
    const brands = [p.brand, ...(p.brandAliases || [])].map(norm);
    const brandOk = brands.some((b) => brand === b || text.includes(` ${b} `));
    if (!brandOk) continue;
    const hasWord = (w) => text.includes(` ${norm(w)} `) || text.includes(norm(w));
    if (!(p.match.include || []).every(hasWord)) continue;
    // includeAny: at least one group of words must all be present (e.g. the set name OR a
    // product-specific insert name printed on the card).
    const anyGroup = (p.match.includeAny || []).find((g) => g.every(hasWord));
    if (p.match.includeAny?.length && !anyGroup) continue;
    if ((p.match.exclude || []).some(hasWord)) continue;
    scored.push({ p, score: (p.match.include || []).length + (anyGroup ? anyGroup.length : 0) + (sport === p.sport ? 2 : 0) + (brand === norm(p.brand) ? 1 : 0) });
  }
  scored.sort((a, b) => b.score - a.score);
  if (!scored.length) return { product: null, status: "no_product" };
  if (scored.length > 1 && scored[0].score === scored[1].score) {
    return { product: null, status: "ambiguous", candidates: scored.map((s) => s.p.label) };
  }
  return { product: scored[0].p, status: "matched" };
}

/**
 * Pick the subset. The card number format decides first; the rookie/autograph marks
 * narrow further. If several subsets remain, their parallel lists are combined.
 */
export function findSubset(product, card) {
  const num = cleanCardNumber(card.cardNumber);
  let list = product.subsets.slice();
  const steps = [];
  let numberFits = null;
  if (num) {
    const byNumber = list.filter((s) => fitsFormat(num, s.numberFormats));
    numberFits = byNumber.length > 0;
    if (byNumber.length) {
      list = byNumber;
      steps.push(`card number ${num}`);
    } else {
      steps.push(`card number ${num} fits no subset`);
    }
  }
  const byAuto = list.filter((s) => Boolean(s.auto) === Boolean(card.autograph));
  if (byAuto.length) { list = byAuto; steps.push(card.autograph ? "autograph" : "no autograph"); }
  const byRookie = list.filter((s) => Boolean(s.rookie) === Boolean(card.rookie));
  if (byRookie.length) { list = byRookie; steps.push(card.rookie ? "rookie" : "not rookie"); }

  const tag = (s) => s.parallels.map((par) => (s.finish ? { ...par, finish: s.finish } : par));
  if (list.length === 1) return { subset: { ...list[0], parallels: tag(list[0]) }, status: "matched", numberFits, steps };
  // Several subsets: combine their parallels (same name + print run counted once).
  const seen = new Map();
  for (const s of list) for (const par of tag(s)) {
    const k = `${par.key}|${par.numberedTo}|${par.finish || ""}`;
    if (!seen.has(k)) seen.set(k, par);
    else if (!par.verified) seen.set(k, { ...seen.get(k), verified: seen.get(k).verified });
  }
  return {
    subset: { id: list.map((s) => s.id).join("+"), label: list.map((s) => s.label).join(" / "), parallels: [...seen.values()], combined: true },
    status: "combined",
    numberFits,
    steps,
  };
}
