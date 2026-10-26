import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/_lib/test-preflight.js';
import {preflight} from '../scripts/accuracy-preflight.mjs';
const branch='test/visual-audit-guards-20261025',sha='a'.repeat(40);
const origin='https://genius-vault-test123-macbook1435s-projects.vercel.app';
function res(){return {headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(v){this.body=v;return this}}}
test('preflight route denies production and missing/unverified sign-in; valid auth never enables spending',async()=>{
 const saved={...process.env},originalFetch=globalThis.fetch;let calls=[];
 try{
  Object.assign(process.env,{SUPABASE_URL:'https://test.invalid',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'server',VERCEL_GIT_COMMIT_REF:branch,VERCEL_GIT_COMMIT_SHA:sha});
  globalThis.fetch=async (url,options)=>{calls.push({url,options});return {ok:true,text:async()=>JSON.stringify({id:'test-user',email_confirmed_at:'2026-01-01'})}};
  process.env.VERCEL_ENV='production';let r=res();await handler({method:'GET',headers:{}},r);assert.equal(r.code,404);assert.equal(calls.length,0);
  process.env.VERCEL_ENV='preview';r=res();await handler({method:'GET',headers:{}},r);assert.equal(r.code,401);assert.equal(calls.length,0);
  r=res();await handler({method:'GET',headers:{authorization:'Bearer test-token'}},r);
  assert.equal(r.code,200);assert.equal(r.body.authenticated,true);assert.equal(r.body.paidExecutionAllowed,false);assert.equal(r.body.costCeilingUsd,0);
  assert.equal(calls.length,1);assert.match(calls[0].url,/\/auth\/v1\/user$/);assert.equal(calls[0].options.method,'GET');
  globalThis.fetch=async()=>({ok:true,text:async()=>JSON.stringify({id:'test-user'})});r=res();await handler({method:'GET',headers:{authorization:'Bearer token'}},r);assert.equal(r.code,401);
 }finally{globalThis.fetch=originalFetch;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved)}
});
test('batch client refuses production/custom origins, redirects and wrong commits; never submits scans',async()=>{
 let requests=[];const fetcher=async(url,options)=>{requests.push({url:String(url),options});return {status:200,json:async()=>({environment:'preview',branch,commit:sha,authenticated:true,emailVerified:true,paidExecutionAllowed:true,costCeilingUsd:100})}};
 for(const unsafe of ['https://ai.koollicksvault.com','https://genius-vault-ai.vercel.app',origin+'/api/scan'])await assert.rejects(()=>preflight({origin:unsafe,expectedCommit:sha,token:'secret',fetcher}));
 assert.equal(requests.length,0);
 const missing=await preflight({origin,expectedCommit:sha,fetcher});assert.equal(missing.authenticated,false);assert.equal(requests.length,0);
 const report=await preflight({origin,expectedCommit:sha,token:'secret',fetcher});assert.equal(report.costCeilingUsd,0);assert.equal(report.paidExecutionAllowed,false);
 assert.equal(requests.length,1);assert.match(requests[0].url,/\/api\/subscription-status\?testPreflight=1$/);assert.equal(requests[0].options.method,'GET');assert.equal(requests[0].options.redirect,'error');
 await assert.rejects(()=>preflight({origin,expectedCommit:'b'.repeat(40),token:'secret',fetcher}));
});
