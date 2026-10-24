import test from 'node:test';
import assert from 'node:assert/strict';
import {opticSubsetCandidates} from '../api/_lib/catalog-optic-subset-candidates.js';
const scan={year:2025,brand:'Panini',set:'Donruss Optic',cardNumber:'219'};
test('rookie card number overlaps base and autograph subsets',()=>{
 const r=opticSubsetCandidates(scan);
 assert.equal(r.status,'ambiguous_subset');
 assert.deepEqual(r.candidates.map(c=>c.id).sort(),['base_rookie','rookie_auto']);
 assert.equal(r.verified_subset,false);
});
test('veteran card number also overlaps base and autograph subsets',()=>{
 const r=opticSubsetCandidates({...scan,cardNumber:'15'});
 assert.equal(r.status,'ambiguous_subset');
 assert.deepEqual(r.candidates.map(c=>c.id).sort(),['base_auto','base_vet']);
});
test('unknown card number cannot establish subset',()=>assert.equal(opticSubsetCandidates({...scan,cardNumber:'unknown'}).status,'card_number_unconfirmed'));
test('other release cannot inherit Optic subset',()=>assert.equal(opticSubsetCandidates({...scan,set:'Absolute'}).status,'unrelated_product'));
