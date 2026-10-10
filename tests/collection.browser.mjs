// Actual Chromium collection-interface tests. No OpenAI credits, Stripe, or Supabase.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const server=createServer((req,res)=>{
 if(req.url==='/api/public-config'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({enabled:false}));return;}
 if(req.url==='/'||req.url==='/index.html'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);return;}
 res.writeHead(404);res.end('Not found');
});
server.listen(0,'127.0.0.1');
await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({acceptDownloads:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));

function entry(id,player,serial,autograph=true){
 return {id,savedAt:'2026-10-10T14:00:00.000Z',data:{
  scan:{player,year:2025,brand:'Topps',set:'Resurgence',cardNumber:'196',parallel:'Aqua',serialNumber:serial,numberedTo:375,autograph},
  verification:{status:'verified'},comps:{count:1,median:15,items:[],currency:'USD'},soldComps:{query:'2025 Topps Resurgence Gunnar Helm'},
  pipeline:{fields:{},allConfirmed:false},market:{active:{count:0}}}};
}
try{
 await page.goto(origin,{waitUntil:'domcontentloaded'});
 // Local listing-photo editor: upload PNG, rotate, zoom and export JPG with no network AI requests.
 const pngBase64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/Zk0AAAAASUVORK5CYII=';
 await page.locator('#listingPhotoFile').setInputFiles({name:'test-card.png',mimeType:'image/png',buffer:Buffer.from(pngBase64,'base64')});
 await page.waitForFunction(()=>!document.getElementById('listingDownload').disabled || document.getElementById('listingPhotoStatus').textContent.includes('Unable'));
 assert.equal(await page.locator('#listingDownload').isDisabled(),false,'Valid image must become downloadable');
 await page.locator('#listingZoom').fill('150');
 await page.getByRole('button',{name:'Rotate 90°'}).click();
 assert.match(await page.locator('#listingPhotoStatus').innerText(),/preview ready/i);
 const [listingDownload]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Export JPG'}).click()]);
 assert.match(listingDownload.suggestedFilename(),/\.jpg$/);
 const jpeg=readFileSync(await listingDownload.path());
 assert.equal(jpeg[0],255);assert.equal(jpeg[1],216);
 await page.getByRole('button',{name:'Reset crop'}).click();
 assert.equal(await page.locator('#listingZoom').inputValue(),'100');
 // Synthetic card against a plain background: auto-frame must find interior edges.
 const synthetic=await page.evaluate(()=>{
  const c=document.createElement('canvas');c.width=320;c.height=400;
  const g=c.getContext('2d');
  g.fillStyle='#eaeaea';g.fillRect(0,0,320,400);
  g.fillStyle='#173252';g.fillRect(80,55,160,260);
  return c.toDataURL('image/png').split(',')[1];
 });
 await page.locator('#listingPhotoFile').setInputFiles({name:'framing-test.png',mimeType:'image/png',buffer:Buffer.from(synthetic,'base64')});
 await page.waitForFunction(()=>!document.getElementById('listingAutoFrame').disabled);
 await page.getByRole('button',{name:'Auto-frame card'}).click();
 assert.equal(await page.evaluate(()=>Boolean(listingFrame)),true,'Card on a plain contrasting surface should auto-frame');
 const frame=await page.evaluate(()=>listingFrame);
 assert.ok(frame.x>40 && frame.x<100 && frame.width>130 && frame.width<210,'Expected conservative interior crop');
 await page.getByRole('button',{name:'Reset crop'}).click();
 await page.locator('#listingFineRotate').fill('7');
 assert.equal(await page.locator('#listingAngleValue').innerText(),'7°');
 assert.equal(await page.evaluate(()=>listingFrame),null,'Reset should restore full original image');
 assert.equal(await page.locator('#listingFineRotate').inputValue(),'0','Reset also clears fine straightening');
 // Scanner failures are tested with mocked responses, never calling the paid AI endpoint.
 let apiRequests=0;
 await page.route('**/api/scan',async route=>{
  apiRequests++;
  await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Provider temporarily unavailable'})});
 });
 await page.locator('#imageUpload').setInputFiles({name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('not an image')});
 await page.locator('#scanButton').click();
 assert.equal(apiRequests,0,'Invalid upload should not reach API');
 assert.equal(await page.locator('#scanButton').isDisabled(),false);
 await page.locator('#imageUpload').setInputFiles({name:'photo.jpg',mimeType:'image/jpeg',buffer:Buffer.from([255,216,255,217])});
 // Mock only local compression to avoid needing a photograph fixture.
 await page.evaluate(()=>{window.compressImage=async()=>new Blob(['jpeg-fixture'],{type:'image/jpeg'});});
 await page.locator('#scanButton').click();
 assert.equal(apiRequests,1);
 await page.waitForFunction(()=>document.getElementById('emptyResult')?.textContent?.includes('temporarily unavailable')); 
 assert.match(await page.locator('#emptyResult').innerText(),/temporarily unavailable/i);
 assert.equal(await page.locator('#scanButton').isDisabled(),false);
 assert.equal(await page.locator('#imageUpload').isDisabled(),false);
 await page.unroute('**/api/scan');
 await page.locator('#imageUpload').setInputFiles([]);
 await page.locator('[data-view="collection"]').click();
 assert.match(await page.locator('#collectionSummary').innerText(),/0 of 0/);
 await page.evaluate((records)=>localStorage.setItem('gv-collection-v3',JSON.stringify(records)),[
  entry('one','Gunnar Helm','371/375'),
  entry('two','Gunnar Helm','371/375'),
  entry('three','Bijan Robinson','12/99',false)
 ]);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('[data-view="collection"]').click();
 assert.match(await page.locator('#collectionSummary').innerText(),/3 of 3/);
 assert.equal(await page.locator('.saved-card').count(),3);
 await page.locator('#collectionSearch').fill('gunnar');
 assert.match(await page.locator('#collectionSummary').innerText(),/2 of 3/);
 await page.locator('#collectionSearch').fill('');
 await page.locator('#collectionFilter').selectOption('duplicates');
 assert.equal(await page.locator('.saved-card').count(),2);
 await page.locator('#collectionFilter').selectOption('autograph');
 assert.equal(await page.locator('.saved-card').count(),2);
 await page.locator('#collectionFilter').selectOption('all');
 await page.locator('[data-edit="one"]').click();
 assert.equal(await page.locator('#collectionEditDialog').evaluate(el=>el.open),true);
 await page.locator('#collectionEditSerial').fill('370/375');
 await page.locator('#collectionEditForm button[type="submit"]').click();
 assert.equal(await page.locator('#collectionEditDialog').evaluate(el=>el.open),false);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('gv-collection-v3')));
 const corrected=saved.find(x=>x.id==='one');
 assert.equal(corrected.data.scan.serialNumber,'370/375');
 assert.equal(corrected.data.comps.count,0);
 assert.equal(corrected.userEdited,true);
 await page.locator('#collectionFilter').selectOption('duplicates');
 assert.equal(await page.locator('.saved-card').count(),0);
 await page.locator('#collectionFilter').selectOption('all');
 const [csv]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Export CSV'}).click()]);
 assert.match(csv.suggestedFilename(),/\.csv$/);
 const csvPath=await csv.path();
 const csvText=readFileSync(csvPath,'utf8');
 assert.match(csvText,/Gunnar Helm/);
 assert.match(csvText,/370\/375/);
 const [json]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:/Export backup/}).click()]);
 const exported=JSON.parse(readFileSync(await json.path(),'utf8'));
 assert.equal(exported.length,3);
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('[data-delete="three"]').click();
 assert.equal(await page.locator('.saved-card').count(),2);
 // Exercise duplicate-save flow without invoking paid scanner API.
 await page.evaluate(()=>{
  window.gvLast=JSON.parse(localStorage.getItem('gv-collection-v3'))[0].data;
  document.getElementById('saveCard').disabled=false;
 });
 page.once('dialog',dialog=>dialog.dismiss());
 await page.evaluate(()=>saveCard());
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gv-collection-v3')).length),2);
 page.once('dialog',dialog=>dialog.accept());
 await page.evaluate(()=>saveCard());
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gv-collection-v3')).length),3);
 // Backup restore: MERGE preserves existing IDs; REPLACE requires explicit second confirmation.
 const beforeRestore=await page.evaluate(()=>JSON.parse(localStorage.getItem('gv-collection-v3')));
 const imported=entry('backup-new','Jahmyr Gibbs','10/35');
 const uploadBackup=async data=>{
  await page.locator('#collectionRestoreFile').setInputFiles({
   name:'genius-vault-collection.json',mimeType:'application/json',buffer:Buffer.from(data)
  });
 };
 page.once('dialog',dialog=>dialog.accept('MERGE'));
 await uploadBackup(JSON.stringify([beforeRestore[0],imported]));
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gv-collection-v3')).length===4);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gv-collection-v3')).length),4);
 assert.equal(await page.locator('.saved-card').count(),4);
 const merged=await page.evaluate(()=>JSON.parse(localStorage.getItem('gv-collection-v3')));
 assert.ok(merged.some(x=>x.id==='backup-new'));
 // A failed or malformed import must not destroy a valid collection.
 await uploadBackup('{not json');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gv-collection-v3')).length),4);
 await uploadBackup(JSON.stringify([{id:'invalid'}]));
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gv-collection-v3')).length),4);
 // Canceling REPLACE at final confirmation must preserve everything.
 const declineReplace=dialog=>dialog.type()==='prompt'?dialog.accept('REPLACE'):dialog.dismiss();
 page.on('dialog',declineReplace);
 await uploadBackup(JSON.stringify([imported]));
 page.off('dialog',declineReplace);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gv-collection-v3')).length),4);
 // Full restore.
 const acceptReplace=dialog=>dialog.type()==='prompt'?dialog.accept('REPLACE'):dialog.accept();
 page.on('dialog',acceptReplace);
 await uploadBackup(JSON.stringify(beforeRestore));
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gv-collection-v3')).length===3);
 page.off('dialog',acceptReplace);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gv-collection-v3')).length),3);
 assert.equal(await page.locator('.saved-card').count(),3);
 // Corrupted local storage must not be overwritten on attempted save.
 await page.evaluate(()=>localStorage.setItem('gv-collection-v3','{broken'));
 await page.evaluate(()=>{window.gvLast={scan:{player:'Test card',year:2025}};saveCard();});
 assert.equal(await page.evaluate(()=>localStorage.getItem('gv-collection-v3')),'{broken');
 await page.evaluate(records=>localStorage.setItem('gv-collection-v3',JSON.stringify(records)),beforeRestore);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('[data-view="collection"]').click();
 assert.equal(await page.locator('.saved-card').count(),3);
 // Simulate narrow phone and tablet viewports in Chromium; test real touch-size controls.
 for(const width of [320,375,390,768]){
  await page.setViewportSize({width,height:812});
  await page.locator('[data-view="collection"]').click();
  const dimensions=await page.evaluate(()=>({
   pageWidth:document.documentElement.scrollWidth,
   viewportWidth:document.documentElement.clientWidth
  }));
  assert.ok(dimensions.pageWidth<=dimensions.viewportWidth+1,
   'Collection overflows viewport at '+width+'px: '+JSON.stringify(dimensions));
  assert.equal(await page.locator('#collectionSearch').isVisible(),true);
  assert.equal(await page.locator('#collectionFilter').isVisible(),true);
  await page.locator('#collectionSearch').fill('bijan');
  assert.match(await page.locator('#collectionSummary').innerText(),/0 of 3|0 of 2/);
  await page.locator('#collectionSearch').fill('');
  const box=await page.locator('#collectionSearch').boundingBox();
  assert.ok(box&&box.width>=180,'Search too narrow on '+width+'px');
 }
 // Touch-capable iPhone-sized browser context (emulation, not physical Safari).
 const phoneContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3,acceptDownloads:true});
 try {
  const phone=await phoneContext.newPage();
  const phoneErrors=[];phone.on('pageerror',e=>phoneErrors.push(e.message));
  await phone.goto(origin,{waitUntil:'domcontentloaded'});
  await phone.evaluate((records)=>localStorage.setItem('gv-collection-v3',JSON.stringify(records)),[
   entry('mobile-one','Gunnar Helm','371/375'),entry('mobile-two','Bijan Robinson','12/99',false)
  ]);
  await phone.reload({waitUntil:'domcontentloaded'});
  await phone.locator('[data-view="collection"]').tap();
  assert.equal(await phone.locator('.saved-card').count(),2);
  await phone.locator('#collectionSearch').fill('bijan');
  assert.equal(await phone.locator('.saved-card').count(),1);
  await phone.locator('#collectionSearch').fill('');
  await phone.locator('#collectionFilter').selectOption('numbered');
  assert.equal(await phone.locator('.saved-card').count(),2);
  await phone.locator('[data-edit="mobile-one"]').tap();
  assert.equal(await phone.locator('#collectionEditDialog').evaluate(el=>el.open),true);
  await phone.locator('#collectionEditSerial').fill('370/375');
  await phone.locator('#collectionEditForm button[type="submit"]').tap();
  assert.equal(await phone.locator('#collectionEditDialog').evaluate(el=>el.open),false);
  assert.equal(await phone.evaluate(()=>JSON.parse(localStorage.getItem('gv-collection-v3'))[0].data.scan.serialNumber),'370/375');
  const mobileWidth=await phone.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
  assert.ok(mobileWidth.scroll<=mobileWidth.client+1,'Mobile touch interface overflows horizontally: '+JSON.stringify(mobileWidth));
  assert.deepEqual(phoneErrors,[]);
  console.log('PASS simulated iPhone touch: navigation, search, filters, edit dialog and save.');
 }finally{await phoneContext.close();}
 assert.deepEqual(errors,[]);
 console.log('PASS Chromium collection UI: search, sorting/filter state, duplicates, edit/invalidate comps, JSON/CSV exports, remove, duplicate save.');
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
