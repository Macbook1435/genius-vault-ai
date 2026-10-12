// Pure final-response safety net. Does not call APIs or mutate scanner state.
function safeSoldResponse({identityTrusted=false,variationUnresolved=false,comps={},market={}}={}) {
  const blocked=!identityTrusted||variationUnresolved||comps.status==='exact_match_unverified';
  if (!blocked) return {comps,market,blocked:false};
  const status=!identityTrusted?'identity_unverified':'exact_variation_unverified';
  const reason=!identityTrusted
    ? 'Identity unverified; sold-price statistics withheld.'
    : 'Exact variation unverified; sold-price statistics withheld.';
  const empty={min:null,max:null,median:null,mean:null,count:0,items:[],status,error:reason};
  const safeComps={...comps,...empty};
  const sold=market?.sold?{...market.sold,...empty,kind:'sold',source:'verification_gate'}:null;
  return {blocked:true,comps:safeComps,market:market?{...market,...(sold?{sold}:{})}:market};
}

// CommonJS for Vercel's serverless runtime; the .mjs twin remains for offline tests.
module.exports = { safeSoldResponse };
