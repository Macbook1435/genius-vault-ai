import test from 'node:test';
import assert from 'node:assert/strict';
import { rankParallelChoices } from '../api/_lib/catalog-choice-shortlist.js';
test('suggested parallels appear before remaining options',()=>{
 const o=[{id:'base',name:'Base'},{id:'red',name:'Red Pandora'},{id:'blue',name:'Blue'}];
 const r=rankParallelChoices(o,['red']);
 assert.deepEqual(r.topChoices.map(x=>x.id),['red','base','blue']);
 assert.equal(r.verifiedBySelection,false);
});
test('large parallel catalogs display five with full list preserved',()=>{
 const o=Array.from({length:64},(_,i)=>({id:String(i),name:'Parallel '+i}));
 const r=rankParallelChoices(o,['60','61']);
 assert.equal(r.topChoices.length,5);assert.equal(r.allChoices.length,64);assert.equal(r.moreCount,59);
});
test('duplicate IDs are not shown twice',()=>{
 const r=rankParallelChoices([{id:'x',name:'One'},{id:'x',name:'Duplicate'}],['x']);
 assert.equal(r.allChoices.length,1);
});
