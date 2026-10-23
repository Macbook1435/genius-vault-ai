import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareChecklistImport} from '../api/_lib/catalog-import-prepare.js';
import {evaluateCatalogCandidates} from '../api/_lib/catalog-identify-candidates.js';

const mapping={manufacturer:'Maker',release_year:'Year',product_name:'Product',set_name:'Set',card_number:'Number',player_name:'Player',parallel_name:'Parallel',print_run:'Print Run',print_run_basis:'Basis'};
const header='Maker,Year,Product,Set,Number,Player,Parallel,Print Run,Basis';
const row='Panini,2025,Absolute,Rookie Force,RF-KWS,Kyle Williams,Red,99,documented';

test('valid checklist produces review candidate, never promotion',()=>{
 const r=prepareChecklistImport(header+'\n'+row+'\n',{columnMapping:mapping,licenseStatus:'permission_review_pending',currentYear:2026});
 assert.equal(r.summary.parsed,1);
 assert.equal(r.summary.invalid,0);
 assert.equal(r.safe_to_promote,false);
 assert.equal(r.rows[0].review_status,'pending');
 assert.equal(r.rows[0].matched_card_id,null);
});
test('missing player is blocked',()=>{
 const r=prepareChecklistImport(header+'\n'+row.replace('Kyle Williams','')+'\n',{columnMapping:mapping,licenseStatus:'permission_review_pending',currentYear:2026});
 assert.equal(r.summary.invalid,1);
 assert.ok(r.rows[0].issues.some(i=>i.code==='MISSING_REQUIRED:player_name'));
});
test('duplicate checklist row flagged',()=>{
 const r=prepareChecklistImport(header+'\n'+row+'\n'+row+'\n',{columnMapping:mapping,licenseStatus:'permission_review_pending',currentYear:2026});
 assert.equal(r.summary.invalid,1);
 assert.ok(r.rows[1].issues.some(i=>i.code==='DUPLICATE_IN_FILE'));
});
test('malformed CSV row is rejected without guessing columns',()=>{
 const r=prepareChecklistImport(header+'\nPanini,2025\n',{columnMapping:mapping,licenseStatus:'permission_review_pending',currentYear:2026});
 assert.equal(r.summary.parse_errors,1);
 assert.equal(r.summary.parsed,0);
});
test('undocumented print run never verifies a parallel',()=>{
 const r=evaluateCatalogCandidates({year:2025,cardNumber:'RF-KWS',serialTotal:99,cards:[{
  id:7,release_year:2025,card_number:'RF-KWS',manufacturer:'Panini',product_name:'Absolute',player_name:'Kyle Williams',
  parallels:[{id:11,parallel_name:'Red',print_run:99,print_run_basis:'documented'}]
 }]});
 assert.equal(r.status,'candidate_card_match');
 assert.equal(r.candidates[0].parallel_status,'possible_parallel_by_print_run');
 assert.equal(r.candidates[0].verified_parallel_id,null);
});
test('two equal print runs are ambiguous',()=>{
 const r=evaluateCatalogCandidates({year:2025,cardNumber:'RF-KWS',serialTotal:99,cards:[{
  id:7,release_year:2025,card_number:'RF-KWS',
  parallels:[{id:11,parallel_name:'Red',print_run:99,print_run_basis:'documented'},
  {id:12,parallel_name:'Blue',print_run:99,print_run_basis:'documented'}]
 }]});
 assert.equal(r.candidates[0].parallel_status,'ambiguous_print_run');
});
