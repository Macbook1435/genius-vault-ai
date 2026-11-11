const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('picker and dashboard keep user choice separate from verification and value',async()=>{
 const html=fs.readFileSync('index.html','utf8'),elements={};
 for(const m of html.matchAll(/id="([^"]+)"/g))elements[m[1]]={textContent:'',innerHTML:'',value:'',hidden:false,disabled:false,files:[],addEventListener(){},style:{}};
 const ctx={window:{},document:{getElementById:id=>elements[id],querySelectorAll:()=>[]},localStorage:{getItem:()=>null,setItem(){}},Intl,URL,console,setTimeout:()=>1,clearTimeout(){},navigator:{}};
 vm.createContext(ctx);vm.runInContext(html.split('<script>')[1].split('</script>')[0],ctx);
 const result={scan:{player:'Example',parallel:null,numberedTo:null,serialNumber:null},verification:{status:'needs_review'},
 pipeline:{fields:{parallel:{status:'unconfirmed'},serial:{status:'unconfirmed'}},unconfirmed:['parallel','serial'],allConfirmed:false},
 visualAudit:{issues:[{message:'Reference player differs from scan'}]},comps:{count:0,items:[]},market:{sold:{count:0,median:null}},soldComps:{summary:'No verified sold-price estimate.'},
 parallelPicker:{cardId:'test',options:[{id:'a',name:'Blue',numberedTo:99}]}};
 assert.match(ctx.parallelPickerHtml(result),/<option value="a"/);
 ctx.window.gvLast=result;
 ctx.fetch=async()=>({ok:true,json:async()=>({count:400,median:500,referenceSales:{count:1,items:[{title:'<img src=x>',price:12,url:'javascript:alert(1)'}]}})});
 elements.parallelPick={value:'a'};elements.parallelPickStatus={textContent:''};
 await ctx.pickParallel();
 assert.equal(result.pipeline.fields.parallel.status,'unconfirmed');assert.equal(result.pipeline.allConfirmed,false);assert.ok(result.pipeline.unconfirmed.includes('parallel'));
 assert.equal(result.scan.numberedTo,null);assert.equal(result.scan.serialNumber,null);assert.equal(result.pipeline.fields.serial.status,'unconfirmed');
 assert.equal(result.comps.count,0);assert.equal(result.comps.median,null);assert.equal(result.market.sold.median,null);assert.equal(elements.rawValue.textContent,'No sales loaded');
 assert.match(elements.visualAuditNotice.textContent,/Reference player/);assert.equal(elements.visualAuditNotice.hidden,false);
 assert.match(elements.selectedVersionSales.innerHTML,/comparison only/);assert.ok(!elements.selectedVersionSales.innerHTML.includes('javascript:'));assert.ok(!elements.selectedVersionSales.innerHTML.includes('<img src=x>'));
 assert.equal(elements.resultBadge.textContent,'Review card details');
});

test('loading a historical confirmed result cannot restore a verified price or listing eligibility',()=>{
 const html=fs.readFileSync('index.html','utf8'),elements={};
 for(const m of html.matchAll(/id="([^"]+)"/g))elements[m[1]]={textContent:'',innerHTML:'',value:'',files:[],addEventListener(){},style:{}};
 const ctx={window:{},document:{getElementById:id=>elements[id],querySelectorAll:()=>[]},localStorage:{getItem:()=>null},Intl,URL,console,setTimeout:()=>1,navigator:{}};
 vm.createContext(ctx);vm.runInContext(html.split('<script>')[1].split('</script>')[0],ctx);
 const data={scan:{player:'Historical'},verification:{status:'verified'},pipeline:{fields:{parallel:{status:'confirmed'}},unconfirmed:[],allConfirmed:true},comps:{count:2,median:500,items:[]}};
 ctx.renderScan(data);assert.equal(data.pipeline.fields.parallel.status,'unconfirmed');assert.equal(data.pipeline.allConfirmed,false);assert.equal(data.comps.median,null);assert.equal(data.verification.status,'needs_review');
});
