// Preview-only import preparation: CSV -> validation -> optional read-only matching -> review rows.
// No database writes, approval, or promotion.
import { csvGenericAdapter } from './catalog-import-csv.js';
import { validateChecklistRecords } from './catalog-import-validation.js';
import { matchChecklistRecord } from './catalog-import-match.js';

export function prepareChecklistImport(csvText, {columnMapping,licenseStatus,currentYear,catalog,source}={}) {
  if(catalog!==undefined && !Array.isArray(catalog))throw new TypeError('catalog must be an array');
  const {records,parseErrors}=csvGenericAdapter.parse(csvText,{columnMapping});
  const validations=validateChecklistRecords(records,{licenseStatus,currentYear});
  const rows=validations.map((v,index)=>{
    const original=records[index];
    const match=v.eligibleForReview && catalog!==undefined
      ?matchChecklistRecord(original.fields,{catalog,source,licenseStatus:original.fields.license_status||licenseStatus})
      :null;
    return {
      source_row_number:v.sourceRowNumber,
      raw_record:original.raw_record,
      normalized_record:original.fields,
      issues:[...v.errors.map(code=>({severity:'error',code})),...v.warnings.map(code=>({severity:'warning',code}))],
      review_status:'pending',
      match_status:match?.status??null,
      match_reason:match?.reason??null,
      match_changes:match?.changes??[],
      eligible_for_review:v.eligibleForReview,
      matched_product_id:null,matched_card_id:null,matched_parallel_id:null
    };
  });
  return {adapter_name:csvGenericAdapter.name,adapter_version:csvGenericAdapter.version,
    source_type:csvGenericAdapter.sourceType,
    rows,parse_errors:parseErrors,
    summary:{parsed:rows.length,invalid:rows.filter(r=>!r.eligible_for_review).length,
      pending_review:rows.length,parse_errors:parseErrors.length},
    safe_to_promote:false};
}
