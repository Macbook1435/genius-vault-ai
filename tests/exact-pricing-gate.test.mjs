import test from 'node:test';
import assert from 'node:assert/strict';
import {exactPricingGate,requestExactSales} from '../api/_lib/exact-pricing-gate.mjs';
const base={identityTrusted:true,mode:'parallel',parallelId:'red-pandora-id',parallelMatched:true,catalogAvailable:true};
test('Mason Graham: wrong or unverified parallel never requests sold data',async()=>{
 for(const input of [{...base,mode:'blocked'}, {...base,parallelMatched:false},{...base,parallelId:null}]){
  let requests=0;
  const r=await requestExactSales(input,()=>{requests++;return {price:999}});
  assert.equal(r.called,false);assert.equal(requests,0);
 }
 const good=await requestExactSales(base,async()=>({prices:[12,15]}));
 assert.equal(good.called,true);assert.deepEqual(good.result.prices,[12,15]);
});
test('numbered Aqua autograph requires serial, exact variant, and checked catalog',async()=>{
 const aqua={...base,parallelId:'aqua-auto-id',numberedTo:250,serialNumber:'14/250'};
 for(const bad of [{...aqua,serialVerified:false},{...aqua,parallelMatched:false},
  {...aqua,mode:'base',parallelId:'null'},{...aqua,catalogAvailable:false},
  {...aqua,serialNumber:null}]){
  let called=0; const r=await requestExactSales(bad,()=>{called++;return 100;});
  assert.equal(r.called,false);assert.equal(called,0);
 }
 const yes=await requestExactSales({...aqua,serialVerified:true},async()=>({count:1}));
 assert.equal(yes.called,true);
});
test('base/silver uncertain blocks exact sales; confirmed base may continue',async()=>{
 for(const mode of ['blocked','unknown','probable']){
  let n=0; const r=await requestExactSales({...base,mode,parallelId:'null'},()=>{n++});
  assert.equal(r.called,false);assert.equal(n,0);
 }
 assert.equal(exactPricingGate({...base,mode:'base',parallelId:'null'}).allowed,true);
});
test('catalog and card identity must both be available',()=>{
 assert.equal(exactPricingGate({...base,catalogAvailable:false}).allowed,false);
 assert.equal(exactPricingGate({...base,identityTrusted:false}).allowed,false);
});

test('Bhayshul Tuten /50 autograph without catalog variant never requests sales',async()=>{
 const observed={identityTrusted:true,mode:'parallel',parallelId:null,numberedTo:50,
  serialNumber:'33/50',serialVerified:true,parallelMatched:false,catalogAvailable:false};
 let calls=0;
 for(const attempt of [observed,{...observed,catalogAvailable:true},
   {...observed,parallelId:'unverified-variant',parallelMatched:false},
   {...observed,mode:'base',parallelId:'null',catalogAvailable:true}]){
  const r=await requestExactSales(attempt,()=>{calls++;return {price:500};});
  assert.equal(r.called,false);
  assert.equal(r.result,null);
 }
 assert.equal(calls,0);
});
