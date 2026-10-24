// Test-branch checklist importer. Run only with TEST Supabase credentials.
// Input: JSON array [{manufacturer,release_year,product_name,sport,set_name,card_number,player_name,parallel_name?,source_url,source_title?}]
// No writes without explicit --apply. Source records stay pending until independently verified.
import {readFileSync} from "node:fs";
const [file,mode]=process.argv.slice(2);
if(!file || !["--dry-run","--apply"].includes(mode)){console.error("Usage: node scripts/catalog-import.mjs checklist.json --dry-run|--apply");process.exit(2);}
const rows=JSON.parse(readFileSync(file,"utf8"));
if(!Array.isArray(rows))throw Error("Expected JSON array");
const required=["manufacturer","release_year","product_name","set_name","card_number","player_name","source_url"];
for(const [i,r] of rows.entries()){
 for(const k of required)if(!r[k])throw Error(`Row ${i+1}: missing ${k}`);
 if(!/^https:\/\//i.test(r.source_url))throw Error(`Row ${i+1}: HTTPS source URL required`);
 if(!Number.isInteger(r.release_year))throw Error(`Row ${i+1}: invalid release_year`);
}
const key=r=>[r.manufacturer,r.release_year,r.product_name,r.set_name,r.card_number,r.player_name,r.parallel_name||""].map(v=>String(v).trim().toLowerCase()).join("|");
const unique=new Map(rows.map(r=>[key(r),r]));
if(unique.size!==rows.length)throw Error("Duplicate checklist entries in input");
console.log(`Validated ${rows.length} entries; mode: ${mode}`);
if(mode==="--dry-run")process.exit(0);
const url=process.env.TEST_SUPABASE_URL,keyEnv=process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
if(!url||!keyEnv||!/^https:\/\//.test(url))throw Error("TEST Supabase credentials required; never use production keys");
const target=new URL(url);
if(target.hostname!=="upvklqpoekudqifydmwr.supabase.co" || target.pathname!=="/" || target.search || target.hash)throw Error("Refusing writes: URL must be the exact Genius Vault TEST Supabase project");
const headers={apikey:keyEnv,Authorization:`Bearer ${keyEnv}`,"Content-Type":"application/json"};
async function request(table,query="",options={}){
 const response=await fetch(`${url}/rest/v1/${table}${query}`,{headers:{...headers,...options.headers},...options});
 if(!response.ok)throw Error(`${table}: HTTP ${response.status} ${(await response.text()).slice(0,400)}`);
 const body=await response.text();return body?JSON.parse(body):[];
}
async function findOrCreate(table,fields,match){
 const q=new URLSearchParams({select:"*"});for(const [k,v] of Object.entries(match))q.set(k,`eq.${v}`);
 const found=await request(table,`?${q}`);if(found.length>1)throw Error(`Ambiguous existing ${table} record`);
 if(found.length)return found[0];
 const created=await request(table,"",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(fields)});
 return created[0];
}
for(const r of rows){
 const p=await findOrCreate("gv_catalog_products",{manufacturer:r.manufacturer,release_year:r.release_year,product_name:r.product_name,sport:r.sport||null},{manufacturer:r.manufacturer,release_year:r.release_year,product_name:r.product_name});
 const c=await findOrCreate("gv_catalog_cards",{product_id:p.id,set_name:r.set_name,card_number:String(r.card_number),player_name:r.player_name},{product_id:p.id,set_name:r.set_name,card_number:String(r.card_number),player_name:r.player_name});
 let parallel=null;
 if(r.parallel_name)parallel=await findOrCreate("gv_catalog_parallels",{card_id:c.id,parallel_name:r.parallel_name},{card_id:c.id,parallel_name:r.parallel_name});
 const sources=await request("gv_catalog_sources",`?select=id&card_id=eq.${c.id}&source_url=eq.${encodeURIComponent(r.source_url)}&source_type=eq.manufacturer_checklist${parallel?`&parallel_id=eq.${parallel.id}`:"&parallel_id=is.null"}`);
 if(!sources.length)await request("gv_catalog_sources","",{method:"POST",body:JSON.stringify({card_id:c.id,parallel_id:parallel?.id||null,source_type:"manufacturer_checklist",source_title:r.source_title||"Manufacturer checklist (pending review)",source_url:r.source_url,verification_status:"pending"})});
}
console.log("Import complete; all new source claims remain pending verification.");
