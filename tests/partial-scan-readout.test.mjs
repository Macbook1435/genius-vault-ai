import test from 'node:test';
import assert from 'node:assert/strict';
import {partialScanReadout} from '../api/_lib/partial-scan-readout.mjs';
const card={player:'Bhayshul Tuten',team:'Jacksonville Jaguars',cardNumber:'164',autograph:true,serialNumber:'33/50',year:2025,set:'Topps Signature Class',parallel:null};
test('Tuten card retains readable fields on missing catalog',()=>{
 const x=partialScanReadout(card,'no_match');
 assert.equal(x.status,'partially_identified');
 assert.equal(x.details.player,'Bhayshul Tuten');
 assert.equal(x.details.serialNumber,'33/50');
 assert.equal(x.details.autograph,true);
 assert.equal(x.exactParallelStatus,'unconfirmed');
 assert.equal(x.exactSoldPriceAvailable,false);
});
test('catalog error preserves evidence without manufacturing variation',()=>{
 const x=partialScanReadout({...card,parallel:'Orange Lava'},'error');
 assert.equal(x.details.parallel,null);
 assert.equal(x.exactSoldPriceAvailable,false);
});
test('unverified numbered parallel never exposes exact sold estimate',()=>{
 const x=partialScanReadout({...card,parallel:'Orange',parallelVerified:false},'matched');
 assert.equal(x.exactSoldPriceAvailable,false);
});
test('confirmed catalog parallel can be represented without manufacturing a price',()=>{
 const x=partialScanReadout({...card,parallel:'Orange',parallelVerified:true},'matched');
 assert.equal(x.details.parallel,'Orange');
 assert.equal(x.exactParallelStatus,'verified');
});
