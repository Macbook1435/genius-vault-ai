import test from 'node:test';
import assert from 'node:assert/strict';
import {pickParallel} from '../api/cardsight.js';
test('numbered parallel rejects missing print run',()=>{
 const options=[{id:'unknown',name:'Aqua Autograph',numberedTo:null},{id:'right',name:'Aqua Autograph',numberedTo:250}];
 const r=pickParallel(options,{name:'Aqua Autograph',numberedTo:250,cardId:'card-1'});
 assert.equal(r.status,'matched');assert.equal(r.parallel.id,'right');
});
test('wrong print run cannot match',()=>{
 const r=pickParallel([{id:'wrong',name:'Aqua Autograph',numberedTo:199}],{name:'Aqua Autograph',numberedTo:250});
 assert.notEqual(r.status,'matched');
});
test('ambiguity must not promote to matched',()=>{
 const r=pickParallel([{id:'a',name:'Aqua Autograph',numberedTo:250},{id:'b',name:'Aqua Autograph',numberedTo:250}],{name:'Aqua Autograph',numberedTo:250});
 assert.equal(r.status,'ambiguous');
});
