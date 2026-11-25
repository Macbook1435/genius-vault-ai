// Second sold-price source: TheCardAPI market sales (eBay sold records).
// Used for cards the catalog does not cover. Dormant until THECARDAPI_KEY is set.
// The key is sent only in a request header and is never logged or returned.
const BASE = "https://www.thecardapi.com/api/v1/market/sales";
const LIMIT = 40;

// Use only the tca_ token, even if extra text was pasted around it in the settings box.
export function cardApiKey() {
  const raw = String(process.env.THECARDAPI_KEY || "");
  const m = raw.match(/tca_[A-Za-z0-9_-]+/);
  if (m) return m[0];
  const t = raw.trim();
  return /^[\x21-\x7e]+$/.test(t) ? t : "";
}
export function cardApiConfigured() {
  return Boolean(cardApiKey());
}
// Never let the key reach a log line.
const mask = (v) => {
  let s = String(v ?? "").replace(/tca_[A-Za-z0-9_-]+/g, "tca_***");
  const key = cardApiKey();
  if (key) s = s.split(key).join("***");
  return s.slice(0, 200);
};

const clean = (v) => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return /^(unknown|n\/a|none|no|null|undefined|not visible|base|unconfirmed)$/i.test(s) ? "" : s;
};

// Search text: the player as an exact phrase, plus year, set and parallel words.
// The card number and print run are left to the strict title audit, because
// seller titles write them many ways (#RP-JAN, RPJAN, 08/15, /15).
export function buildCardApiQuery(card = {}) {
  const player = clean(card.player).replace(/"/g, "");
  if (!player) return "";
  const brand = clean(card.brand), set = clean(card.set);
  const setText = brand && !set.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${set}` : set || brand;
  // Year and parallel stay out of the search: a misread year (2025 vs 2026) or a color
  // the seller omits would hide real sales. The strict title audit checks both.
  const words = [setText].join(" ")
    .replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();
  return `"${player}" ${words}`.trim();
}

export function cardApiParams(card = {}) {
  const p = new URLSearchParams({ q: buildCardApiQuery(card), platform: "ebay",
    listing_type: "auction,fixed_price,best_offer", sort: "date_desc", limit: String(LIMIT) });
  if (card.grade && clean(card.gradingCompany)) {
    p.set("graded", "true"); p.set("grader", clean(card.gradingCompany)); p.set("grade", String(card.grade));
  } else if (!card.grade) p.set("graded", "false");
  return p;
}

// Map a provider row to our sale item. Never use an asking price as a sale price:
// best offers count only when the accepted price is confirmed.
export function mapCardApiRow(r) {
  if (!r || typeof r !== "object") return null;
  const price = Number(r.price);
  if (r.price == null || !Number.isFinite(price) || price <= 0) return null;
  if (String(r.listing_type || "").toLowerCase() === "best_offer" && r.price_confirmed !== true) return null;
  if (r.currency && String(r.currency).toUpperCase() !== "USD") return null;
  let url = null;
  try { const u = new URL(String(r.listing_url || "")); if (/^https?:$/.test(u.protocol)) url = u.href; } catch {}
  return { title: String(r.title || ""), price: Math.round(price * 100) / 100,
    date: r.sale_date || r.sold_at || null, url, listingType: r.listing_type || null,
    source: "eBay via TheCardAPI", id: r.id ?? null };
}

// Returns { ok, rows, status, error }. Never throws.
export async function fetchCardApiSales(card, { timeoutMs = 5000, fetchImpl = fetch } = {}) {
  if (!cardApiConfigured()) return { ok: false, rows: [], status: "not_configured", error: null };
  const params = cardApiParams(card);
  if (params.get("q").length < 4) return { ok: false, rows: [], status: "not_searched", error: "Not enough card details to search." };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${BASE}?${params}`, { signal: controller.signal,
      headers: { "x-market-api-key": cardApiKey(), Accept: "application/json" } });
    if (!res.ok) {
      const status = res.status === 401 ? "key_rejected" : res.status === 403 ? "plan_limit"
        : res.status === 429 ? "quota_reached" : res.status === 422 ? "bad_query" : "provider_error";
      const detail = mask(await res.text().catch(() => ""));
      console.warn("thecardapi sales", res.status, status, detail);
      return { ok: false, rows: [], status, error: `Sold-price provider returned ${res.status}.` };
    }
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch {
      console.warn("thecardapi sales: non-JSON reply", res.status, res.headers.get("content-type"), mask(text.slice(0, 120)));
      return { ok: false, rows: [], status: "provider_error", error: "Sold-price provider sent an unreadable reply." };
    }
    const data = Array.isArray(body?.data) ? body.data : [];
    return { ok: true, rows: data.map(mapCardApiRow).filter(Boolean), returned: data.length, query: params.get("q"),
      total: body?.pagination?.total ?? null, status: "ok", error: null };
  } catch (e) {
    if (e?.name !== "AbortError") console.warn("thecardapi sales failed:", e?.name, mask(e?.message), mask(e?.cause?.code || e?.cause?.message || ""));
    return { ok: false, rows: [], status: e?.name === "AbortError" ? "timeout" : "provider_error",
      error: "Sold-price provider did not answer in time." };
  } finally {
    clearTimeout(timer);
  }
}
