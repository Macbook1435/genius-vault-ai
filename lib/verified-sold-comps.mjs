// TEST-only pure sold-comparable estimator. No network or sample-price fallback.
export function estimateFromVerifiedSales(card, sales, { minimumComps = 3 } = {}) {
  if (!card || !card.verified || !card.year || !card.product_name || !card.card_number || !card.player_name || !card.parallel_name)
    return {status:'identity_unverified',estimated_value_usd:null};
  if (!Array.isArray(sales)) throw new TypeError('sales must be an array');
  const same=(a,b)=>String(a??'').trim().toLowerCase()===String(b??'').trim().toLowerCase();
  const matching=sales.filter(s=>s.verification_status==='verified' && s.sold_at && s.source_url && s.currency==='USD'
    && Number.isFinite(s.price) && s.price>0 && Number(s.year)===Number(card.year)
    && ['product_name','card_number','player_name','parallel_name'].every(k=>same(s[k],card[k]))
    && same(s.grade_company||'raw',card.grade_company||'raw')
    && !s.is_relisted && !s.is_returned);
  const distinct=[...new Map(matching.map(s=>[String(s.source)+'|'+String(s.source_sale_id||s.source_url),s])).values()];
  if(distinct.length<minimumComps)return {status:'insufficient_verified_comps',sample_size:distinct.length,estimated_value_usd:null};
  const sorted=distinct.map(s=>s.price).sort((a,b)=>a-b);
  const mid=Math.floor(sorted.length/2);
  const median=sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
  return {status:'verified_comps_available',sample_size:sorted.length,estimated_value_usd:Math.round(median*100)/100,
    low_usd:sorted[0],high_usd:sorted.at(-1),method:'median_untrimmed_verified_exact_match'};
}
