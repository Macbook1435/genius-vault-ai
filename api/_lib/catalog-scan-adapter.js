// Phase 2: pure adapter between scanner fields and the server-only catalog lookup.
// No API calls, database writes, billing changes, or production scanner modifications.
const clean=v=>v===null||v===undefined?'':String(v).trim();
const bad=v=>!v||/^(unknown|not verified|needs review|n\/a|null|undefined)$/i.test(v);
export function scannerCatalogQuery(scan){
 if(!scan||typeof scan!=='object')return null;
 const manufacturer=clean(scan.catalogManufacturer),year=Number(scan.year),productName=clean(scan.catalogProductName);
 const setName=clean(scan.set),cardNumber=clean(scan.cardNumber).replace(/^#/,'');
 const playerName=clean(scan.player);
 // Scanner brand/set are display labels, not authoritative manufacturer/product identity.
 // Only independently established catalogManufacturer/catalogProductName may be queried.
 if([manufacturer,productName,setName,cardNumber,playerName].some(bad))return null;
 if(!Number.isInteger(year)||year<1880||year>2100)return null;
 return {manufacturer,year,productName,setName,cardNumber,playerName};
}
export function scannerCatalogEvidence(lookup){
 if(!lookup||!lookup.verifiedIdentity||!Array.isArray(lookup.sources)||lookup.sources.length===0)
  return {status:'not_verified',identity_verified:false,parallel_verified:false,sources:[]};
 return {
  status:'verified_identity_only',
  identity_verified:true,
  parallel_verified:false,
  sources:lookup.sources.map(s=>({source_type:s.source_type??null,source_title:s.source_title??null,source_url:s.source_url??null}))
 };
}
