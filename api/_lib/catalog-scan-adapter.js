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

// Read-only identity resolver. Candidate catalog records must already have verified
// provenance; a matching display name is not sufficient to invent a product.
export function resolveCatalogProduct(scan, candidates) {
 if(!scan||!Array.isArray(candidates)||!candidates.length)return null;
 const year=Number(scan.year);
 if(!Number.isInteger(year)||year<1880||year>2100)return null;
 const normalized=v=>clean(v).normalize('NFKC').replace(/\s+/g,' ').toLocaleLowerCase('en-US');
 const displayed=normalized(scan.set);
 if(!displayed||bad(displayed))return null;
 const matches=candidates.filter(c=>
  c&&
  Array.isArray(c.sources)&&c.sources.some(s=>s?.verification_status==='verified'&&/^https:\/\//i.test(clean(s.source_url)))&&
  Number(c.release_year)===year&&
  !bad(clean(c.manufacturer))&&!bad(clean(c.product_name))&&
  !bad(clean(c.display_set_name))&&normalized(c.display_set_name)===displayed
 );
 // Source verification is stored on gv_catalog_sources, not gv_catalog_products.
 // Candidate display_set_name must be explicitly provided by a reviewed source adapter.
 // Never pick the first match when two products share a display name.
 if(matches.length!==1)return null;
 return {catalogManufacturer:clean(matches[0].manufacturer),catalogProductName:clean(matches[0].product_name)};
}
