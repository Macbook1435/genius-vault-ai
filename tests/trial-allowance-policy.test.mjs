import test from 'node:test';
import assert from 'node:assert/strict';
import {trialAllowance,FREE_SIGNUP_SCANS,FREE_VERIFIED_TOTAL} from '../api/_lib/trial-policy.mjs';
test('new unverified account receives no scans',()=>{
 const x=trialAllowance();assert.equal(FREE_SIGNUP_SCANS,0);assert.equal(x.limit,0);
 assert.equal(x.remaining,0);assert.equal(x.eligible,false);assert.equal(x.requiresEmailVerification,true);
});
test('email verification unlocks exactly four lifetime scans',()=>{
 const x=trialAllowance({emailVerified:true});assert.equal(FREE_VERIFIED_TOTAL,4);
 assert.equal(x.limit,4);assert.equal(x.remaining,4);assert.equal(x.eligible,true);
});
test('verification never resets previous lifetime usage',()=>{
 const x=trialAllowance({emailVerified:true,used:3});assert.equal(x.remaining,1);
});
test('unverified existing accounts cannot use any trial scans',()=>{
 const x=trialAllowance({emailVerified:false,used:2});assert.equal(x.eligible,false);assert.equal(x.remaining,0);
});
test('verified trial ends permanently at four scans',()=>{
 const x=trialAllowance({emailVerified:true,used:4});assert.equal(x.eligible,false);assert.equal(x.remaining,0);
});
test('usage over limit is capped; invalid counts rejected',()=>{
 assert.equal(trialAllowance({emailVerified:true,used:9}).remaining,0);
 assert.throws(()=>trialAllowance({used:-1}),RangeError);
});
