const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync('index.html','utf8');const script=html.split('<script>')[1].split('</script>')[0];
const elements={};for(const match of html.matchAll(/id="([^"]+)"/g))elements[match[1]]={textContent:'',innerHTML:'',value:'',hidden:false,disabled:false,files:[],addEventListener(){},style:{},select(){},setSelectionRange(){}};
const db={};const ctx={window:{},document:{getElementById(id){assert.ok(elements[id],`missing DOM id: ${id}`);return elements[id]},querySelectorAll(){return []}},localStorage:{getItem:k=>db[k],setItem:(k,v)=>db[k]=v},crypto:require('crypto').webcrypto,Intl,URL,console,setTimeout:()=>1,clearTimeout(){},navigator:{clipboard:{writeText:async()=>{}}}};vm.createContext(ctx);vm.runInContext(script,ctx);
const result={scan:{player:'Example <script>alert(1)</script>',year:2025,brand:'Topps',set:'Chrome',cardNumber:'12',parallel:'Gold',numberedTo:50},verification:{status:'verified'},pipeline:{fields:{year:{status:'confirmed'},set:{status:'confirmed'},parallel:{status:'confirmed'}},unconfirmed:[]},comps:{count:2,min:10,max:20,median:15,items:[{title:'Unsafe <img src=x>',price:15,url:'javascript:alert(1)'}]},soldComps:{query:'Example Chrome Gold'}};
ctx.window.gvLast=result;ctx.renderScan(result);assert.equal(elements.rawValue.textContent,'$15.00');assert.ok(!elements.sales.innerHTML.includes('javascript:'));assert.ok(!elements.sales.innerHTML.includes('<img src=x>'));assert.ok(!elements.output.innerHTML.includes('<script>'));assert.ok(elements.ebaySold.href.includes('LH_Sold=1'));
ctx.saveCard();assert.equal(JSON.parse(db['gv-collection-v3']).length,1);ctx.renderCollection();assert.ok(elements.collectionItems.innerHTML.includes('Example &lt;script&gt;'));
ctx.generateEbay();assert.ok(elements.ebayBox.textContent.includes('Title:'));ctx.generateTikTok();assert.ok(elements.tiktokBox.textContent.includes('#KoollicksVault'));assert.ok(!elements.tiktokBox.textContent.includes('🔥'));
result.pipeline.unconfirmed=['parallel'];ctx.generateEbay();assert.ok(elements.ebayBox.textContent.includes('Listing blocked'));ctx.generateTikTok();assert.ok(elements.tiktokBox.textContent.includes('Confirm'));
result.comps={count:0,items:[]};ctx.renderScan(result);assert.equal(elements.rawValue.textContent,'No sales loaded');assert.equal(elements.gradedValue.textContent,'Not available');
console.log('Frontend checks passed: sold display, unavailable prices, escaping, safe URLs, collection storage, and listing verification gates.');

result.scan.autograph=true;result.pipeline.fields.parallel={value:'Aqua Surge',status:'unconfirmed'};result.scan.parallel=null;ctx.renderScan(result);assert.ok(elements.output.innerHTML.includes('Aqua Surge'));assert.ok(elements.output.innerHTML.includes('Yes — autograph detected'));assert.equal(elements.resultBadge.textContent,'Review card details');

assert.ok(ctx.parallelPickerHtml({parallelPicker:{selectedId:'a',needsPick:false,options:[{id:'a',name:'Aqua Surge',numberedTo:250}]}}).includes('Change parallel (optional)'));
assert.ok(!ctx.parallelPickerHtml({parallelPicker:{needsPick:true,options:[{id:'a',name:'Aqua Surge',numberedTo:250}]}}).includes('<details>'));
ctx.fetch=async()=>({ok:true,json:async()=>({count:0,items:[]})});
result.scan.serialNumber=null;result.scan.numberedTo=null;result.pipeline.fields.serial={value:null,status:'unconfirmed'};
result.parallelPicker={options:[{id:'a',name:'Aqua Surge',numberedTo:250}],cardId:'test'};
elements.parallelPick={value:'a'};elements.parallelPickStatus={textContent:''};
ctx.window.gvLast=result;
(async()=>{await ctx.pickParallel();assert.equal(result.scan.numberedTo,null);assert.equal(result.scan.serialNumber,null);assert.equal(result.pipeline.fields.serial.status,'unconfirmed');console.log('Catalog picker does not invent physical serial or print run.');})().catch(e=>{console.error(e);process.exitCode=1;});
