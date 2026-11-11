// Real-browser verification contract with mocked comparison sales; zero paid calls.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type',req.url==='/api/public-config'?'application/json':'text/html');
 res.end(req.url==='/api/public-config'?JSON.stringify({enabled:false}):html);
});server.listen(0,'127.0.0.1');await once(server,'listening');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();let apiCalls=0;
 await page.route('**/api/parallel-comps?*',async route=>{apiCalls++;await route.fulfill({contentType:'application/json',body:JSON.stringify({count:0,median:null,referenceSales:{count:1,items:[{title:'Example Blue sale',price:12,url:'https://example.com/sale'}]}})});});
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.evaluate(()=>{
  window.gvLast={scan:{player:'Example',parallel:null},verification:{status:'needs_review'},pipeline:{fields:{parallel:{status:'unconfirmed'}},unconfirmed:['parallel'],allConfirmed:false},
   visualAudit:{issues:[{message:'Recognized player differs from visible text'}]},comps:{count:0,items:[]},soldComps:{query:'Example'},parallelPicker:{cardId:'test',needsPick:true,options:[{id:'blue',name:'Blue'}]}};
  renderScan(window.gvLast);
 });
 await page.locator('#parallelPick').selectOption('blue');await page.getByRole('button',{name:'COMPARE SALES FOR SELECTED VERSION'}).click();
 await page.waitForFunction(()=>Boolean(window.gvLast.selectedVersionSales));
 assert.equal(apiCalls,1);assert.equal(await page.locator('#rawValue').innerText(),'No sales loaded');
 assert.match(await page.locator('#selectedVersionSales').innerText(),/comparison only/);
 assert.match(await page.locator('#visualAuditNotice').innerText(),/differs from visible text/);
 assert.equal(await page.evaluate(()=>window.gvLast.pipeline.fields.parallel.status),'unconfirmed');
 assert.equal(await page.locator('#resultBadge').innerText(),'Review card details');
 console.log('Chromium verification and selected-sales contract passed (mocked providers).');
}finally{await browser.close();server.close();}
