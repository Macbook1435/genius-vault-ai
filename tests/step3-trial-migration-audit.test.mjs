import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {trialAllowance,TRIAL_PERIOD_START} from '../api/_lib/trial-policy.mjs';
const migration=fs.readFileSync(new URL('../database/step3-lifetime-trial-review.sql',import.meta.url),'utf8');
test('trial requires verified email and grants only four lifetime scans',()=>{
 assert.equal(trialAllowance({emailVerified:false}).remaining,0);
 assert.equal(trialAllowance({emailVerified:true}).remaining,4);
 assert.equal(trialAllowance({emailVerified:true,used:4}).remaining,0);
 assert.match(migration,/if not verified then return false; end if;/);
 assert.match(migration,/if used_count >= 4 then return false; end if;/);
});
test('migration serializes same-account usage before checking free allowance',()=>{
 const lock=migration.indexOf('for update;');
 const count=migration.indexOf('where user_id=p_user_id and period_start=lifetime_start;');
 const insert=migration.lastIndexOf('insert into public.gv_scan_usage');
 assert.ok(lock>=0 && count>lock && insert>count);
});
test('migration obtains verification from trusted auth users and restricts execution',()=>{
 assert.match(migration,/email_confirmed_at is not null/);
 assert.match(migration,/auth\.role\(\) <> 'service_role'/);
 assert.match(migration,/revoke all on function public\.gv_reserve_scan/);
});
test('free bucket is stable and separate from paid period buckets',()=>{
 assert.match(migration,/lifetime_start constant timestamptz/);
 assert.match(migration,/period_start=lifetime_start/);
 assert.ok(TRIAL_PERIOD_START.startsWith('2000-01-01'));
});
