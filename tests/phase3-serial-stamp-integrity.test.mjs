import test from 'node:test';
import assert from 'node:assert/strict';
import {requestExactSales,exactPricingGate} from '../api/_lib/exact-pricing-gate.mjs';
const verified={identityTrusted:true,catalogAvailable:true,mode:'parallel',parallelId:'orange-id',parallelMatched:true,numberedTo:50,serialVerified:true};
test('Phase 3: Tuten 33/50 exact variant can advance to sales lookup',()=>{
 const result=exactPricingGate({...verified,serialNumber:'33/50'});
 assert.equal(result.allowed,true);
});
test('Phase 3: impossible or mismatched serial cannot trigger a price lookup',async()=>{
 let calls=0;
 for(const serial of ['99/50','0/50','33/49','33/250','33/0','33/xx','33/50 extra','/50','33/51']){
   const r=await requestExactSales({...verified,serialNumber:serial},()=>{calls++;return {median:200};});
   assert.equal(r.called,false,serial);
   assert.equal(r.decision.reason,'serial_stamp_mismatch',serial);
 }
 assert.equal(calls,0);
});
test('Phase 3: leading zeros on a legitimate numbered card are accepted',()=>{
 assert.equal(exactPricingGate({...verified,serialNumber:'033/050'}).allowed,true);
});
