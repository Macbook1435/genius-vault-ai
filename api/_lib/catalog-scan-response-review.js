// TEST-only opt-in response decorator. Never modifies scan fields, pricing,
// existing verification, or the production endpoint. The fixture is review-only.
import { reviewScanParallel } from './catalog-scan-adapter.js';
import { resolveOpticSubset } from './catalog-optic-subset-resolver.js';
const norm=value=>String(value??'').trim().toLowerCase();
export function addParallelReviewToScanResponse(response, fixture, evidence=null) {
 if(!response||typeof response!=='object'||!response.scan||typeof response.scan!=='object')return response;
 const scan=response.scan;
 // Prevent accidental use on unrelated sets or years.
 const release=[scan.brand,scan.set].filter(Boolean).join(' ').toLowerCase();
 if(Number(scan.year)!==2025||!release.includes('optic')||!release.includes('donruss'))return response;
 // Review fixture applies only to RPS autograph subset, not all Optic cards.
 // Scan outputs currently lack a trusted subset identifier: fail closed.
 const subset=resolveOpticSubset(scan,evidence);
 if(subset.status!=='verified_subset'||subset.subset_id!=='rookie_auto')return response;
 const advisory=reviewScanParallel(scan,fixture);
 return {...response,parallelReview:{...advisory,source:'review_only',identity_verified:false}};
}
