import test from 'node:test';
import assert from 'node:assert/strict';
import {addParallelReviewToScanResponse} from '../api/_lib/catalog-scan-response-review.js';
const fixture={safe_to_promote:false,cases:[{card_number:'219',player:'Isaac TeSlaa',rule:'only',values:['Purple Stars']}]};
const base={scan:{year:2025,brand:'Panini',set:'Donruss Optic',player:'Isaac TeSlaa',cardNumber:'219',parallel:'Gold Vinyl'},market:{sold:{median:100}},verification:{status:'unconfirmed'}};
test('untrusted subset leaves original response untouched',()=>assert.equal(addParallelReviewToScanResponse(base,fixture),base));
test('trusted RPS subset receives advisory, not verification',()=>{
 const input={...base,scan:{...base.scan,catalogSubsetId:'rookie_auto'}};
 const out=addParallelReviewToScanResponse(input,fixture);
 assert.equal(out.parallelReview.review_status,'excluded_by_review_fixture');
 assert.equal(out.parallelReview.parallel_verified,false);
 assert.equal(out.parallelReview.identity_verified,false);
 assert.equal(out.market,input.market);
 assert.equal(out.verification,input.verification);
 assert.equal(out.scan,input.scan);
});
test('unrelated release cannot receive Optic review',()=>{
 const input={...base,scan:{...base.scan,set:'Absolute',catalogSubsetId:'rookie_auto'}};
 assert.equal(addParallelReviewToScanResponse(input,fixture),input);
});
test('missing response is handled without throwing',()=>assert.equal(addParallelReviewToScanResponse(null,fixture),null));
