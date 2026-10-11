import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {trialAllowance,TRIAL_PERIOD_START} from '../api/_lib/trial-policy.mjs';
const migration=fs.readFileSync(new URL('../database/step3-lifetime-trial-review.sql',import.meta.url),'utf8');
test('lifetime trial policy is capped at two pre-verification and four after',()=>{
 assert.equal(trialAllowance({used:1}).remaining,1);
 assert.equal(trialAllowance({used:2,emailVerified:true}).remaining,2);
 assert.equal(trialAllowance({used:4,emailVerified:true}).remaining,0);
});
test('migration obtains a per-account lock before counting and inserting',()=>{
 const lock=migration.indexOf('for update;');
 const count=migration.indexOf('where user_id=p_user_id and period_start=lifetime_start;');
 const insert=migration.lastIndexOf('insert into public.gv_scan_usage');
 assert.ok(lock>=0 && count>lock && insert>count);
});
test('migration uses server-trusted confirmation and service-role-only execution',()=>{
 assert.match(migration,/email_confirmed_at is not null/);
 assert.match(migration,/auth\.role\(\) <> 'service_role'/);
 assert.match(migration,/revoke all on function public\.gv_reserve_scan/);
});
test('free usage remains in a lifetime bucket distinct from subscription',()=>{
 assert.match(migration,/lifetime_start constant timestamptz/);
 assert.match(migration,/period_start=lifetime_start/);
 assert.ok(TRIAL_PERIOD_START.startsWith('2000-01-01'));
});
