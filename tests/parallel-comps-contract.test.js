import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const endpoint=readFileSync(new URL('../api/parallel-comps.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export default async function handler','async function handler');
const cardId='11111111-1111-1111-1111-111111111111',parallelId='22222222-2222-2222-2222-222222222222';
function response(){return {status(code){this.code=code;return this},json(body){this.body=body;return this}}}
test('selected version endpoint never supplies verified stats, including Base; rejects wrong-card parallel and unsigned caller',async()=>{
 let calls=0,authRequired=false;
 const context=vm.createContext({console,cardsightConfigured:()=>true,subscriptionsEnabled:()=>authRequired,authenticatedUser:async()=>null,
 cardsightCardInfo:async()=>({parallels:[{id:parallelId,name:'Blue'}]}),
 cardsightSoldComps:async()=>{calls++;return {count:2,median:500,min:400,max:600,mean:500,items:[{title:'Example Blue sale',price:400}]}}});
 vm.runInContext(endpoint,context);
 for(const selected of [parallelId,'null']){
  const r=response();await context.handler({method:'GET',query:{cardId,parallelId:selected}},r);
  assert.equal(r.code,200);for(const key of ['min','max','median','mean'])assert.equal(r.body[key],null);
  assert.equal(r.body.count,0);assert.equal(r.body.items.length,0);assert.equal(r.body.verified,false);assert.equal(r.body.referenceSales.count,2);assert.equal(r.body.approvalAllowed,false);
 }
 let r=response();await context.handler({method:'GET',query:{cardId,parallelId:'33333333-3333-3333-3333-333333333333'}},r);assert.equal(r.code,400);assert.equal(calls,2);
 authRequired=true;r=response();await context.handler({method:'GET',query:{cardId,parallelId}},r);assert.equal(r.code,401);assert.equal(calls,2);
});
