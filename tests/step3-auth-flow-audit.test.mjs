import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../database/step3-lifetime-trial-review.sql',import.meta.url),'utf8');
test('signup asks customer to confirm email when no session is granted',()=>{
 const signup=html.slice(html.indexOf('async function memberAuth('),html.indexOf('async function memberRefresh('));
 assert.match(signup,/if\(!d\.access_token\)\{notice\('Check your email to confirm your account, then sign in\.'/);
});
test('only server-trusted verified emails receive a lifetime allowance',()=>{
 assert.match(sql,/from auth\.users where id=p_user_id/);
 assert.match(sql,/if not verified then return false; end if;/);
 assert.doesNotMatch(sql,/p_email_verified|p_verified_email|p_confirmed/);
});
