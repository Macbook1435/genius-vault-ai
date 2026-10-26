import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileScanResponse} from '../api/_lib/scan-response-policy.js';
const complete=()=>({scan:{player:'Example Player',cardNumber:'179',parallel:'Blue',evidence:{playerNameText:'Example Player',cardNumberText:'179'}},
 verification:{status:'verified'},confidence:'high',pipeline:{fields:Object.fromEntries(['player','year','set','cardNumber','parallel','serial'].map(k=>[k,{status:'confirmed',value:k}])),allConfirmed:true,unconfirmed:[]},
 comps:{count:2,median:100,mean:110,items:[{price:100}]},market:{sold:{median:100,count:2}},soldComps:{summary:'100'},parallelPicker:{selectedId:'blue',options:[]}});
test('final policy overrides legacy confirmation and price promotions without mutating evidence',()=>{
 const input=complete();input.v2={pipeline:structuredClone(input.pipeline),pipelineV1:structuredClone(input.pipeline),parallel:{status:'confirmed',verified:true}};
 const snapshot=structuredClone(input);const out=reconcileScanResponse(input);
 assert.deepEqual(input,snapshot);
 for(const p of [out.pipeline,out.v2.pipeline,out.v2.pipelineV1]){assert.equal(p.fields.parallel.status,'unconfirmed');assert.equal(p.allConfirmed,false);assert.ok(p.unconfirmed.includes('parallel'));}
 assert.equal(out.v2.parallel.verified,false);assert.equal(out.visualAudit.autoApproved,false);
 assert.equal(out.comps.count,0);assert.equal(out.comps.mean,null);assert.equal(out.market.sold.median,null);
 assert.equal(out.verification.approvalAllowed,false);assert.equal(out.parallelPicker.selectedId,null);
});
test('player or card-number conflicts downgrade identity, confidence, and all price summaries',()=>{
 for(const evidence of [{playerNameText:'Wrong Player',cardNumberText:'179'},{playerNameText:'Example Player',cardNumberText:'180'},{}]){
  const input=complete();input.scan.evidence=evidence;const out=reconcileScanResponse(input);
  assert.equal(out.verification.status,'needs_review');assert.equal(out.confidence,'needs review');
  for(const k of ['player','year','set','cardNumber'])assert.equal(out.pipeline.fields[k].status,'unconfirmed');
  assert.equal(out.comps.count,0);assert.equal(out.soldComps.summary,'No verified sold-price estimate.');
 }
});
test('missing pipeline and whitespace-only visible evidence fail closed',()=>{
 const out=reconcileScanResponse({scan:{evidence:{playerNameText:'  ',cardNumberText:' '}}});
 assert.equal(out.verification.status,'needs_review');assert.equal(out.comps.median,null);
});
