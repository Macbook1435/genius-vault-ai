import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const base={source_title:'Example manufacturer checklist',source_url:'https://example.org/checklist.pdf',commercial_import_authorized:true,permission_reference:'example written permission reference',cards:[{manufacturer:'Panini',year:2025,product:'Donruss Football',set:'Optic Rated Rookies Preview',card_number:'340',player:'Mason Graham'}]};
function run(data){
 const dir=mkdtempSync(join(tmpdir(),'gv-catalog-'));
 try{
  const path=join(dir,'manifest.json');writeFileSync(path,JSON.stringify(data));
  return spawnSync(process.execPath,['scripts/checklist-stage-validator.mjs',path],{encoding:'utf8'});
 } finally{rmSync(dir,{recursive:true,force:true});}
}
test('licensed, complete checklist passes validation without writing data',()=>{const r=run(base);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/validated_for_review_only/);});
test('unknown commercial rights block import',()=>{const r=run({...base,commercial_import_authorized:false});assert.equal(r.status,1);assert.match(r.stderr,/permission not confirmed/);});
test('missing provenance blocks import',()=>{const r=run({...base,permission_reference:''});assert.equal(r.status,1);});
test('duplicate card entries block import',()=>{const r=run({...base,cards:[...base.cards,...base.cards]});assert.equal(r.status,1);assert.match(r.stderr,/duplicate/);});
test('incomplete identity blocks import',()=>{const r=run({...base,cards:[{...base.cards[0],card_number:''}]});assert.equal(r.status,1);});
