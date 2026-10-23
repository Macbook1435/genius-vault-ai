import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareChecklistImport} from '../api/_lib/catalog-import-prepare.js';
const mapping={manufacturer:'Maker',release_year:'Year',product_name:'Product',set_name:'Set',card_number:'Number',player_name:'Player'};
const csv='Maker,Year,Product,Set,Number,Player\nPanini,2025,Donruss,Base,340,Mason Graham\n';
const base={columnMapping:mapping,licenseStatus:'permission_review_pending',currentYear:2026};
test('optional catalog snapshot produces new classification without catalog ids',()=>{
 const r=prepareChecklistImport(csv,{...base,catalog:[],source:'manual_review'});
 assert.equal(r.rows[0].match_status,'new');
 assert.equal(r.rows[0].matched_card_id,null);
 assert.equal(r.safe_to_promote,false);
});
test('matching snapshot produces exact duplicate but no promotion',()=>{
 const catalog=[{id:12,manufacturer:'Panini',release_year:2025,product_name:'Donruss',set_name:'Base',card_number:'340',player_name:'Mason Graham'}];
 const r=prepareChecklistImport(csv,{...base,catalog,source:'manual_review'});
 assert.equal(r.rows[0].match_status,'exact_duplicate');
 assert.equal(r.rows[0].matched_card_id,null);
 assert.equal(r.safe_to_promote,false);
});
test('without catalog snapshot match status remains null',()=>{
 const r=prepareChecklistImport(csv,base);
 assert.equal(r.rows[0].match_status,null);
});
