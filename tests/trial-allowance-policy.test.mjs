import test from 'node:test';
import assert from 'node:assert/strict';
import {trialAllowance,FREE_SIGNUP_SCANS,FREE_VERIFIED_TOTAL} from '../api/_lib/trial-policy.mjs';

test('new customer receives two signup scans',()=>{
 const x=trialAllowance();
 assert.equal(FREE_SIGNUP_SCANS,2);
 assert.equal(x.limit,2);
 assert.equal(x.remaining,2);
});
test('verified email unlocks four total scans, not four additional scans',()=>{
 const x=trialAllowance({emailVerified:true,used:2});
 assert.equal(FREE_VERIFIED_TOTAL,4);
 assert.equal(x.limit,4);
 assert.equal(x.remaining,2);
});
test('trial scans do not reset after verification',()=>{
 const x=trialAllowance({emailVerified:true,used:3});
 assert.equal(x.remaining,1);
});
test('unverified signup stops after two scans',()=>{
 const x=trialAllowance({emailVerified:false,used:2});
 assert.equal(x.eligible,false);
 assert.equal(x.remaining,0);
});
test('verified lifetime trial stops after four scans',()=>{
 const x=trialAllowance({emailVerified:true,used:4});
 assert.equal(x.eligible,false);
 assert.equal(x.remaining,0);
});
test('excess usage never becomes negative and invalid usage is rejected',()=>{
 assert.equal(trialAllowance({emailVerified:true,used:9}).remaining,0);
 assert.throws(()=>trialAllowance({used:-1}),RangeError);
});
