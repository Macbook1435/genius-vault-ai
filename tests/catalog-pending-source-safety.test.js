import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCatalogProduct, lookupVerifiedScanIdentity } from '../api/_lib/catalog-scan-adapter.js';
import { exactCompsAllowed } from '../api/_lib/catalog-exact-comps-gate.js';

const scan={year:2025,set:'Panini Donruss',player:'Mason Graham',cardNumber:'340'};
const pendingCandidate={
 manufacturer:'Panini',release_year:2025,product_name:'Donruss Football',
 display_set_name:'Panini Donruss',
 sources:[{verification_status:'pending',source_url:'https://example.com/reference',source_title:'User comparison screenshot'}]
};

test('pending Mason Graham catalog record cannot establish verified product identity',()=>{
 assert.equal(resolveCatalogProduct(scan,[pendingCandidate]),null);
});

test('pending catalog source never triggers a verified identity lookup',async()=>{
 let called=false;
 const result=await lookupVerifiedScanIdentity(scan,[pendingCandidate],async()=>{called=true;return {verifiedIdentity:true,sources:[]};});
 assert.equal(called,false);
 assert.equal(result.identity_verified,false);
});

test('pending catalog evidence cannot authorize a price estimate',()=>{
 assert.equal(exactCompsAllowed({identityTrusted:false,parallelStatus:'matched'}),false);
});

test('a user-provided comparison image is not a verified sold transaction',()=>{
 const listing={asking_price:1.99,sale_confirmed:false};
 assert.equal(listing.sale_confirmed,false);
});
