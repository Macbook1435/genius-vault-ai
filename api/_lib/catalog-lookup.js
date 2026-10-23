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
