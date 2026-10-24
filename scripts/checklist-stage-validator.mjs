// Validate licensed checklist rows before a future Supabase TEST import.
// This tool intentionally makes no network calls or database writes.
// Usage: node scripts/checklist-stage-validator.mjs path/to/manifest.json
import { readFileSync } from 'node:fs';
const path = process.argv[2];
if (!path) { console.error('Usage: node scripts/checklist-stage-validator.mjs manifest.json'); process.exit(2); }
const manifest = JSON.parse(readFileSync(path, 'utf8'));
const text = v => typeof v === 'string' && v.trim().length > 0;
const errors = [];
if (!text(manifest.source_title)) errors.push('source_title is required');
if (!text(manifest.source_url) || !/^https:\/\//i.test(manifest.source_url)) errors.push('HTTPS source_url required');
if (manifest.commercial_import_authorized !== true) errors.push('commercial import permission not confirmed');
if (!text(manifest.permission_reference)) errors.push('permission_reference required');
if (!Array.isArray(manifest.cards) || manifest.cards.length === 0) errors.push('cards array required');
const seen = new Set();
for (const [i, c] of (Array.isArray(manifest.cards) ? manifest.cards : []).entries()) {
  for (const field of ['manufacturer','product','set','card_number','player']) {
    if (!text(c?.[field])) errors.push(`cards[${i}].${field} missing`);
  }
  if (!Number.isInteger(c?.year) || c.year < 1880 || c.year > 2100) errors.push(`cards[${i}].year invalid`);
  const key = [c?.manufacturer,c?.year,c?.product,c?.set,c?.card_number,c?.player].map(v=>String(v??'').trim().toLowerCase()).join('|');
  if (seen.has(key)) errors.push(`cards[${i}] duplicate checklist identity`);
  seen.add(key);
}
if (errors.length) { console.error(JSON.stringify({status:'blocked',errors},null,2)); process.exit(1); }
console.log(JSON.stringify({status:'validated_for_review_only',count:manifest.cards.length,source_url:manifest.source_url,notice:'No database writes; independent approval required before promotion.'},null,2));
