import test from 'node:test';
import assert from 'node:assert/strict';
import {trialAllowance} from '../api/_lib/trial-policy.mjs';
import fs from 'node:fs';
const sql=fs.readFileSync(new URL('../database/step3-lifetime-trial-review.sql',import.meta.url),'utf8');
const status=fs.readFileSync(new URL('../api/subscription-status.js',import.meta.url),'utf8');
test('unverified customer has zero free scans and must verify',()=>{
 const t=trialAllowance({emailVerified:false,used:0});
 assert.equal(t.limit,0);assert.equal(t.remaining,0);assert.equal(t.eligible,false);
 assert.equal(t.requiresEmailVerification,true);
 assert.match(sql,/if not verified then return false; end if;/);
});
test('verified user sees four lifetime scans before first reservation',()=>{
 const t=trialAllowance({emailVerified:true,used:0});
 assert.equal(t.limit,4);assert.equal(t.remaining,4);
});
test('account balance shows correct countdown and never resets',()=>{
 for(let used=0;used<=4;used++){
  const t=trialAllowance({emailVerified:true,used});
  assert.equal(t.remaining,4-used);
  assert.equal(t.eligible,used<4);
 }
 assert.match(status,/usageCount\(user\.id,TRIAL_PERIOD_START\)/);
});
test('reservation checks and updates under a per-account database lock',()=>{
 const lock=sql.indexOf('where user_id=p_user_id for update;');
 const count=sql.indexOf('where user_id=p_user_id and period_start=lifetime_start;');
 const insert=sql.lastIndexOf('insert into public.gv_scan_usage');
 assert.ok(lock!==-1 && count>lock && insert>count);
});
