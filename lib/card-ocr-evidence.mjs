// TEST-only OCR evidence parser. No network, database writes, or paid providers.
const stampPattern = /(^|[^\dA-Za-z])(\d{1,4})\s*([/|])\s*(\d{1,4})(?![\dA-Za-z])/g;
export function parseSerialCandidates(input) {
  if (typeof input !== 'string') return [];
  const results = [];
  for (const m of input.matchAll(stampPattern)) {
    const numerator = Number(m[2]), denominator = Number(m[4]);
    if (numerator < 1 || denominator < 1 || numerator > denominator) continue;
    results.push({
      observed: m[0].trim(), serial: numerator + '/' + denominator,
      numerator, print_run: denominator,
      confidence: m[3] === '/' ? 'candidate' : 'ambiguous_separator',
      requires_visual_confirmation: true
    });
  }
  return results;
}
export function normalizeCardTokens(input) {
  if (typeof input !== 'string') return [];
  return [...new Set(input.normalize('NFKC').toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean))];
}
export function rankCardCandidates(ocr, candidates) {
  if (!Array.isArray(candidates)) throw new TypeError('candidates must be an array');
  const observed = new Set(normalizeCardTokens(ocr));
  return candidates.map(candidate => {
    const fields = [candidate.manufacturer,candidate.product_name,candidate.player_name,candidate.card_number];
    const matched = fields.map(field => {
      const tokens = normalizeCardTokens(String(field ?? ''));
      return tokens.length > 0 && tokens.every(t => observed.has(t));
    });
    return { candidate, evidence: { manufacturer:matched[0], product:matched[1], player:matched[2], card_number:matched[3] },
      score: matched.reduce((sum,yes,i)=>sum+(yes?[1,2,2,4][i]:0),0), verified:false };
  }).sort((a,b)=>b.score-a.score);
}
