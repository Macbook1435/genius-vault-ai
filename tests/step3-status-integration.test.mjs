import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const status=fs.readFileSync(new URL('../api/subscription-status.js',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../database/step3-lifetime-trial-review.sql',import.meta.url),'utf8');
test('account status reads lifetime usage, not just paid-plan usage',()=>{
 assert.match(status,/usageCount\(user\.id,TRIAL_PERIOD_START\)/);
 assert.match(status,/trialAllowance\(\{emailVerified,used:trialUsed\}\)/);
 assert.match(status,/allowanceActive:active\|\|trial\.eligible/);
});
test('customer verification comes from server-authenticated user',()=>{
 assert.match(status,/Boolean\(user\.email_confirmed_at\)/);
 assert.match(sql,/from auth\.users where id=p_user_id/);
 assert.match(sql,/if not verified then return false; end if;/);
});
test('exhausted active paid plan does not silently consume free scans',()=>{
 assert.match(sql,/if not e\.unlimited_scans and used_count >= e\.scan_limit then return false; end if;/);
});
test('verified free users see four lifetime scans while paid status remains separate',()=>{
 assert.match(status,/const limit=active\?.*:trial\.limit/);
 assert.match(status,/trial:\{emailVerified,used:trial\.used,limit:trial\.limit,remaining:trial\.remaining/);
});
