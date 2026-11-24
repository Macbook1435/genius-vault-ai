// Real Chromium check of the "pick the version" flow (no AI or CardSight calls).
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
const page=await browser.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const BASE='11111111-1111-4111-8111-111111111111', CHROME='22222222-2222-4222-8222-222222222222', ORANGE='33333333-3333-4333-8333-333333333333';
const requested=[];
try{
 await page.route('**/api/parallel-comps**',async route=>{
  const u=new URL(route.request().url());requested.push(u.search);
  if(u.searchParams.get('options')==='1'){
   assert.equal(u.searchParams.get('cardId'),CHROME);
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({cardId:CHROME,options:[{id:'null',name:'Base',numberedTo:null},{id:ORANGE,name:'Orange Refractor',numberedTo:50},{id:'44444444-4444-4444-8444-444444444444',name:'Gold Refractor',numberedTo:25}]})});
  }
  assert.equal(u.searchParams.get('parallelId'),ORANGE);
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({cardId:CHROME,parallelId:ORANGE,parallelName:'Orange Refractor',count:2,min:40,median:45,max:50,mean:45,latestSaleDate:'2025-01-01T00:00:00Z',items:[{title:'2025 Topps Signature Class Chrome Phil Mafah Orange /50 Auto',price:45,date:'2025-01-01',url:'https://www.ebay.com/itm/1'}],source:'cardsight'})});
 });
 await page.goto(origin,{waitUntil:'domcontentloaded'});
 await page.evaluate(([BASE,CHROME])=>{
  const data={scan:{player:'Phil Mafah',year:2025,brand:'Topps',set:null,cardNumber:'188',parallel:null,numberedTo:50,serialNumber:'42/50',autograph:true},
   verification:{status:'verified',warnings:[]},confidence:'high',
   comps:{count:0,items:[],status:'exact_match_unverified',currency:'USD'},soldComps:{query:'2025 Topps Phil Mafah 188',summary:''},
   pipeline:{fields:{},allConfirmed:false},market:{active:{count:0}},parallelPicker:null,
   versionPicker:{reason:'2 versions of this card match the player and number.',candidates:[
    {id:BASE,name:'Phil Mafah',number:'188',release:'Topps Signature Class',set:'Base Set',year:'2025'},
    {id:CHROME,name:'Phil Mafah',number:'188',release:'Topps Signature Class',set:'Chrome',year:'2025'}]}};
  window.gvLast=data;renderScan(data);
 },[BASE,CHROME]);
 await page.waitForSelector('#versionPick');
 const labels=await page.$$eval('#versionPick option',o=>o.map(x=>x.textContent));
 assert.ok(labels.some(l=>l.includes('Topps Signature Class Chrome Phil Mafah #188')),labels.join('|'));
 await page.selectOption('#versionPick',CHROME);
 await page.click('text=USE THIS VERSION');
 await page.waitForSelector('#parallelPick');
 const likely=await page.$$eval('#parallelPick optgroup[label="Most likely"] option',o=>o.map(x=>x.textContent));
 assert.deepEqual(likely,['Orange Refractor /50']);
 // Typing a print run narrows the menu to that run and auto-selects a single hit.
 await page.fill('#parallelRun','25');
 assert.deepEqual(await page.$$eval('#parallelPick option:not([disabled])',o=>o.map(x=>x.textContent)),['Gold Refractor /25']);
 assert.ok((await page.textContent('#parallelRunNote')).includes('Only one /25 version'));
 await page.fill('#parallelRun','');
 assert.ok((await page.$$eval('#parallelPick option',o=>o.length))>=3);
 await page.selectOption('#parallelPick',ORANGE);
 await page.click('text=LOAD SOLD PRICES FOR THIS PARALLEL');
 await page.waitForFunction(()=>window.gvLast?.comps?.count===2);
 assert.equal(await page.evaluate(()=>window.gvLast.comps.median),45);
 // Two sales, newest long ago: the price is flagged as thin data.
 const detail=await page.textContent('#rawDetail');
 assert.ok(/Thin data: only 2 sales found, newest sale \d+ months ago/.test(detail),detail);
 assert.deepEqual(errors,[]);
 console.log('PASS version picker: choose Chrome version, suggested /50 parallel, sold prices loaded.');
}finally{await browser.close();server.close();}
