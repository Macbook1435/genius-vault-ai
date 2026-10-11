// Offline, provider-neutral reference adapter. Never treat a sample as verified source data.
const norm=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const num=v=>String(v??'').trim().replace(/^#/,'').toUpperCase();
function validStamp(stamp,limit){const m=String(stamp??'').match(/^(\d+)\/(\d+)$/);return Boolean(m&&Number(m[1])>=1&&Number(m[1])<=limit&&Number(m[2])===limit);}
export function normalizeChecklistResponse(response,source={}){
 if(response?.status!=='success'||!response.data||typeof response.data!=='object')throw Error('Invalid checklist response');
 const d=response.data;
 for(const k of ['year','sport','manufacturer','brand','card_number','player_name'])if(d[k]==null||!String(d[k]).trim())throw Error('Missing '+k);
 if(!Number.isInteger(d.year)||d.year<1900||d.year>2100)throw Error('Invalid year');
 if(!Array.isArray(d.available_parallels)||!Array.isArray(d.cross_referenced_inserts))throw Error('Missing variant lists');
 const provenance={sourceId:source.id??'unknown',sourceUrl:source.url??null,licensedForUse:source.licensedForUse===true,verifiedChecklist:source.verifiedChecklist===true};
 return {
  identity:{year:d.year,sport:String(d.sport),manufacturer:String(d.manufacturer),brand:String(d.brand),cardNumber:num(d.card_number),player:String(d.player_name),team:d.team??null,rookie:d.is_rookie_card===true},
  provenance,
  variants:d.available_parallels.map(p=>{
   if(!p||typeof p.name!=='string'||!p.name.trim())throw Error('Invalid parallel name');
   if(p.print_run!=null&&(!Number.isInteger(p.print_run)||p.print_run<=0))throw Error('Invalid print run');
   if(p.serial_numbered===false&&p.print_run!=null)throw Error('Conflicting serial metadata');
   return {id:p.parallel_id??null,name:p.name,numberedTo:p.print_run??null,serialNumbered:p.serial_numbered===true,visualIndicators:Array.isArray(p.visual_indicators)?p.visual_indicators.filter(x=>typeof x==='string'):[],distribution:p.distribution_type??null};
  }),
  relatedInserts:d.cross_referenced_inserts.map(i=>({id:i.insert_set_id??null,name:i.set_name??null,cardNumber:num(i.card_number),rarity:i.rarity??null})),
  status:provenance.licensedForUse&&provenance.verifiedChecklist?'reference_candidate':'unverified_reference'
 };
}
export function matchCardToChecklist(scan,ref){
 if(!scan||!ref?.identity)return {status:'no_match',reason:'Missing scan or reference'};
 const r=ref.identity,mismatches=[];
 for(const [field,left,right] of [['year',scan.year,r.year],['player',scan.player,r.player],['card number',num(scan.cardNumber),r.cardNumber]]){
  if(left==null||left==='')return {status:'insufficient_evidence',reason:'Missing '+field};
  if(norm(left)!==norm(right))mismatches.push(field);
 }
 const set=norm(scan.set||scan.product),brand=norm(scan.brand||scan.manufacturer);
 if(!set||!brand)return {status:'insufficient_evidence',reason:'Missing product identity'};
 if(!set.includes(norm(r.brand))&&!norm(r.brand).includes(set))mismatches.push('product');
 if(brand!==norm(r.manufacturer))mismatches.push('manufacturer');
 if(scan.sport&&norm(scan.sport)!==norm(r.sport))mismatches.push('sport');
 if(mismatches.length)return {status:'no_match',mismatches};
 return {status:'identity_match',parallelStatus:'unconfirmed',candidates:ref.variants,verified:ref.status==='reference_candidate'};
}
export function assessParallelEvidence(match,evidence={}){
 if(match?.status!=='identity_match')return {status:'not_applicable'};
 const name=norm(evidence.parallelName);
 if(!name)return {status:'unconfirmed',reason:'No reliable parallel observation'};
 const candidates=match.candidates.filter(p=>norm(p.name)===name);
 if(candidates.length!==1)return {status:'unconfirmed',reason:'Parallel not uniquely in checklist'};
 const p=candidates[0];
 if(p.serialNumbered&&(!evidence.serialConfirmed||!validStamp(evidence.serialStamp,p.numberedTo)))return {status:'unconfirmed',reason:'Stamped serial not independently confirmed',candidate:p};
 if(!evidence.visualConfirmed||!match.verified)return {status:'suggested',candidate:p};
 return {status:'confirmed',candidate:p};
}
