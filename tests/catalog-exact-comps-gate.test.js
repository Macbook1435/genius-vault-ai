import test from 'node:test';
import assert from 'node:assert/strict';
import { exactCompsAllowed } from '../api/_lib/catalog-exact-comps-gate.js';

test('unverified identity blocks sold-price estimates',()=> {
 assert.equal(exactCompsAllowed({identityTrusted:false,parallelStatus:'matched'}),false);
});
test('missing exact parallel blocks mixed-card prices',()=> {
 assert.equal(exactCompsAllowed({identityTrusted:true,parallelStatus:'unverified'}),false);
 assert.equal(exactCompsAllowed({identityTrusted:true}),false);
});
test('serial-numbered cards require confirmed serial and matching print run',()=> {
 assert.equal(exactCompsAllowed({identityTrusted:true,parallelStatus:'matched',serialNumbered:true,serialConfirmed:false,printRunMatched:true}),false);
 assert.equal(exactCompsAllowed({identityTrusted:true,parallelStatus:'matched',serialNumbered:true,serialConfirmed:true,printRunMatched:false}),false);
 assert.equal(exactCompsAllowed({identityTrusted:true,parallelStatus:'matched',serialNumbered:true,serialConfirmed:true,printRunMatched:true}),true);
});
test('un-numbered exact parallel may use verified exact comps',()=> {
 assert.equal(exactCompsAllowed({identityTrusted:true,parallelStatus:'matched',serialNumbered:false}),true);
});
