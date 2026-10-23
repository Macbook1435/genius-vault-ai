// Conservative Phase 2 matcher. Pure function: no network or database writes.
import {normalizeKey} from './catalog-import-validation.js';
const has=v=>v!==null&&v!==undefined&&String(v).trim()!=='';
const eq=(a,b)=>normalizeKey(a)===normalizeKey(b);
const identity=['manufacturer','release_year','product_name','set_name','card_number','player_name'];
const cardFields=['team_name','is_rookie','is_autograph','is_memorabilia','card_type'];
const parallelFields=['print_run','serial_numbered','color_signature','finish_signature'];
function value(v){if(typeof v==='boolean')return v;if(/^(true|yes|y|1)$/i.test(String(v)))return true;if(/^(false|no|n|0)$/i.test(String(v)))return false;return normalizeKey(v);}
function compare(input,existing,fields){
 const conflicts=[],fills=[];
 for(const field of fields){if(!has(input[field]))continue;
  if(!has(existing[field]))fills.push({field,incoming:input[field]});
  else if(value(input[field])!==value(existing[field]))conflicts.push({field,existing:existing[field],incoming:input[field]});
 }
 return {conflicts,fills};
}
export function matchChecklistRecord(input,{catalog=[],source=null,licenseStatus=null}={}){
 const result=(status,reason,matches=[],changes=[])=>({status,reason,matches,changes,requires_review:true});
 if(!input||identity.some(k=>!has(input[k]))||!Number.isInteger(Number(input.release_year))||!has(source)||!has(licenseStatus))
  return result('ambiguous','Missing required identity, source, or license declaration');
 if(!Array.isArray(catalog))throw new TypeError('catalog must be an array');
 const matches=catalog.filter(c=>identity.every(k=>has(c[k])&&eq(c[k],input[k])));
 if(matches.length>1)return result('ambiguous','Multiple catalog identity matches',matches.map(c=>c.id));
 if(!matches.length)return result('new','No matching catalog identity; requires review');
 const card=matches[0],ids=[card.id];
 const base=compare(input,card,cardFields);
 if(base.conflicts.length)return result('conflict','Card field conflict',ids,base.conflicts);
 if(has(input.parallel_name)){
  if(!Array.isArray(card.parallels))return result('ambiguous','Parallel catalog not supplied',ids);
  const variants=card.parallels.filter(p=>has(p.parallel_name)&&eq(p.parallel_name,input.parallel_name));
  if(variants.length!==1)return result('ambiguous','Parallel missing or nonunique',ids);
  const parallel=compare(input,variants[0],parallelFields);
  if(parallel.conflicts.length)return result('conflict','Parallel field conflict',ids,parallel.conflicts);
  const fills=[...base.fills,...parallel.fills];
  return result(fills.length?'fill_candidate':'exact_duplicate',fills.length?'Missing catalog fields':'Identity and supplied fields match',ids,fills);
 }
 if(parallelFields.some(k=>has(input[k])))return result('ambiguous','Parallel attributes without parallel name',ids);
 return result(base.fills.length?'fill_candidate':'exact_duplicate',base.fills.length?'Missing catalog fields':'Identity and supplied fields match',ids,base.fills);
}
