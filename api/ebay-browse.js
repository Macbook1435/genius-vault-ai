// Server-side eBay Browse API helper (active listings). Uses an application token
// from EBAY_CLIENT_ID / EBAY_CLIENT_SECRET. Never exposed to the browser.
let cached = { token: null, exp: 0 };

export function ebayConfigured() {
  return Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
}

async function appToken() {
  if (cached.token && Date.now() < cached.exp - 60000) return cached.token;
  const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString("base64");
  const r = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
    signal: AbortSignal.timeout(10000),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body.access_token) throw new Error(`eBay token ${r.status}: ${body.error_description || body.error || "failed"}`);
  cached = { token: body.access_token, exp: Date.now() + (body.expires_in || 7200) * 1000 };
  return cached.token;
}

// Search active listings in Sports Trading Cards (category 261328).
export async function ebaySearch(q, limit = 50) {
  const token = await appToken();
  const qs = new URLSearchParams({ q, category_ids: "261328", limit: String(limit) });
  const r = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${qs}`, {
    headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" },
    signal: AbortSignal.timeout(10000),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`eBay Browse ${r.status}: ${body?.errors?.[0]?.message || "failed"}`);
  return (body.itemSummaries || []).map((i) => ({
    title: i.title,
    price: i.price ? Number(i.price.value) : null,
    url: i.itemWebUrl,
  }));
}

export default function handler(req, res) { return res.status(404).end(); }
