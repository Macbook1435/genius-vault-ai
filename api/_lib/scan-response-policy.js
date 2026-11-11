// Final response policy: suggestions and user choices never verify a physical copy.
// Pure and non-mutating; used after all legacy/catalog promotions.
import { scanAuditAdvisory } from './scan-audit-advisory.js';
const keys = ['player', 'year', 'set', 'cardNumber', 'parallel', 'serial'];
export function reconcileScanResponse(input) {
  const audit = scanAuditAdvisory({scan: input.scan, catalogIdentity: input.catalogIdentity});
  const identityConflict = audit.issues.some(x => /(?:player|number).*conflict/.test(x.code));
  const identityIncomplete = audit.issues.some(x => x.code === 'incomplete_visible_evidence');
  const identityBlocked = identityConflict || identityIncomplete;
  const pipeline = original => {
    if (!original) return original;
    const fields = {...original.fields};
    fields.parallel = {...fields.parallel, value: fields.parallel?.value ?? input.scan?.parallel ?? null,
      status: 'unconfirmed', basis: 'Catalog/photo candidate only; physical parallel has not been independently verified.'};
    if (identityBlocked) for (const key of ['player','year','set','cardNumber']) {
      fields[key] = {...fields[key], status:'unconfirmed', basis:'Visible identity evidence is missing or conflicting; manual review required.'};
    }
    const unconfirmed = keys.filter(key => fields[key]?.status !== 'confirmed');
    return {...original, fields, unconfirmed, allConfirmed: unconfirmed.length === 0};
  };
  const blockedSales = {count:0, min:null, max:null, median:null, mean:null, items:[],
    status:'exact_match_unverified', error:'Physical parallel remains unverified; selected-version records are for manual comparison only.'};
  const verification = {...input.verification,
    identityStatus: identityBlocked ? 'needs_review' : input.verification?.status || 'needs_review',
    status: input.verification?.status === 'rejected' ? 'rejected' : 'needs_review',
    parallelId:{...input.verification?.parallelId,status:'unconfirmed'},
    approvalAllowed:false, autoApproved:false};
  const output = {...input, verification, confidence:verification.status === 'rejected' ? 'rejected' : 'needs review', visualAudit:audit, pipeline:pipeline(input.pipeline),
    comps:{...input.comps, ...blockedSales},
    market:{...input.market, sold:{...input.market?.sold, ...blockedSales, kind:'sold', source:'verification_gate'}},
    soldComps:{...input.soldComps, summary:'No verified sold-price estimate.'},
    readoutSummary:identityBlocked ? 'Identification needs review: visible identity evidence is missing or conflicting.' : 'Card candidate identified; physical parallel requires independent verification.',
    parallelPicker:input.parallelPicker ? {...input.parallelPicker, needsPick:true, selectedId:null,
      reason:'Choose a version to compare its sales. Selection does not verify your physical card.'} : null};
  if (identityBlocked) {
    output.confidence = 'needs review';
    output.alternates = [];
  }
  if (input.v2) output.v2 = {...input.v2, pipeline:pipeline(input.v2.pipeline), pipelineV1:pipeline(input.v2.pipelineV1),
    parallel:{...input.v2.parallel, status:'unconfirmed', verified:false}};
  return output;
}
