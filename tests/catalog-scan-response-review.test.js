import test from 'node:test';
import assert from 'node:assert/strict';
import {addParallelReviewToScanResponse} from '../api/_lib/catalog-scan-response-review.js';
const fixture={safe_to_promote:false,cases:[{card_number:'219',player:'Isaac TeSlaa',rule:'only',values:['Purple Stars']}]};
const base={scan:{year:2025,brand:'Panini',set:'Donruss Optic',player:'Isaac TeSlaa',cardNumber:'219',parallel:'Gold Vinyl'},market:{sold:{median:100}},verification:{status:'unconfirmed'}};
const evidence={verification_status:'verified',source_url:'https://example.org/checklist',card_number:'219',player:'Isaac TeSlaa',product_id:'2025-donruss-optic-football',subset_id:'rookie_auto'};
test('untrusted subset label leaves response untouched',()=>{const input={...base,scan:{...base.scan,catalogSubsetId:'rookie_auto'}};assert.equal(addParallelReviewToScanResponse(input,fixture),input);});
// Distinct wrapper is returned only when trusted source evidence is present.
test('source-backed RPS subset receives advisory, not verification',()=>{
 const out=addParallelReviewToScanResponse(base,fixture,evidence);
 assert.equal(out.parallelReview.review_status,'excluded_by_review_fixture');
 assert.equal(out.parallelReview.parallel_verified,false);
 assert.equal(out.parallelReview.identity_verified,false);
 assert.equal(out.market,base.market);
 assert.equal(out.verification,base.verification);
 assert.equal(out.scan,base.scan);
});
test('wrong player evidence leaves original response untouched',()=>assert.equal(addParallelReviewToScanResponse(base,fixture,{...evidence,player:'Other'}),base));
test('unrelated release cannot receive Optic review',()=>{
 const input={...base,scan:{...base.scan,set:'Absolute'}};
 assert.equal(addParallelReviewToScanResponse(input,fixture,evidence),input);
});
test('missing response is handled without throwing',()=>assert.equal(addParallelReviewToScanResponse(null,fixture,evidence),null));

test('missing checklist evidence never adds player-specific claims',()=>{
 const input={...base,scan:{...base.scan,autograph:true,catalogSubsetId:'rookie_auto'}};
 const out=addParallelReviewToScanResponse(input,fixture,null);
 assert.equal(out,input);
 assert.equal(out.parallelReview,undefined);
});
test('self-reported autograph does not substitute for checklist evidence',()=>{
 const input={...base,scan:{...base.scan,autograph:true}};
 const out=addParallelReviewToScanResponse(input,fixture,{...evidence,verification_status:'candidate'});
 assert.equal(out,input);
});
