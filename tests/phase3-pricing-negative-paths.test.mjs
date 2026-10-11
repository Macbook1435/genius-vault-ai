import test from 'node:test';
import assert from 'node:assert/strict';
import {safeSoldResponse} from '../api/_lib/safe-sold-response.mjs';
import {requestExactSales} from '../api/_lib/exact-pricing-gate.mjs';

const sales=()=>({status:'comps_found',count:2,min:10,max:900,median:455,mean:455,items:[{price:10},{price:900}]});

test('Tuten 33/50: verified stamp without verified parallel never calls pricing',async()=>{
 let calls=0;
 const result=await requestExactSales({
   identityTrusted:true,mode:'parallel',parallelId:null,
   serialNumber:'33/50',numberedTo:50,serialVerified:true,
   parallelMatched:false,catalogAvailable:false,
 },()=>{calls++;return sales()});
 assert.equal(result.called,false);
 assert.equal(result.result,null);
 assert.equal(calls,0);
});
test('customer response hides previously collected sales on catalog failure',()=>{
 const result=safeSoldResponse({identityTrusted:true,variationUnresolved:true,
   comps:sales(),market:{sold:sales(),active:{count:1,items:[{askingPrice:75}]}}});
 assert.equal(result.comps.count,0);
 assert.equal(result.comps.median,null);
 assert.deepEqual(result.comps.items,[]);
 assert.equal(result.market.sold.count,0);
 assert.equal(result.market.sold.max,null);
 assert.deepEqual(result.market.sold.items,[]);
 assert.equal(result.market.active.count,1);
});
test('a rejected player identity hides all exact sold prices',()=>{
 const result=safeSoldResponse({identityTrusted:false,variationUnresolved:false,comps:sales(),market:{sold:sales()}});
 assert.equal(result.comps.status,'identity_unverified');
 assert.equal(result.comps.mean,null);
 assert.equal(result.market.sold.status,'identity_unverified');
});
test('a trusted exact variant keeps original qualifying sales',()=>{
 const original=sales();
 const result=safeSoldResponse({identityTrusted:true,variationUnresolved:false,comps:original,market:{sold:original}});
 assert.equal(result.blocked,false);
 assert.equal(result.comps.median,455);
 assert.equal(result.market.sold.count,2);
});
