// Server-only Supabase authentication and scan allowance enforcement.
// Enable with GV_REQUIRE_SUBSCRIPTION=1 after configuring Supabase and Stripe.
const configured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
const headers = (key, bearer) => ({apikey:key,Authorization:'Bearer '+(bearer||key),'Content-Type':'application/json'});
export async function supabaseRequest(path,{method='GET',body,admin=false,token,prefer}={}) {
  if (!configured()) throw new Error('Subscription database is not configured');
  const key=admin?process.env.SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_ANON_KEY;
  const response=await fetch(process.env.SUPABASE_URL.replace(/\/$/,'')+path,{method,headers:{...headers(key,token||key),...(prefer?{Prefer:prefer}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const text=await response.text();let data;try{data=JSON.parse(text)}catch{data=text}
  if(!response.ok)throw new Error('Database request failed ('+response.status+')');
  return data;
}
export async function authenticatedUser(req){
  const bearer=String(req.headers.authorization||'').match(/^Bearer\s+(.+)$/i)?.[1];
  if(!bearer)return null;
  try {const u=await supabaseRequest('/auth/v1/user',{token:bearer});return u?.id?u:null;}catch{return null;}
}
export async function reserveScan(userId,requestId){
  const data=await supabaseRequest('/rest/v1/rpc/gv_reserve_scan',{method:'POST',admin:true,body:{p_user_id:userId,p_request_id:requestId}});
  return data===true;
}
// Release a reserved scan when processing fails before a result is delivered.
export async function releaseScan(userId,requestId){
  if(!userId||!requestId)return;
  await supabaseRequest('/rest/v1/gv_scan_usage?user_id=eq.'+encodeURIComponent(userId)+'&request_id=eq.'+encodeURIComponent(requestId),{method:'DELETE',admin:true});
}
export async function entitlement(userId){
  const rows=await supabaseRequest('/rest/v1/gv_entitlements?user_id=eq.'+encodeURIComponent(userId)+'&select=status,period_start,period_end,scan_limit',{admin:true});
  return rows?.[0]||null;
}
export async function usageCount(userId,periodStart){
  if(!periodStart)return 0;
  const rows=await supabaseRequest('/rest/v1/gv_scan_usage?user_id=eq.'+encodeURIComponent(userId)+'&period_start=eq.'+encodeURIComponent(periodStart)+'&select=id',{admin:true});
  return rows.length;
}
export function subscriptionsEnabled(){return process.env.GV_REQUIRE_SUBSCRIPTION==='1';}
