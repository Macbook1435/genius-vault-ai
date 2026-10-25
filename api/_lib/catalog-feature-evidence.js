// TEST-only, advisory reference feature lookup. Never changes scan identity or pricing.
import { supabaseRequest } from './subscriptions.js';
import { scannerCatalogQuery } from './catalog-scan-adapter.js';
import { lookupCatalogCard } from './catalog-lookup.js';

export async function scanReferenceFeatures(scan) {
  const empty = { status: 'not_verified', features: [], source: 'gv_catalog_card_features' };
  const query = scannerCatalogQuery(scan);
  if (!query) return empty;
  const match = await lookupCatalogCard(query);
  if (!match?.verifiedIdentity || !match.card?.id) return empty;
  const cardId = Number(match.card.id);
  if (!Number.isSafeInteger(cardId)) return empty;
  const features = await supabaseRequest(
    '/rest/v1/gv_catalog_card_features?select=feature_type,feature_name,attributes,verification_status,source_id&card_id=eq.' +
    cardId + '&verification_status=eq.verified&limit=100', { admin: true }
  );
  if (!Array.isArray(features) || !features.length) return empty;
  const sources = await supabaseRequest(
    '/rest/v1/gv_catalog_sources?select=id,source_url,verification_status&card_id=eq.' +
    cardId + '&verification_status=eq.verified&limit=100', { admin: true }
  );
  const verified = new Set((Array.isArray(sources) ? sources : [])
    .filter(s => s && /^https:\/\//i.test(String(s.source_url || '')))
    .map(s => Number(s.id)));
  const safe = features.filter(f => f && verified.has(Number(f.source_id)))
    .map(f => ({ type: f.feature_type, name: f.feature_name, attributes: f.attributes || {} }));
  return safe.length ? { status: 'verified_reference_features', features: safe, source: 'gv_catalog_card_features' } : empty;
}
