// Server-only catalog lookup. No public browser access and no inferred verification.
import { supabaseRequest } from "./subscriptions.js";

const eq = (v) => encodeURIComponent(String(v));
export async function lookupCatalogCard({ manufacturer, year, productName, setName, cardNumber, playerName }) {
  if (![manufacturer, year, productName, setName, cardNumber, playerName].every((x) => x !== null && x !== undefined && String(x).trim())) return null;
  if (!Number.isInteger(Number(year))) return null;
  const products = await supabaseRequest(
    "/rest/v1/gv_catalog_products?select=id&manufacturer=eq." + eq(manufacturer) +
    "&release_year=eq." + eq(year) + "&product_name=eq." + eq(productName) + "&limit=2",
    { admin: true }
  );
  if (products.length !== 1) return null;
  const cards = await supabaseRequest(
    "/rest/v1/gv_catalog_cards?select=id,player_name,card_number,set_name&product_id=eq." + products[0].id +
    "&set_name=eq." + eq(setName) + "&card_number=eq." + eq(cardNumber) +
    "&player_name=eq." + eq(playerName) + "&limit=2",
    { admin: true }
  );
  if (cards.length !== 1) return null;
  const sources = await supabaseRequest(
    "/rest/v1/gv_catalog_sources?select=id,source_type,source_title,source_url&card_id=eq." +
    cards[0].id + "&parallel_id=is.null&verification_status=eq.verified&limit=20",
    { admin: true }
  );
  return {
    card: cards[0],
    verifiedIdentity: sources.length > 0,
    sources,
    // Parallel verification is deliberately separate and requires independent evidence.
    parallel: null
  };
}


// Find identity candidates without trusting the scanner's OCR product label.
// Read-only: return only a unique card with independently verified provenance.
export async function lookupCatalogByIdentity({ year, cardNumber, playerName }) {
  const y = Number(year);
  const number = String(cardNumber || "").trim().replace(/^#/, "");
  const player = String(playerName || "").trim();
  if (!Number.isInteger(y) || y < 1880 || y > 2100 || !number || !player) return null;
  const cards = await supabaseRequest(
    "/rest/v1/gv_catalog_cards?select=id,product_id,player_name,card_number,set_name" +
    "&card_number=eq." + eq(number) + "&player_name=ilike." + eq(player) + "&limit=10",
    { admin: true }
  );
  if (!Array.isArray(cards) || !cards.length) return null;
  const matches = [];
  for (const card of cards) {
    const products = await supabaseRequest(
      "/rest/v1/gv_catalog_products?select=id,manufacturer,release_year,product_name&id=eq." +
      eq(card.product_id) + "&release_year=eq." + y + "&limit=1", { admin: true }
    );
    if (!Array.isArray(products) || products.length !== 1) continue;
    const sources = await supabaseRequest(
      "/rest/v1/gv_catalog_sources?select=id,source_type,source_title,source_url,verification_status" +
      "&card_id=eq." + eq(card.id) + "&parallel_id=is.null&verification_status=eq.verified&limit=20",
      { admin: true }
    );
    const verified = (Array.isArray(sources) ? sources : []).filter(x =>
      x && /^https:\/\//i.test(String(x.source_url || ""))
    );
    if (verified.length) matches.push({ card, product: products[0], sources: verified });
  }
  // Ambiguous matches are never resolved by choosing the first candidate.
  return matches.length === 1 ? { ...matches[0], verifiedIdentity: true } : null;
}
