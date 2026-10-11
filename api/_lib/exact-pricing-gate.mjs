// Pure pricing decision and injectable offline harness. No external requests.
export function exactPricingGate({identityTrusted,mode,parallelId,numberedTo,serialNumber,
 serialVerified=false,parallelMatched=false,catalogAvailable=false}={}) {
 if(!identityTrusted) return {allowed:false,reason:'identity_unverified'};
 if(!catalogAvailable) return {allowed:false,reason:'catalog_unavailable'};
 if(mode!=='base'&&mode!=='parallel') return {allowed:false,reason:'parallel_unresolved'};
 const stamped=Boolean(numberedTo||serialNumber);
 if(stamped){
  if(!numberedTo||!serialNumber||!serialVerified) return {allowed:false,reason:'serial_unverified'};
  const stamp=String(serialNumber).trim().match(/^(\\d{1,6})\\s*\\/\\s*(\\d{1,6})$/);
  const numerator=stamp?Number(stamp[1]):NaN;
  const denominator=stamp?Number(stamp[2]):NaN;
  if(!stamp||!Number.isSafeInteger(Number(numberedTo))||Number(numberedTo)<1||
     numerator<1||numerator>denominator||denominator!==Number(numberedTo))
    return {allowed:false,reason:'serial_stamp_mismatch'};
  if(mode!=='parallel'||!parallelMatched||!parallelId||parallelId==='null')return {allowed:false,reason:'numbered_parallel_unverified'};
 }else if(mode==='parallel'&&(!parallelMatched||!parallelId||parallelId==='null')){
  return {allowed:false,reason:'parallel_unverified'};
 }else if(mode==='base'&&parallelId!=='null'){
  return {allowed:false,reason:'base_identifier_mismatch'};
 }
 return {allowed:true,reason:null};
}
export async function requestExactSales(input,request){
 const decision=exactPricingGate(input);
 if(!decision.allowed)return {decision,called:false,result:null};
 if(typeof request!=='function')throw new TypeError('request must be a function');
 return {decision,called:true,result:await request()};
}
