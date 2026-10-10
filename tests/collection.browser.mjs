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
 await page.locator('#saveCard').click();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gv-collection-v3')).length),2);
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#saveCard').click();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gv-collection-v3')).length),3);
 assert.deepEqual(errors,[]);
 console.log('PASS Chromium collection UI: search, sorting/filter state, duplicates, edit/invalidate comps, JSON/CSV exports, remove, duplicate save.');
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
