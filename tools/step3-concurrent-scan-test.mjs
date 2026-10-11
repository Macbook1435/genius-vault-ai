// TEST PROJECT ONLY. Concurrent scan reservation integration test.
// Requires Node 20+, GV_TEST_SUPABASE_URL, GV_TEST_SERVICE_ROLE_KEY,
// GV_TEST_USER_ID and GV_TEST_PROJECT_REF. Never supply production credentials.
// Does not make AI API calls. Only deletes reservation records created by this run.
import {randomUUID} from 'node:crypto';
const url=String(process.env.GV_TEST_SUPABASE_URL||'').replace(/\/$/,'');
const key=process.env.GV_TEST_SERVICE_ROLE_KEY;
const user=process.env.GV_TEST_USER_ID;
const ref=process.env.GV_TEST_PROJECT_REF;
if(!url||!key||!user||!ref||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||
   new URL(url).hostname!==ref+'.supabase.co'||!/^[-0-9a-f]{36}$/i.test(user)) {
 throw new Error('Missing/invalid TEST project inputs. Refusing to run.');
}
const reqIds=[];
async function call(path,body,method='POST'){
 const res=await fetch(url+path,{method,headers:{
  'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json'
 },...(body?{body:JSON.stringify(body)}:{})});
 const raw=await res.text();
 if(!res.ok)throw new Error('Supabase returned HTTP '+res.status+' for '+path.split('?')[0]);
 try{return JSON.parse(raw)}catch{return raw}
}
async function reserve(id){
 reqIds.push(id);
 return call('/rest/v1/rpc/gv_reserve_scan',{p_user_id:user,p_request_id:id});
}
async function main(){
 // Test only a fresh account. Do not overwrite a user's existing free credits.
 const existing=await call('/rest/v1/rpc/gv_usage_count',{p_user_id:user,p_period_start:'2000-01-01T00:00:00Z'});
 if(existing!==0)throw new Error('Test user already has lifetime usage; refusing to alter it.');
 try{
  for(let i=0;i<3;i++)if(await reserve(randomUUID())!==true)throw Error('Preload reservation rejected');
  const [a,b]=await Promise.all([reserve(randomUUID()),reserve(randomUUID())]);
  const successes=[a,b].filter(x=>x===true).length;
  const failures=[a,b].filter(x=>x===false).length;
  const count=await call('/rest/v1/rpc/gv_usage_count',{p_user_id:user,p_period_start:'2000-01-01T00:00:00Z'});
  if(successes!==1||failures!==1||count!==4)
    throw new Error('FAIL: simultaneous requests allowed '+successes+'; count '+count);
  process.stdout.write('PASS: Exactly one of two simultaneous requests accepted the fourth scan; count 4.\n');
 }finally{
  // Delete ONLY requests tracked by this invocation; never delete account data generally.
  for(const id of reqIds)await call('/rest/v1/gv_scan_usage?user_id=eq.'+encodeURIComponent(user)+'&request_id=eq.'+id,null,'DELETE');
  const remaining=await call('/rest/v1/rpc/gv_usage_count',{p_user_id:user,p_period_start:'2000-01-01T00:00:00Z'});
  if(remaining!==0)throw new Error('Test cleanup incomplete; remaining='+remaining);
  process.stdout.write('PASS: Temporary test reservations cleaned up.\n');
 }
}
await main();
