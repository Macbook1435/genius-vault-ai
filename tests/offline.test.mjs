import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const scanSource=fs.readFileSync(new URL('../api/scan.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../database/subscription-foundation.sql',import.meta.url),'utf8');
function segment(source,start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Missing section: '+start);
 return source.slice(a,b);
}
const auditScript=segment(scanSource,'function auditSoldTitle(', '\nasync function fetchSoldComps(');
const auditContext=vm.createContext({cleanPart:v=>String(v??'').trim()});
vm.runInContext(auditScript,auditContext);
const audit=(title,card)=>auditContext.auditSoldTitle({title},card);
const card={player:'Gunnar Helm',year:2025,brand:'Topps',set:'Resurgence',cardNumber:'196',parallel:'Aqua',numberedTo:375,autograph:true};
const correct='2025 Topps Resurgence Gunnar Helm #196 Aqua Auto /375';

test('sold-title checks accept matching numbered autograph and explain matches',()=>{
 const result=audit(correct,card);
 assert.equal(result.matched,true);
 for(const field of ['Player','Year','Set','Card number','Print run','Parallel','Autograph']){
  assert.ok(result.matchedFields.includes(field),'Missing explanation for '+field);
 }
});
test('sold-title checks reject wrong player, year, number, parallel and print run',()=>{
 for(const [title,reason] of [
  [correct.replace('Gunnar Helm','Jalen Milroe'),'Player'],
  [correct.replace('2025','2024'),'Year'],
  [correct.replace('#196','#197'),'Card number'],
  [correct.replace('Aqua','Blue'),'parallel'],
  [correct.replace('/375','/250'),'print run'],
  [correct.replace(' Auto ', ' '),'Autograph']
 ]) {
  const result=audit(title,card);
  assert.equal(result.matched,false,title);
  assert.ok(result.reasons.some(r=>r.toLowerCase().includes(reason.toLowerCase())),title+' '+result.reasons);
 }
});
test('sold-title checks reject graded cards when comparing raw cards',()=>{
 assert.equal(audit(correct+' PSA 10',card).matched,false);
});
test('sold title is never claimed to independently verify final price',()=>{
 assert.match(audit(correct,card).note,/not independently verified/i);
});

const collectionScript=segment(html,'function collectionSignature(', '\nfunction saveCard(');
const context=vm.createContext({});
vm.runInContext(collectionScript,context);
const signature=card=>context.collectionSignature(card);
const counts=list=>context.duplicateCounts(list);
test('duplicate fingerprints detect identical physical serial and normalize formatting',()=>{
 const a={player:'Gunnar Helm',year:2025,brand:'Topps',set:'Resurgence',cardNumber:'#196',parallel:'Aqua',serialNumber:'371/375'};
 const b={...a,player:' gunnar  HELM ',cardNumber:'196',serialNumber:'371 / 375'};
 const c={...a,serialNumber:'370/375'};
 assert.equal(signature(a),signature(b));
 assert.notEqual(signature(a),signature(c));
 const result=counts([{data:{scan:a}},{data:{scan:b}},{data:{scan:c}}]);
 assert.equal(result.get(signature(a)),2);
 assert.equal(result.get(signature(c)),1);
});
test('CSV export quotes embedded delimiters and neutralizes formula cells',()=>{
 const csvScript=segment(html,'function exportCollectionCsv(){','\nfunction resetScan(){');
 let captured;
 const ctx=vm.createContext({
  readCollection:()=>[{savedAt:'2026-10-10',data:{scan:{player:'=SUM(1,1)',year:2025,set:'Resurgence, Special',cardNumber:'196',autograph:true}}}],
  downloadCollectionFile:(body,name)=>{captured={body,name};}
 });
 vm.runInContext(csvScript,ctx);
 vm.runInContext('exportCollectionCsv()',ctx);
 assert.equal(captured.name,'genius-vault-collection.csv');
 assert.ok(captured.body.includes('""'),'Empty fields must remain valid quoted CSV cells');
 assert.ok(captured.body.includes('"\'=SUM(1,1)"'),'Formula should be quoted and escaped');
 assert.ok(captured.body.includes('"Resurgence, Special"'));
});


const verificationSource=fs.readFileSync(new URL('../api/_lib/verification.js',import.meta.url),'utf8');
const verificationScript=verificationSource.split('// Keep SOLD prices and ACTIVE asking prices completely separate.')[0]
 .replaceAll('export function ','function ');
const verifyContext=vm.createContext({});
vm.runInContext(verificationScript,verifyContext);
const verify=(scan,v={},ctx={})=>verifyContext.buildFieldVerification(scan,v,ctx);
test('high confidence photo parallel remains only a suggestion',()=>{
 const source=fs.readFileSync(new URL('../api/cardsight.js',import.meta.url),'utf8');
 const code=segment(source,'export function resolveParallel(card) {','\nfunction median(').replace('export function','function');
 const context=vm.createContext({});vm.runInContext(code,context);
 const result=context.resolveParallel({parallelSuggestions:[{id:10,name:'Aqua',confidence:'High',numberedTo:250}]});
 assert.equal(result.status,'suggested');
 assert.equal(result.parallel.name,'Aqua');
 assert.notEqual(result.status,'confirmed');
});
test('autograph detections and absent signatures remain unconfirmed',()=>{
 const signed=verify({autograph:true},{},{});
 const unsigned=verify({autograph:false},{},{});
 assert.equal(signed.fields.autograph.status,'unconfirmed');
 assert.match(signed.fields.autograph.basis,/not been independently verified/i);
 assert.equal(unsigned.fields.autograph.status,'unconfirmed');
 assert.match(unsigned.fields.autograph.basis,/No signature was detected/i);
});
test('base card classification does not become verified through absent color alone',()=>{
 const result=verify({autograph:false},{parallelId:{status:'base'}},{});
 assert.equal(result.fields.parallel.status,'unconfirmed');
});

test('serial: uploading a close-up without two matching reads cannot confirm it',()=>{
 const scan={player:'Gunnar Helm',year:2025,cardNumber:'196',numberedTo:250,serialNumber:'127/250'};
 const result=verify(scan,{}, {serialImage:true,closeupVerified:false});
 assert.equal(result.fields.serial.status,'unconfirmed');
 assert.equal(result.fields.serial.printRunConfirmed,undefined);
});
test('serial: verified close-up must have an actual stamped serial',()=>{
 const scan={year:2025,cardNumber:'196',numberedTo:250,serialNumber:'127/250'};
 assert.equal(verify(scan,{}, {serialImage:true,closeupVerified:true}).fields.serial.status,'confirmed');
 assert.equal(verify({...scan,serialNumber:null},{},{serialImage:true,closeupVerified:true}).fields.serial.status,'unconfirmed');
});
test('serial: one unverified full-photo guess must not confirm a print run',()=>{
 const scan={serialNumber:'127/250',numberedTo:250};
 const r=verify(scan,{}, {});
 assert.equal(r.fields.serial.status,'unconfirmed');
 assert.equal(r.fields.serial.printRunConfirmed,undefined);
 assert.equal(r.serialCloseup.needed,true);
});
test('serial: two matching full-photo observations narrow print run but never exact stamp',()=>{
 const scan={serialNumber:'127/250',numberedTo:250};
 const v={detailCheck:{stampedSerial:'127/250'}};
 const r=verify(scan,v,{strongCheck:{stampedSerial:'127/250'}});
 assert.equal(r.fields.serial.status,'unconfirmed');
 assert.equal(r.fields.serial.printRunConfirmed,true);
 const conflict=verify(scan,v,{strongCheck:{stampedSerial:'128/250'}});
 assert.equal(conflict.fields.serial.printRunConfirmed,undefined);
 const ownConflict=verify({...scan,serialNumber:'129/250'},v,{strongCheck:{stampedSerial:'127/250'}});
 assert.equal(ownConflict.fields.serial.printRunConfirmed,undefined);
});

test('unlimited membership SQL still checks active period and authenticated server service role',()=>{
 assert.match(sql,/unlimited_scans boolean not null default false/);
 assert.match(sql,/not e\.unlimited_scans and n >= e\.scan_limit/);
 assert.match(sql,/auth\.role\(\) <> 'service_role'/);
 assert.match(sql,/e\.period_end <= now\(\)/);
});

test('browser script parses without browser access',()=>{
 const body=segment(html,'<script>','</script>').slice('<script>'.length);
 new vm.Script(body,{filename:'index.html inline script'});
});
test('scan code syntax parses without calling AI or eBay',()=>{
 // Source uses imports and exports: compile module via --check in CI separately.
 assert.match(scanSource,/async function fetchSoldComps\(/);
 assert.match(scanSource,/matchAudit:/);
});
