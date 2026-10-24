// Read-only review gate. Never upgrades a scan to verified identity or parallel.
// Callers must provide independently reviewed rules; pending fixtures are advisory only.
const norm = value => String(value ?? '').trim().normalize('NFKC').toLowerCase();
export function reviewPlayerParallel({player,cardNumber,parallel}, fixture) {
  if (!fixture || fixture.safe_to_promote !== false || !Array.isArray(fixture.cases)) {
    return {status:'not_verified',reason:'review_fixture_unavailable'};
  }
  const rules=fixture.cases.filter(x=>norm(x.player)===norm(player)&&String(x.card_number)===String(cardNumber));
  if(!rules.length || !norm(parallel)) return {status:'not_verified',reason:'no_player_parallel_rule'};
  for(const rule of rules) {
    if(!Array.isArray(rule.values)) continue;
    const found=rule.values.some(value=>norm(value)===norm(parallel));
    if(rule.rule==='exclude' && found) return {status:'excluded_by_review_fixture',reason:'excluded_variant'};
    if(rule.rule==='only' && !found) return {status:'excluded_by_review_fixture',reason:'outside_reviewed_candidates'};
  }
  if(rules.some(rule=>rule.rule==='only'||rule.rule==='exclude')) {
    return {status:'candidate_requires_independent_verification',reason:'review_only'};
  }
  return {status:'not_verified',reason:'no_parallel_restriction'};
}
