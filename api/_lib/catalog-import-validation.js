// Checklist import validation, test-branch only. Pure functions: NO database writes.
// Input is a canonical mapping supplied explicitly by the source adapter.
const REQUIRED = ['manufacturer','release_year','product_name','set_name','card_number','player_name'];
const BASIS = new Set(['documented','stamped_observed','estimated']);
const normalizeKey = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');
const hasValue = value => value !== null && value !== undefined && String(value).trim() !== '';
const nullableBool = value => {
  if (!hasValue(value)) return null;
  if (value === true || /^(true|yes|y|1)$/i.test(String(value).trim())) return true;
  if (value === false || /^(false|no|n|0)$/i.test(String(value).trim())) return false;
  return undefined;
};
export function validateChecklistRecords(records, {licenseStatus, currentYear = new Date().getUTCFullYear()} = {}) {
  if (!Array.isArray(records)) throw new TypeError('records must be an array');
  const seen = new Set();
  return records.map((input, index) => {
    const r = input?.fields ?? {};
    const errors = [], warnings = [];
    for (const field of REQUIRED) if (!hasValue(r[field])) errors.push('MISSING_REQUIRED:' + field);
    if (!hasValue(r.license_status) && !hasValue(licenseStatus)) errors.push('MISSING_LICENSE_STATUS');
    const year = Number(r.release_year);
    if (!hasValue(r.release_year) || !Number.isInteger(year) || year < 1880 || year > currentYear + 1) errors.push('BAD_YEAR');
    const run = hasValue(r.print_run) ? Number(r.print_run) : null;
    if (run !== null && (!Number.isSafeInteger(run) || run <= 0)) errors.push('BAD_PRINT_RUN');
    if (run !== null && !hasValue(r.print_run_basis)) errors.push('PRINT_RUN_NO_BASIS');
    if (hasValue(r.print_run_basis) && !BASIS.has(r.print_run_basis)) errors.push('BAD_PRINT_RUN_BASIS');
    const serial = nullableBool(r.serial_numbered);
    if (serial === undefined) errors.push('BAD_SERIAL_NUMBERED');
    // A documented print run is not necessarily serial-numbered. Do not conflate the two.
    if (run !== null && serial === false) warnings.push('PRINT_RUN_WITHOUT_SERIAL_NUMBERING_REVIEW');
    if (!hasValue(r.parallel_name)) warnings.push('NO_PARALLEL_SPECIFIED_CARD_ONLY');
    const fields = [...REQUIRED,'parallel_name'];
    if (REQUIRED.every(f => hasValue(r[f]))) {
      const key = fields.map(f => normalizeKey(r[f])).join('\u001f');
      if (seen.has(key)) errors.push('DUPLICATE_IN_FILE');
      else seen.add(key);
    }
    for (const field of ['is_rookie','is_autograph','is_memorabilia']) {
      if (nullableBool(r[field]) === undefined) errors.push('BAD_BOOLEAN:' + field);
    }
    return {sourceRowNumber: input?.sourceRowNumber ?? index + 1, rawRecord: input, errors, warnings, eligibleForReview: errors.length === 0};
  });
}
export {normalizeKey};
