// TEST-only reference matcher. Does not write to a database or call providers.
import { normalizeCardTokens, parseSerialCandidates } from './card-ocr-evidence.mjs';
const norm = value => normalizeCardTokens(String(value ?? '')).join(' ');
export function matchChecklistRecord({ frontText = '', backText = '', records = [] } = {}) {
  if (!Array.isArray(records)) throw new TypeError('records must be an array');
  const text = frontText + ' ' + backText;
  const years = [...new Set([...text.matchAll(/\b(?:19|20)\d{2}\b/g)].map(m=>Number(m[0])))];
  const numbers = [...backText.matchAll(/\b(?:NO\.?|#)\s*([A-Z0-9]+(?:-[A-Z0-9]+)*)\b/gi)].map(m=>m[1].toUpperCase());
  if (!years.length || !numbers.length) return { status:'needs_review', reason:!years.length?'year_missing':'card_number_missing', candidates:[] };
  const candidates = records.filter(r => years.includes(Number(r.release_year)) && numbers.includes(String(r.card_number??'').toUpperCase()) && r.verification_status==='verified')
    .filter(r=> norm(frontText).includes(norm(r.product_name)) || norm(backText).includes(norm(r.product_name)))
    .map(r=>({record:r,player_supported:norm(text).includes(norm(r.player_name)),serial_candidates:parseSerialCandidates(text)}));
  if (candidates.length!==1 || !candidates[0].player_supported) return {status:'needs_review',reason:candidates.length===0?'no_verified_match':'ambiguous_or_player_unconfirmed',candidates};
  return {status:'candidate_match',record:candidates[0].record,parallel_status:'unresolved',serial_candidates:candidates[0].serial_candidates,verified:false};
}
