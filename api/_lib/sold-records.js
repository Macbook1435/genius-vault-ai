// Only documented completed auctions contribute to a valuation.
export function eligibleAuction(r) {
  if (!r || r.listing_type !== "auction" || !Number.isFinite(r.price) || r.price <= 0 || !r.url || !r.date || !Number.isFinite(Date.parse(r.date))) return false;
  try { if (!/^https?:$/.test(new URL(r.url).protocol)) return false; } catch { return false; }
  return !r.best_offer && !r.bestOfferAccepted && !/best offer|offer accepted/i.test(r.title || "");
}
export function saleKey(r) {
  try {
    const u = new URL(r.url);
    const id = /(?:^|\.)ebay\.[a-z.]+$/i.test(u.hostname) && u.pathname.match(/\/itm\/(?:[^/]+\/)?(\d+)(?:\/|$)/)?.[1];
    return id ? `ebay:${id}` : `${u.origin}${u.pathname}`;
  } catch { return `${r.title}|${r.date}|${r.price}`; }
}
const tokens = s => String(s || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
export function exactTitleMatch(r, card) {
  const title = String(r.title || "");
  const have = new Set(tokens(title));
  const year = String(card?.set?.year || "");
  const years = title.match(/\b(?:19|20)\d{2}\b/g) || [];
  if (!year || !have.has(year) || years.some(y => y !== year)) return false;
  if (!tokens(card?.name).every(w => have.has(w))) return false;
  const set = tokens(card?.set?.release).filter(w => w !== year && !["football", "baseball", "basketball", "hockey"].includes(w));
  if (!set.length || !set.every(w => have.has(w))) return false;
  const number = String(card?.number || "").replace(/^#/, "");
  if (!number) return false;
  const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:#|\\b)${escaped}\\b`, "i").test(title);
}
export function summarizeSales(records) {
  const seen = new Map();
  for (const r of records) if (eligibleAuction(r) && !seen.has(saleKey(r))) seen.set(saleKey(r), r);
  const items = [...seen.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const prices = items.map(r => r.price).sort((a, b) => a - b), n = prices.length, mid = Math.floor(n / 2);
  const round = x => Math.round(x * 100) / 100;
  return { count: n, min: n ? prices[0] : null, max: n ? prices[n - 1] : null,
    mean: n ? round(prices.reduce((a, b) => a + b, 0) / n) : null,
    median: n ? round(n % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2) : null, items };
}
