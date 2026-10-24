import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
const dir=mkdtempSync(join(tmpdir(),"gv-catalog-"));
const run=(rows,mode="--dry-run",env={})=>{
 const file=join(dir,"input.json");writeFileSync(file,JSON.stringify(rows));
 return spawnSync(process.execPath,["scripts/catalog-import.mjs",file,mode],{encoding:"utf8",env:{...process.env,...env}});
};
const valid={manufacturer:"Panini",release_year:2025,product_name:"Donruss Football",set_name:"Optic Rated Rookies Preview",card_number:"340",player_name:"Mason Graham",parallel_name:"Red Pandora Prizm",source_url:"https://example.org/checklist"};
test("valid checklist passes dry-run without credentials",()=>assert.equal(run([valid]).status,0));
test("duplicate entries are rejected",()=>assert.notEqual(run([valid,valid]).status,0));
test("source URL is required",()=>assert.notEqual(run([{...valid,source_url:""}]).status,0));
test("non-HTTPS source is rejected",()=>assert.notEqual(run([{...valid,source_url:"http://example.org"}]).status,0));
test("non-integer year is rejected",()=>assert.notEqual(run([{...valid,release_year:"2025"}]).status,0));
test("writes without credentials are rejected",()=>assert.notEqual(run([valid],"--apply").status,0));
test("production URL is rejected before network request",()=>{
 const result=run([valid],"--apply",{TEST_SUPABASE_URL:"https://production.supabase.co",TEST_SUPABASE_SERVICE_ROLE_KEY:"fake"});
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/Refusing writes/);
});
test.after(()=>rmSync(dir,{recursive:true,force:true}));
