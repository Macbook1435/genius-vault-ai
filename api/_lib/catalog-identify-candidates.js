// Conservative, read-only card and parallel candidate evaluation.
// No network calls, database writes, or automatic identity verification.
const clean = v => String(v ?? '').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');
const exact = (a,b) => clean(a) === clean(b);
const positiveInt = v => {if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(v);return Number.isSafeInteger(n)&&n>0?n:null;};
export function evaluateCatalogCandidates({cards=[],year,cardNumber,manufacturer,product,player,serialTotal}={}) {
  if (!Number.isInteger(Number(year)) || !String(cardNumber ?? '').trim()) return {status:'not_verified',reason:'year and cardNumber required',candidates:[]};
  const matches=cards.filter(c=>Number(c.release_year)===Number(year)&&exact(c.card_number,cardNumber)&&
    (!manufacturer||exact(c.manufacturer,manufacturer))&&(!product||exact(c.product_name,product))&&(!player||exact(c.player_name,player)));
  if(!matches.length)return {status:'not_verified',reason:'No catalog match',candidates:[]};
  const total=positiveInt(serialTotal);
  const candidates=matches.map(c=>{
    const parallels=Array.isArray(c.parallels)?c.parallels:[];
    const hits=total===null?[]:parallels.filter(p=>p.print_run_basis==='documented'&&positiveInt(p.print_run)===total);
    return {card_id:c.id,parallel_status:hits.length>1?'ambiguous_print_run':hits.length===1?'possible_parallel_by_print_run':'not_verified',
      parallel_candidates:hits.map(p=>({id:p.id,parallel_name:p.parallel_name})),
      verified_parallel_id:null,reason:hits.length===1?'Print-run match alone is not proof of exact parallel':null};
  });
  return {status:candidates.length===1?'candidate_card_match':'multiple_card_matches',candidates};
}
