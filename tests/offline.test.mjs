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


test('reference catalog uses release and subset scope and never fills in invented print runs',async()=>{
 const {catalogCoverage,listReferenceVariants,vocabularyCandidates}=await import('../api/_lib/catalog-reference.js');
 const coverage=catalogCoverage();
 assert.equal(coverage.length,7);
 assert.ok(coverage.every(p=>p.sourceUrls.length>=2 && p.variantRows>0));
 assert.ok(coverage.every(p=>p.crossCheckedRows+p.singleSourceOrUnresolvedRows===p.variantRows));
 const release=coverage.find(p=>p.id==='2025-donruss-optic-football');
 assert.ok(release);
 const optic=listReferenceVariants({productId:release.id,term:'Holo'});
 assert.equal(optic.status,'ok');
 assert.ok(optic.variants.length>0);
 assert.ok(optic.variants.every(x=>x.productId===release.id));
 assert.ok(optic.variants.every(x=>x.sourceUrls.length>=2));
 assert.equal(listReferenceVariants({productId:'not-a-release'}).status,'unknown_product');
 assert.equal(listReferenceVariants({productId:release.id,subsetId:'no-such-subset'}).status,'unknown_subset');
 const candidates=vocabularyCandidates('gold');
 assert.ok(candidates.length>0);
 assert.ok(candidates.every(x=>x.verification==='vocabulary_only'&&x.numberedTo===null));
});

test('catalog reference filters rookie and autograph and excludes source conflicts from verified only',async()=>{
 const {catalogCoverage,listReferenceVariants}=await import('../api/_lib/catalog-reference.js');
 const coverage=catalogCoverage();
 assert.ok(coverage.every(p=>Array.isArray(p.subsetCoverage)));
 const product=coverage.find(p=>p.id==='2025-donruss-optic-football');
 assert.ok(product.rookieSubsetCount>0 && product.autographSubsetCount>0);
 const variants=listReferenceVariants({productId:product.id,autograph:true,verifiedOnly:true});
 assert.equal(variants.status,'ok');
 assert.ok(variants.variants.every(v=>v.autograph===true&&v.crossSourceVerified===true));
 assert.ok(variants.variants.every(v=>v.status==='cross_checked_reference'));
 const rookies=listReferenceVariants({productId:product.id,rookie:true,term:'rookie'});
 assert.ok(rookies.variants.every(v=>v.rookie===true));
});
test('reference catalog narrows numbered variants only inside a selected release',async()=>{
 const {listReferenceVariants}=await import('../api/_lib/catalog-reference.js');
 const r=listReferenceVariants({productId:'2025-topps-resurgence-football',numberedTo:250});
 assert.equal(r.status,'ok');
 assert.ok(r.variants.every(v=>v.numberedTo===250));
 assert.ok(r.variants.every(v=>v.productId==='2025-topps-resurgence-football'));
 assert.ok(r.variants.every(v=>typeof v.autograph==='boolean'&&typeof v.rookie==='boolean'));
});

test('scanner uses only independently cross-checked parallels from the exact subset',async()=>{
 const {scannerChecklistReference}=await import('../api/_lib/checklist-registry.js');
 const fake={id:'2025-fake-chrome',year:2025,brand:'Acme',product:'Chrome',sport:'football',
  match:{include:['chrome'],exclude:[]},subsets:[
   {id:'base',label:'Base',auto:false,rookie:false,numberFormats:[{range:[1,200]}],parallels:[
    {key:'gold',name:'Gold Refractor',numberedTo:50,verified:true,sources:['source-a','source-b']},
    {key:'unverified',name:'Mystery Refractor',numberedTo:75,verified:false,sources:['source-a']},
    {key:'conflict',name:'Aqua Refractor',numberedTo:250,verified:true,sources:['a','b'],conflicts:[{numberedTo:199}]}
   ]},
   {id:'rookieauto',label:'Rookie Autographs',auto:true,rookie:true,numberFormats:[{range:[201,300]}],parallels:[
    {key:'aqua',name:'Aqua Autograph',numberedTo:250,verified:true,sources:['a','b']}
   ]}
  ],sources:['https://example.com/a','https://example.com/b']};
 const rookie=scannerChecklistReference({year:2025,brand:'Acme',set:'Chrome',sport:'football',cardNumber:'220',autograph:true,rookie:true},[fake]);
 assert.equal(rookie.status,'matched');
 assert.equal(rookie.checklist.subsetId,'rookieauto');
 assert.deepEqual(Array.from(rookie.checklist.parallels.map(x=>x.name)),['Aqua Autograph']);
 const base=scannerChecklistReference({year:2025,brand:'Acme',set:'Chrome',sport:'football',cardNumber:'120',autograph:false,rookie:false},[fake]);
 assert.equal(base.status,'matched');
 assert.deepEqual(Array.from(base.checklist.parallels.map(x=>x.name)),['Gold Refractor']);
 const unsupported=scannerChecklistReference({year:2025,brand:'Acme',set:'Chrome',sport:'football',cardNumber:'400',autograph:true,rookie:true},[fake]);
 assert.equal(unsupported.status,'subset_uncertain');
 assert.equal(unsupported.checklist,null);
});

test('accuracy benchmark: unknown autograph and rookie flags do not assume non-autograph base',async()=>{
 const {scannerChecklistReference,findSubset}=await import('../api/_lib/checklist-registry.js');
 const product={id:'2025-demo-chrome',year:2025,sport:'football',brand:'Acme',product:'Chrome',
  match:{include:['chrome'],exclude:[]},
  subsets:[
    {id:'base',label:'Base',auto:false,rookie:false,numberFormats:[{range:[1,100]}],parallels:[{name:'Gold',key:'gold',numberedTo:50,verified:true,sources:['a','b']}]},
    {id:'auto',label:'Rookie Autograph',auto:true,rookie:true,numberFormats:[{range:[1,100]}],parallels:[{name:'Aqua Autograph',key:'aqua autograph',numberedTo:250,verified:true,sources:['a','b']}]}
  ]};
 const id={year:2025,brand:'Acme',set:'Chrome',sport:'football',cardNumber:'42'};
 for(const scan of [
  {...id}, {...id,rookie:true}, {...id,autograph:true},
  {...id,rookie:null,autograph:null}
 ]) {
  const result=scannerChecklistReference(scan,[product]);
  assert.equal(result.status,'subset_uncertain');
  assert.equal(result.checklist,null);
 }
 const auto=scannerChecklistReference({...id,rookie:true,autograph:true},[product]);
 assert.equal(auto.status,'matched');
 assert.equal(auto.checklist.subsetId,'auto');
 assert.deepEqual(Array.from(auto.checklist.parallels.map(x=>x.name)),['Aqua Autograph']);
 const base=scannerChecklistReference({...id,rookie:false,autograph:false},[product]);
 assert.equal(base.status,'matched');
 assert.equal(base.checklist.subsetId,'base');
 const contradictory= findSubset({...product,subsets:[product.subsets[1]]},{cardNumber:'42',autograph:false,rookie:true});
 assert.equal(contradictory.status,'evidence_conflict');
});
test('accuracy benchmark: numbered variation never crosses subset or conflicting source',async()=>{
 const {scannerChecklistReference}=await import('../api/_lib/checklist-registry.js');
 const product={id:'2025-demo-optic',year:2025,sport:'football',brand:'Acme',product:'Optic',match:{include:['optic'],exclude:[]},
  subsets:[
   {id:'base',label:'Base',auto:false,rookie:false,numberFormats:[{range:[1,200]}],
    parallels:[{name:'Blue',key:'blue',numberedTo:250,verified:true,sources:['a','b']}]},
   {id:'rookieauto',label:'Rookie Autograph',auto:true,rookie:true,numberFormats:[{range:[201,300]}],
    parallels:[{name:'Aqua Autograph',key:'aqua auto',numberedTo:250,verified:true,sources:['a','b']},
     {name:'Gold Auto',key:'gold auto',numberedTo:50,verified:true,sources:['a','b'],conflicts:[{numberedTo:25}]}]}
  ]};
 const result=scannerChecklistReference({year:2025,brand:'Acme',set:'Optic',sport:'football',cardNumber:'220',rookie:true,autograph:true},[product]);
 assert.equal(result.status,'matched');
 assert.deepEqual(Array.from(result.checklist.parallels.map(p=>p.name)),['Aqua Autograph']);
});
test('scanner prioritizes subset registry before any generic rainbow',()=>{
 assert.match(scanSource,/scannerChecklistReference\(card\)/);
 assert.match(scanSource,/if \(reference\.productId\) return null/);
});
test('jersey number patch vocabulary distinguishes patch type from serial print run',async()=>{
 const {VARIANT_VOCABULARY,vocabularyCandidates}=await import('../api/_data/variant-vocabulary.js');
 assert.ok(VARIANT_VOCABULARY.categories.includes('jersey_number_patch'));
 assert.ok(VARIANT_VOCABULARY.categories.includes('autograph_number_patch'));
 const patches=vocabularyCandidates('number patch');
 assert.ok(patches.some(p=>p.name==='Number Patch'));
 assert.ok(patches.some(p=>p.name==='Autograph Number Patch'));
 assert.ok(patches.every(p=>p.numberedTo===null&&p.verification==='vocabulary_only'));
});
test('memorabilia audit separates jersey number patch from serial stamp, logos and swatches',async()=>{
 const {describeMemorabiliaEvidence:review}=await import('../api/_lib/memorabilia-evidence.js');
 const number=review('Jersey number patch, autograph',{autograph:true});
 assert.equal(number.type,'jersey_number_patch');
 assert.equal(number.status,'description_only');
 assert.equal(number.autograph,true);
 assert.match(number.basis,/not manufacturer-authenticated/i);
 assert.equal(review('Stamped 12/25, jersey number #7').type,null);
 assert.equal(review('Team logo patch').type,'logo_patch');
 assert.equal(review('Jersey swatch').type,'jersey_swatch');
 assert.equal(review('No number patch on this card').type,null);
 assert.equal(review('Logo patch and jersey swatch').status,'ambiguous');
 assert.equal(review('Rookie patch autograph').type,null);
});
test('scanner response exposes memorabilia description only as uncertain evidence',()=>{
 assert.match(scanSource,/memorabiliaEvidence: describeMemorabiliaEvidence\(scanResult\.notes, scanResult\)/);
});
test('real-card benchmark preserves Mason Graham Optic Preview identity and finish evidence',()=>{
 const fixture=JSON.parse(fs.readFileSync(new URL('../tools/accuracy/fixtures/mason-graham-red-pandora.json',import.meta.url),'utf8'));
 assert.equal(fixture.physicalCard.player,'Mason Graham');
 assert.equal(fixture.physicalCard.cardNumber,'340');
 assert.equal(fixture.physicalCard.subset,'Optic Rated Rookies Preview');
 assert.equal(fixture.physicalCard.parallel,'Red Pandora');
 assert.equal(fixture.regression.wrongCardNumber,'206');
 assert.equal(fixture.regression.requireBackNumber,true);
 assert.ok(fixture.evidence.back.some(x=>x.includes('PRIZM')));
 assert.equal(fixture.physicalCard.printRun,null);
});
test('Mason Graham #340 routes to Donruss Optic Preview and Pandora needs finish evidence',async()=>{
 const {findProduct,findSubset}=await import('../api/_lib/checklist-registry.js');
 const {PRODUCTS}=await import('../api/_data/checklists/index.js');
 const {matchParallel}=await import('../api/_lib/parallel-match.js');
 const card={player:'Mason Graham',year:2025,brand:'Panini',set:'Donruss Optic Rated Rookies Preview',sport:'football',cardNumber:'340',rookie:true,autograph:false};
 const product=findProduct(card,PRODUCTS);
 assert.equal(product.status,'matched');
 assert.equal(product.product.id,'2025-donruss-football');
 const subset=findSubset(product.product,card);
 assert.equal(subset.status,'matched');
 assert.equal(subset.subset.id,'optic_preview_rookie');
 assert.equal(subset.numberFits,true);
 assert.equal(findSubset(product.product,{...card,cardNumber:'206'}).numberFits,false);
 const redOnly=matchParallel(subset.subset.parallels,{numberedTo:null,color:'red',finish:'unknown',baseFinish:'prizm'});
 assert.notEqual(redOnly.status,'confirmed');
 const pandora=matchParallel(subset.subset.parallels,{numberedTo:null,color:'red',finish:'pandora',baseFinish:'prizm'});
 assert.equal(pandora.parallel?.name,'Red Pandora');
 assert.equal(pandora.status,'confirmed');
});


test('separate set and subset text routes Optic Preview to Donruss Football',async()=>{
 const {findProduct,findSubset}=await import('../api/_lib/checklist-registry.js');
 const {PRODUCTS}=await import('../api/_data/checklists/index.js');
 const base={year:2025,brand:'Panini',set:'Donruss Football',subset:'Optic Rated Rookies Preview',sport:'football',cardNumber:'340',rookie:true,autograph:false};
 const found=findProduct(base,PRODUCTS);
 assert.equal(found.status,'matched');
 assert.equal(found.product.id,'2025-donruss-football');
 assert.equal(findSubset(found.product,base).subset.id,'optic_preview_rookie');
 const combined=findProduct({...base,set:'Donruss Optic Rated Rookies Preview',subset:null},PRODUCTS);
 assert.equal(combined.product?.id,'2025-donruss-football');
 const standalone=findProduct({...base,set:'Donruss Optic Football',subset:null,cardNumber:'206'},PRODUCTS);
 assert.equal(standalone.product?.id,'2025-donruss-optic-football');
});

test('special-finish parallels require their observed pattern, not color alone',async()=>{
 const {matchParallel}=await import('../api/_lib/parallel-match.js');
 const cases=[
  ['Red Pandora','red','pandora'],
  ['Gold Cracked Ice','gold','cracked_ice'],
  ['Orange Wave','orange','wave'],
  ['Green Velocity','green','velocity']
 ];
 for(const [name,color,finish] of cases){
  const candidates=[{name,key:name.toLowerCase(),numberedTo:null,verified:true,sources:['a','b']}];
  const colorOnly=matchParallel(candidates,{numberedTo:null,color,finish:'unknown',baseFinish:'prizm'});
  assert.notEqual(colorOnly.status,'confirmed',name+' must not confirm from color alone');
  const patterned=matchParallel(candidates,{numberedTo:null,color,finish,baseFinish:'prizm'});
  assert.equal(patterned.status,'confirmed',name+' should confirm with matching finish evidence');
 }
});


test('gold color and cracked ice pattern are independent parallel attributes',async()=>{
 const {matchParallel}=await import('../api/_lib/parallel-match.js');
 const variants=[
  {name:'Gold',numberedTo:null,verified:true,sources:['a','b']},
  {name:'Cracked Ice',numberedTo:null,verified:true,sources:['a','b']},
  {name:'Gold Cracked Ice',numberedTo:null,verified:true,sources:['a','b']}
 ];
 const gold=matchParallel(variants,{numberedTo:null,color:'gold',finish:'unknown'});
 assert.notEqual(gold.status,'confirmed','Gold color cannot distinguish plain Gold from Gold Cracked Ice');
 const ice=matchParallel(variants,{numberedTo:null,color:null,finish:'cracked_ice'});
 assert.notEqual(ice.status,'confirmed','Cracked Ice pattern without color cannot resolve colored variants');
 const goldIce=matchParallel(variants,{numberedTo:null,color:'gold',finish:'cracked_ice'});
 assert.equal(goldIce.parallel?.name,'Gold Cracked Ice');
 assert.equal(goldIce.status,'confirmed');
 const plainGold=matchParallel([{name:'Gold',numberedTo:null,verified:true,sources:['a','b']}],{numberedTo:null,color:'gold',finish:'plain_refractor'});
 assert.equal(plainGold.status,'confirmed','Plain Gold may confirm with sufficient subset and finish evidence');
 const plainIce=matchParallel([{name:'Cracked Ice',numberedTo:null,verified:true,sources:['a','b']}],{numberedTo:null,color:null,finish:'cracked_ice'});
 assert.equal(plainIce.status,'confirmed','Pattern-only Cracked Ice can be a valid parallel');
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
