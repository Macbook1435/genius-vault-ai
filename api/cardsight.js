// Server-side CardSight AI helper. The API key is read from process.env only and never returned to the browser.
const BASE = "https://api.cardsight.ai";

function key() { return process.env.CARDSIGHT_API_KEY || ""; }
export function cardsightConfigured() { return Boolean(key()); }

async function call(path, options = {}) {
  const response = await fetch(BASE + path, { ...options, headers: { "X-API-Key": key(), ...(options.headers || {}) },
    signal: AbortSignal.timeout(25000) });
  const text = await response.text();
  let body = null; try { body = JSON.parse(text); } catch { body = null; }
  if (!response.ok) { const err = new Error(`CardSight ${response.status}: ${body?.error?.message || body?.message || body?.error || "request failed"}`); err.status = response.status; throw err; }
  return body;
}

export async function cardsightHealth() { return call("/health/auth"); }

// Identify the card in an uploaded image buffer. Returns the best detection or null.
export async function cardsightIdentify(buffer, mimetype) {
  const form = new FormData();
  form.append("image", new Blob([buffer], { type: mimetype || "image/jpeg" }), "card.jpg");
  const body = await call("/v1/identify/card", { method: "POST", body: form });
  const detections = Array.isArray(body?.detections) ? body.detections : [];
  return { requestId: body?.requestId || null, detection: detections[0] || null, count: detections.length };
}

const RANK = { High: 3, Medium: 2, Low: 1 };

// Decide which parallel (if any) is supported. Only a single High-confidence suggestion counts as confirmed.
export function resolveParallel(card) {
  const list = Array.isArray(card?.parallelSuggestions) ? card.parallelSuggestions : [];
  if (!list.length) return { status: "none_detected", parallel: null, candidates: [] };
  const high = list.filter(p => p.confidence === "High");
  if (list.length === 1 && high.length === 1) return { status: "confirmed", parallel: high[0], candidates: [] };
  return { status: "uncertain", parallel: null,
    candidates: list.slice(0, 5).map(p => ({ id: p.id, name: p.name, confidence: p.confidence || "not assessed", numberedTo: p.numberedTo || null })) };
}

function median(values) { const s = [...values].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

// Completed AUCTION sales only (CardSight "bid" side). Buy It Now asks are excluded because they are not proof of a sale.
export async function cardsightSoldComps(cardId, { parallelId = "null", gradeId = "null" } = {}) {
  const qs = new URLSearchParams({ listing_type: "auction", period: "6m", limit: "100", parallel_id: parallelId, grade_id: gradeId });
  const body = await call(`/v1/pricing/${encodeURIComponent(cardId)}?${qs}`);
  const groups = gradeId === "null" ? [body?.raw] : (body?.graded || []).flatMap(c => (c.grades || []).filter(g => g.grade_id === gradeId));
  const records = groups.flatMap(g => g?.records || [])
    .filter(r => r && r.listing_type === "auction" && Number.isFinite(r.price) && r.price > 0 && r.url)
    .filter(r => parallelId === "null" ? !r.parallel_id : r.parallel_id === parallelId)
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const prices = records.map(r => r.price);
  return {
    source: "cardsight_completed_auctions", currency: "USD", count: records.length,
    min: prices.length ? Math.min(...prices) : null, max: prices.length ? Math.max(...prices) : null,
    median: prices.length ? Math.round(median(prices) * 100) / 100 : null,
    items: records.slice(0, 15).map(r => ({ title: r.title || null, price: r.price, date: r.date || null, source: r.source || null, url: r.url })),
    catalogCard: body?.card ? { name: body.card.name, number: body.card.number, set: body.card.set, parallel: body.card.parallel || null } : null
  };
}

// ---- Lookup by verified details (fallback when the photo match is a different card) ----
const code = (v) => String(v ?? "").toUpperCase().replace(/^#/, "").replace(/[^A-Z0-9]/g, "");
const words = (v) => String(v ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);

// Pick the one catalog card that fits the verified player + card number + year (+ set words when given).
// Returns { status: "matched", card } only when exactly one base card fits; otherwise no match (no guessing).
const isAutoCard = (c) => (c.attributes || []).includes("AUTO") || /autograph|\bauto\b|signature/i.test(`${c.setName || ""}`);
const isRelicCard = (c) => /relic|memorabilia|patch|jersey|swatch/i.test(`${c.setName || ""}`);

export function pickCatalogCard(cards, { player, number, year, set, brand, autograph, memorabilia } = {}) {
  const last = words(player).pop();
  const num = code(number);
  if (!last || !num) return { status: "not_enough_details", card: null, count: 0 };
  let fits = (Array.isArray(cards) ? cards : []).filter((c) => c && c.id
    && code(c.number) === num
    && words(c.name).includes(last)
    && (!year || !c.releaseYear || String(c.releaseYear).startsWith(String(year)))
    && !c.variationOf && !c.isParallelOnly);
  // Autograph / relic must agree with what the scan saw (only when the scan said yes or no).
  if (autograph === true) fits = fits.filter(isAutoCard);
  if (autograph === false) fits = fits.filter((c) => !isAutoCard(c));
  if (memorabilia === false) fits = fits.filter((c) => !isRelicCard(c));
  if (fits.length > 1) {
    // Narrow with the set words we read (e.g. "Update"), ignoring the brand name and generic words.
    const skip = new Set([...words(brand), "base", "set", "series", "card", "cards"]);
    const want = words(set).filter((w) => !skip.has(w) && !/^\d+$/.test(w));
    if (want.length) {
      const narrowed = fits.filter((c) => { const have = new Set(words(`${c.releaseName || ""} ${c.setName || ""}`)); return want.every((w) => have.has(w)); });
      if (narrowed.length) fits = narrowed;
    }
  }
  if (fits.length === 1) return { status: "matched", card: fits[0], count: 1 };
  const candidates = fits.slice(0, 10).map((c) => ({ id: c.id, name: c.name, number: c.number, release: c.releaseName || null, set: c.setName || null,
    year: c.releaseYear || null, attributes: c.attributes || [], description: c.description || null }));
  return { status: fits.length ? "ambiguous" : "no_match", card: null, count: fits.length, candidates };
}

export async function cardsightFindByDetails(details) {
  const last = words(details?.player).pop();
  if (!last || !code(details?.number)) return { status: "not_enough_details", card: null, count: 0 };
  const qs = new URLSearchParams({ name: last, number: String(details.number).replace(/^#/, ""), take: "50" });
  if (details.year) qs.set("year", String(details.year));
  const body = await call(`/v1/catalog/cards?${qs}`);
  return pickCatalogCard(body?.cards, details);
}

// ---- Parallel comps: map the confirmed parallel name to CardSight's parallel for this card ----
const FINISH_WORDS = new Set(["refractor", "prizm", "parallel", "foil"]);
const wordSet = (v) => new Set(words(v).filter((w) => w !== "parallel"));
const sameSet = (a, b) => a.size === b.size && [...a].every((w) => b.has(w));

// Exactly one CardSight parallel must fit (same words, same print run when known); otherwise no match.
export function pickParallel(parallels, { name, numberedTo, cardId } = {}) {
  const want = wordSet(name);
  if (!want.size) return { status: "no_name", parallel: null };
  const list = (Array.isArray(parallels) ? parallels : []).filter((p) => p && p.id && p.name
    && (!p.isPartial || !Array.isArray(p.cards) || !cardId || p.cards.includes(cardId))
    && (!numberedTo || !p.numberedTo || Number(p.numberedTo) === Number(numberedTo)));
  let fits = list.filter((p) => sameSet(wordSet(p.name), want));
  if (!fits.length) {
    // Allow only a dropped finish word (e.g. "Blue Refractor" vs "Blue"), never a different color or name.
    const core = (s) => new Set([...s].filter((w) => !FINISH_WORDS.has(w)));
    const wantCore = core(want);
    if (wantCore.size) fits = list.filter((p) => sameSet(core(wordSet(p.name)), wantCore));
  }
  if (fits.length === 1) return { status: "matched", parallel: fits[0] };
  return { status: fits.length ? "ambiguous" : "not_in_catalog", parallel: null,
    candidates: fits.slice(0, 5).map((p) => p.name) };
}

// Decide which comps are allowed for the parallel: base, one confirmed parallel, or none.
export function parallelCompsPlan({ parallel, fieldStatus, pidStatus } = {}) {
  const name = String(parallel ?? "").trim();
  const hasName = name && !/^(base|null|none|unknown)$/i.test(name);
  if (hasName) {
    return fieldStatus === "confirmed" ? { mode: "parallel", name }
      : { mode: "blocked", reason: `Parallel "${name}" is not confirmed, so sold prices are not shown (base-card prices would be misleading).` };
  }
  if (["ambiguous", "probable", "no_match"].includes(pidStatus)) {
    return { mode: "blocked", reason: "The parallel is not settled, so sold prices are not shown." };
  }
  return { mode: "base" };
}

export async function cardsightCardParallels(cardId) {
  const body = await call(`/v1/catalog/cards/${encodeURIComponent(cardId)}`);
  return Array.isArray(body?.parallels) ? body.parallels : [];
}

export function confidenceRank(c) { return RANK[c] || 0; }

export default function handler(req, res) { return res.status(404).end(); }
