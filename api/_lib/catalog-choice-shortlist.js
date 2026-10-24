// Read-only shortlist for the existing CardSight parallel picker.
// Never upgrades a candidate to verified or authorizes sold-price estimates.
export function rankParallelChoices(options, suggestedIds, limit = 5) {
  const list = Array.isArray(options) ? options.filter(o => o && o.id != null && typeof o.name === 'string') : [];
  // Preserve suggestion rank, not the provider's alphabetical/catalog ordering.
  // A suggestion is only a candidate; it never becomes a verified identity.
  const suggestionOrder = [...new Set(Array.isArray(suggestedIds) ? suggestedIds.map(String) : [])];
  const byId = new Map(list.map(o => [String(o.id), o]));
  const ordered = [...suggestionOrder.map(id => byId.get(id)).filter(Boolean), ...list];
  const unique = [...new Map(ordered.map(o => [String(o.id), o])).values()];
  const size = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 10) : 5;
  return { topChoices: unique.slice(0,size), allChoices: unique, moreCount: Math.max(0,unique.length-size),
    requiresUserConfirmation: true, verifiedBySelection: false };
}
