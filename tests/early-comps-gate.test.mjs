import test from 'node:test';
import assert from 'node:assert/strict';
import {earlySoldCompsAllowed} from '../api/_lib/early-comps-gate.mjs';
const card={player:'Mason Graham',parallel:'Red Pandora',numberedTo:null,serialNumber:null};
test('blocked when identity is untrusted',()=>assert.equal(earlySoldCompsAllowed({identityTrusted:false,card,parallelStatus:'confirmed'}),false));
test('blocked for ambiguous or probable parallel',()=>{for(const parallelStatus of ['ambiguous','probable','confirmed_by_tiebreak','suggested',undefined])assert.equal(earlySoldCompsAllowed({identityTrusted:true,card,parallelStatus}),false)});
test('blocked for unknown or base',()=>{for(const parallel of [null,'Base','Unknown','Unconfirmed'])assert.equal(earlySoldCompsAllowed({identityTrusted:true,card:{...card,parallel},parallelStatus:'confirmed'}),false)});
test('numbered autographs never use early broad pricing',()=>assert.equal(earlySoldCompsAllowed({identityTrusted:true,card:{...card,serialNumber:'14/25',numberedTo:25},parallelStatus:'confirmed'}),false));
test('only a confirmed unnumbered named variation may use early search',()=>assert.equal(earlySoldCompsAllowed({identityTrusted:true,card,parallelStatus:'confirmed'}),true));
