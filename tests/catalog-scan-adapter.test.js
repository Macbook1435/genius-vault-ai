import test from 'node:test';
import assert from 'node:assert/strict';
import {scannerCatalogQuery,scannerCatalogEvidence} from '../api/_lib/catalog-scan-adapter.js';
test('missing product name never guesses a catalog query',()=>{
 assert.equal(scannerCatalogQuery({brand:'Panini',year:2025,set:'Absolute',cardNumber:'340',player:'Example'}),null);
});
test('complete explicit identity maps to lookup fields',()=>{
 assert.deepEqual(scannerCatalogQuery({brand:'Panini',catalogManufacturer:'Panini',year:2025,catalogProductName:'Donruss',set:'Base',cardNumber:'#340',player:'Example'}),{
 manufacturer:'Panini',year:2025,productName:'Donruss',setName:'Base',cardNumber:'340',playerName:'Example'});
});
test('unverified catalog identity stays not verified',()=>{
 assert.deepEqual(scannerCatalogEvidence({verifiedIdentity:false,sources:[]}),{status:'not_verified',identity_verified:false,parallel_verified:false,sources:[]});
});
test('verified identity never implies verified parallel',()=>{
 const result=scannerCatalogEvidence({verifiedIdentity:true,sources:[{source_type:'manufacturer',source_title:'Checklist',source_url:'https://example.org'}],parallel:{id:1}});
 assert.equal(result.status,'verified_identity_only');
 assert.equal(result.parallel_verified,false);
});

test('scanner display labels alone cannot authorize a catalog lookup',()=>{
 assert.equal(scannerCatalogQuery({brand:'Panini',year:2025,productName:'Donruss',set:'Base',cardNumber:'340',player:'Example'}),null);
});
