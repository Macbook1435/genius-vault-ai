import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../database/step3-lifetime-trial-review.sql',import.meta.url),'utf8');
test('pre-confirmation trial cannot launch while signup returns no session',()=>{
 const signup=html.slice(html.indexOf('async function memberAuth('),html.indexOf('async function memberRefresh('));
 assert.match(signup,/if\(!d\.access_token\)\{notice\('Check your email to confirm your account, then sign in\.'/);
 assert.match(sql,/email_confirmed_at is not null/);
 // This is a documented current limitation, not proof that live Supabase
 // disables pre-confirmation sessions. Deployment must test that configuration.
});
test('trial reservation refuses client-controlled email confirmation',()=>{
 assert.match(sql,/from auth\.users where id=p_user_id/);
 assert.doesNotMatch(sql,/p_email_verified|p_verified_email|p_confirmed/);
});
