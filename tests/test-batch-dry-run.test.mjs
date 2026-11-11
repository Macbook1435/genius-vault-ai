import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBatchManifest } from '../scripts/test-batch-dry-run.mjs';
const pairs = Array.from({length:110},(_,i)=>({imageId:String(i+1),front:`cards/${i+1}-front.jpg`,back:`cards/${i+1}-back.jpg`}));
test('110 unique paired images pass offline validation without executing scans',()=>{
 const result=validateBatchManifest({pairs});
 assert.equal(result.ready,true);
 assert.equal(result.count,110);
 assert.equal(result.paidCalls,0);
 assert.equal(result.scanExecutionEnabled,false);
});
test('missing back is rejected',()=>{
 const copy=structuredClone(pairs);delete copy[0].back;
 assert.equal(validateBatchManifest({pairs:copy}).ready,false);
});
test('duplicate ids and reused photos are rejected',()=>{
 const copy=structuredClone(pairs);copy[1].imageId=copy[0].imageId;copy[1].front=copy[0].front;
 const result=validateBatchManifest({pairs:copy});
 assert.equal(result.ready,false);assert.ok(result.errors.length>=2);
});
test('unsafe paths and incomplete batches are rejected',()=>{
 assert.equal(validateBatchManifest({pairs:[{imageId:'x',front:'../secret.jpg',back:'back.jpg'}]}).ready,false);
});
