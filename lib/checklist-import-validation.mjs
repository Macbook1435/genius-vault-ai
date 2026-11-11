// TEST-only offline checklist validation. No network, credentials, or database writes.
const required = ['manufacturer','release_year','product_name','set_name','card_number','player_name','source_url','license_status'];
const clean = v => typeof v === 'string' ? v.trim() : v;
export function validateChecklist(rows, { permittedSources = [] } = {}) {
  if (!Array.isArray(rows)) throw new TypeError('rows must be an array');
  const accepted = [], rejected = [], seen = new Set();
  for (const [index, raw] of rows.entries()) {
    const errors = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      rejected.push({ index, errors: ['invalid row'] }); continue;
    }
    const row = Object.fromEntries(Object.entries(raw).map(([k,v]) => [k,clean(v)]));
    for (const key of required) if (row[key] === undefined || row[key] === null || row[key] === '') errors.push('missing '+key);
    if (!Number.isInteger(Number(row.release_year)) || Number(row.release_year) < 1880 || Number(row.release_year) > 2100) errors.push('invalid release_year');
    if (row.license_status !== 'authorized') errors.push('source not authorized');
    if (!permittedSources.includes(row.source_url)) errors.push('source not on approved list');
    const key = ['manufacturer','release_year','product_name','set_name','card_number','player_name','parallel_name'].map(k=>String(row[k] ?? '').trim().toLowerCase()).join('|');
    if (seen.has(key)) errors.push('duplicate row');
    if (errors.length) rejected.push({ index, errors });
    else { seen.add(key); accepted.push({ ...row, release_year: Number(row.release_year), verification_status:'pending' }); }
  }
  return { accepted, rejected, dryRun: true };
}
