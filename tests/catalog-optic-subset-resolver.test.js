import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveOpticSubset} from '../api/_lib/catalog-optic-subset-resolver.js';
const scan={year:2025,brand:'Panini',set:'Donruss Optic',player:'Isaac TeSlaa',cardNumber:'219',autograph:true};
const evidence={verification_status:'verified',source_url:'https://example.org/checklist',card_number:'219',player:'Isaac TeSlaa',product_id:'2025-donruss-optic-football',subset_id:'rookie_auto'};
test('autograph boolean alone never verifies subset',()=>assert.equal(resolveOpticSubset(scan,null).status,'not_verified'));
test('self-labeled verified evidence cannot resolve autograph subset',()=>{
 const r=resolveOpticSubset(scan,evidence);
 assert.equal(r.status,'not_verified');
 assert.equal(r.subset_id,null);
});
test('wrong player cannot verify subset',()=>assert.equal(resolveOpticSubset(scan,{...evidence,player:'Other Player'}).status,'not_verified'));
test('wrong number cannot verify subset',()=>assert.equal(resolveOpticSubset(scan,{...evidence,card_number:'220'}).status,'not_verified'));
test('unverified source cannot verify subset',()=>assert.equal(resolveOpticSubset(scan,{...evidence,verification_status:'pending'}).status,'not_verified'));
test('non-HTTPS source cannot verify subset',()=>assert.equal(resolveOpticSubset(scan,{...evidence,source_url:'http://example.org'}).status,'not_verified'));
test('subset must match product reference candidate',()=>assert.equal(resolveOpticSubset(scan,{...evidence,subset_id:'base_auto'}).status,'not_verified'));
test('unrelated product cannot verify subset',()=>assert.equal(resolveOpticSubset(scan,{...evidence,product_id:'2025-panini-absolute-football'}).status,'not_verified'));
