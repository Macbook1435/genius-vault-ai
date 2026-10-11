// Provider-neutral offline comp evaluator. No network calls or credentials.
const norm=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const money=n=>Number(n.toFixed(2));
function median(values){const s=[...values].sort((a,b)=>a-b);const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2}
export function evaluateParallelComps(card,parallel,sales){
 if(!card||!parallel||!Array.isArray(sales))throw new TypeError('Card, parallel and sales required');
 const accepted=[],rejected=[];
 const pName=norm(parallel.name),year=Number(card.year),number=norm(String(card.cardNumber??'').replace(/^#/,''));
 if(!Number.isInteger(year)||!number||!pName||!norm(card.player)||!norm(card.set)||!norm(card.brand))
  return {status:'insufficient_card_identity',comps:[],rejected:[],statistics:null};
 for(const sale of sales){
  const reasons=[];
  if(!sale||typeof sale!=='object'){rejected.push({reason:'Invalid record'});continue}
  if((sale.currency??'USD')!=='USD')reasons.push('currency');
  if(sale.transactionVerified!==true)reasons.push('sale not verified');
  if(sale.saleStatus!=='sold')reasons.push('not sold');
  if(sale.acceptedOffer===true&&sale.finalPriceVerified!==true)reasons.push('best offer amount unknown');
  if(sale.isGraded!==false)reasons.push('graded status unknown or graded');
  if(Number(sale.year)!==year)reasons.push('year');
  if(norm(sale.player)!==norm(card.player))reasons.push('player');
  if(norm(sale.brand)!==norm(card.brand)||norm(sale.set)!==norm(card.set))reasons.push('product');
  if(norm(String(sale.cardNumber??'').replace(/^#/,''))!==number)reasons.push('card number');
  if(norm(sale.parallel)!==pName)reasons.push('parallel');
  if(Number.isInteger(parallel.numberedTo)&&Number(sale.numberedTo)!==parallel.numberedTo)reasons.push('print run');
  if(typeof card.autograph==='boolean'&&sale.autograph!==card.autograph)reasons.push('autograph');
  if(typeof card.memorabilia==='boolean'&&sale.memorabilia!==card.memorabilia)reasons.push('memorabilia');
  if(!Number.isFinite(sale.finalSalePrice)||sale.finalSalePrice<=0)reasons.push('final sale price');
  if(!sale.saleId||!sale.sourceUrl)reasons.push('sale provenance');
  if(reasons.length){rejected.push({saleId:sale.saleId??null,reasons});continue}
  accepted.push({saleId:sale.saleId,price:money(sale.finalSalePrice),soldAt:sale.soldAt??null,sourceUrl:sale.sourceUrl});
 }
 const prices=accepted.map(x=>x.price);
 return {status:prices.length?'verified_sales':'no_verified_exact_comps',comps:accepted,rejected,
  statistics:prices.length?{count:prices.length,min:money(Math.min(...prices)),max:money(Math.max(...prices)),median:money(median(prices)),average:money(prices.reduce((a,b)=>a+b,0)/prices.length)}:null,
  note:'Prices are from supplied independently verified sold transactions only; no live feed or market valuation is inferred.'};
}
