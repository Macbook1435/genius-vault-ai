import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../api/scan.js',import.meta.url),'utf8');
const start=source.indexOf('function applyCatalogMatch(');
const end=source.indexOf('\nasync function ebayOutsideMatches(',start);
assert.ok(start!==-1&&end>start,'Cannot isolate catalog enrichment');
const context=vm.createContext({
  cardsightConfigured:()=>true,
  normalizeCode:v=>String(v??'').replace(/^#/,'').trim().toUpperCase(),
  cleanPart:v=>String(v??'').trim(),
  sameText:(a,b)=>String(a).toLowerCase()===String(b).toLowerCase(),
  knownBrand:v=>v==='Panini'?'Panini':null,
  resolveParallel:()=>({parallel:null,candidates:[]})
});
vm.runInContext(source.slice(start,end),context);
const scan=(overrides={})=>({player:'Mason Graham',cardNumber:'340',year:2025,set:'Donruss Football Optic Rated Rookies Preview',brand:'Panini',...overrides});
const result=(name='Mason Graham',year=2025,releaseName='2025 Donruss Football',setName='Optic Rated Rookies Preview')=>({detection:{card:{id:'1',name,number:'340',year,releaseName,setName,manufacturer:'Panini'}}});
const apply=(card,candidate)=>{const warnings=[];const outcome=context.applyCatalogMatch(card,candidate,warnings);return {outcome,warnings,card};};

test('reject different first name without rewriting card',()=>{
 const x=apply(scan(),result('Andrew Graham'));
 assert.equal(x.outcome.status,'rejected');
 assert.equal(x.card.player,'Mason Graham');
});
test('reject conflicting catalog year without rewriting card',()=>{
 const x=apply(scan(),result('Mason Graham',2024));
 assert.equal(x.outcome.status,'rejected');
 assert.equal(x.card.year,2025);
});
test('reject non-preview product and preserve observed set',()=>{
 const x=apply(scan(),result('Mason Graham',2025,'2025 Donruss Optic Football','Rated Rookies'));
 assert.equal(x.outcome.status,'rejected');
 assert.equal(x.card.set,'Donruss Football Optic Rated Rookies Preview');
});
test('accept exact product and subset without adding unverifiable parallel',()=>{
 const x=apply(scan(),result());
 assert.equal(x.outcome.status,'accepted');
 assert.equal(x.outcome.parallelSuggestion,undefined);
});
test('report an AI parallel as suggestion only, not verified',()=>{
 const candidate=result();
 candidate.detection.card.parallelSuggestions=[{name:'Aqua',numberedTo:250}];
 const x=apply(scan({numberedTo:250}),candidate);
 assert.equal(x.outcome.status,'accepted');
 assert.equal(x.outcome.parallelSuggestion.name,'Aqua');
 assert.equal(x.card.parallel,undefined);
});
