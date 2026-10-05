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

export function confidenceRank(c) { return RANK[c] || 0; }

export default function handler(req, res) { return res.status(404).end(); }
