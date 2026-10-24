import test from 'node:test';
import assert from 'node:assert/strict';
import {scannerCatalogQuery,scannerCatalogEvidence,resolveCatalogProduct} from '../api/_lib/catalog-scan-adapter.js';
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

test('manufacturer must be independently established even when product is explicit',()=>{
 assert.equal(scannerCatalogQuery({brand:'Panini',catalogProductName:'Donruss',year:2025,set:'Base',cardNumber:'340',player:'Example'}),null);
});
test('missing player or card number cannot produce a lookup',()=>{
 const base={catalogManufacturer:'Panini',catalogProductName:'Donruss',year:2025,set:'Base',cardNumber:'340',player:'Example'};
 assert.equal(scannerCatalogQuery({...base,player:null}),null);
 assert.equal(scannerCatalogQuery({...base,cardNumber:'Not verified'}),null);
});
test('catalog evidence with no verified identity remains unverified even with source metadata',()=>{
 const r=scannerCatalogEvidence({verifiedIdentity:false,sources:[{source_type:'manufacturer',source_title:'Checklist'}]});
 assert.equal(r.identity_verified,false);
 assert.equal(r.parallel_verified,false);
});

const verifiedProduct={manufacturer:'Panini',release_year:2025,product_name:'Donruss Optic',display_set_name:'Donruss Optic',sources:[{verification_status:'verified',source_url:'https://example.org/checklist'}]};
test('product resolver accepts only a unique source-verified match',()=>{
 assert.deepEqual(resolveCatalogProduct({year:2025,set:'Donruss Optic'},[verifiedProduct]),{catalogManufacturer:'Panini',catalogProductName:'Donruss Optic'});
});
test('product resolver abstains on ambiguous verified products',()=>{
 assert.equal(resolveCatalogProduct({year:2025,set:'Donruss Optic'},[verifiedProduct,{...verifiedProduct,product_name:'Different Release'}]),null);
});
test('product resolver rejects unsupported provenance',()=>{
 assert.equal(resolveCatalogProduct({year:2025,set:'Donruss Optic'},[{...verifiedProduct,sources:[]}]),null);
 assert.equal(resolveCatalogProduct({year:2025,set:'Donruss Optic'},[{...verifiedProduct,sources:[{verification_status:'pending',source_url:'https://example.org/checklist'}]}]),null);
});
test('product resolver rejects year mismatch',()=>{
 assert.equal(resolveCatalogProduct({year:2024,set:'Donruss Optic'},[verifiedProduct]),null);
});

test('product resolver rejects missing display-set provenance and non-HTTPS sources',()=>{
 assert.equal(resolveCatalogProduct({year:2025,set:'Donruss Optic'},[{...verifiedProduct,display_set_name:null}]),null);
 assert.equal(resolveCatalogProduct({year:2025,set:'Donruss Optic'},[{...verifiedProduct,sources:[{verification_status:'verified',source_url:'http://example.org/checklist'}]}]),null);
});
