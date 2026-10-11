import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {safeSoldResponse} from '../api/_lib/safe-sold-response.mjs';

const source=fs.readFileSync(new URL('../api/scan.js',import.meta.url),'utf8');
test('real scanner calls sold-price sanitizer before constructing its response',()=>{
 const gate=source.indexOf('const sanitizedSales = safeSoldResponse(');
 const response=source.indexOf('return res.status(200).json(',gate);
 assert.ok(gate>0&&response>gate,'Missing response sanitizer wiring');
 assert.match(source.slice(gate,response),/Object\.assign\(comps, sanitizedSales\.comps\)/);
 assert.match(source.slice(gate,response),/market = sanitizedSales\.market/);
});
const sales={min:4,median:24,max:70,mean:25,count:3,items:[{price:24}],status:'comps_found'};
test('unverified Tuten autograph /50 has no customer-facing sold prices',()=>{
 const r=safeSoldResponse({identityTrusted:true,variationUnresolved:true,comps:sales,market:{sold:sales,active:{count:2}}});
 assert.equal(r.comps.count,0);
 assert.equal(r.comps.median,null);
 assert.deepEqual(r.comps.items,[]);
 assert.equal(r.market.sold.median,null);
 assert.equal(r.market.sold.count,0);
 assert.equal(r.market.active.count,2);
});
test('untrusted identity clears both sold-price representations',()=>{
 const r=safeSoldResponse({identityTrusted:false,comps:sales,market:{sold:sales}});
 assert.equal(r.comps.status,'identity_unverified');
 assert.equal(r.market.sold.status,'identity_unverified');
 assert.equal(r.comps.max,null);
});
test('verified identity and variation keep eligible exact sold prices',()=>{
 const r=safeSoldResponse({identityTrusted:true,variationUnresolved:false,comps:sales,market:{sold:sales}});
 assert.equal(r.comps.median,24);
 assert.equal(r.market.sold.count,3);
});
