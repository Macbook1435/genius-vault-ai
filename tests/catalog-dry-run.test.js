import test from 'node:test';
import assert from 'node:assert/strict';
import handler, {config} from '../api/import/dry-run.js';

const original = {
  SUPABASE_URL:process.env.SUPABASE_URL,
  GV_ENABLE_IMPORT_DRY_RUN:process.env.GV_ENABLE_IMPORT_DRY_RUN,
  GV_IMPORT_ADMIN_KEY:process.env.GV_IMPORT_ADMIN_KEY
};
function response(){
  return {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;return this;},
    status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};
}
function request(method='POST',headers={}){
  return {method,headers,async *[Symbol.asyncIterator](){yield Buffer.from('{}');}};
}
test.after(()=>{
  for(const [key,value] of Object.entries(original)){
    if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
});
test('request parser disabled for bounded streaming',()=>{
  assert.equal(config.api.bodyParser,false);
});
test('rejects all non-POST requests',async()=>{
  const res=response();
  await handler(request('GET'),res);
  assert.equal(res.statusCode,405);
});
test('disabled unless test project and explicit flag configured',async()=>{
  process.env.SUPABASE_URL='https://production-example.supabase.co';
  process.env.GV_ENABLE_IMPORT_DRY_RUN='1';
  process.env.GV_IMPORT_ADMIN_KEY='a'.repeat(40);
  const res=response();
  await handler(request('POST'),res);
  assert.equal(res.statusCode,503);
  assert.equal(res.body.error,'TEST_IMPORT_DISABLED');
});
test('test project rejects missing admin key',async()=>{
  process.env.SUPABASE_URL='https://upvklqpoekudqifydmwr.supabase.co';
  process.env.GV_ENABLE_IMPORT_DRY_RUN='1';
  process.env.GV_IMPORT_ADMIN_KEY='a'.repeat(40);
  const res=response();
  await handler(request('POST'),res);
  assert.equal(res.statusCode,401);
  assert.equal(res.body.error,'UNAUTHORIZED');
});
test('test project rejects wrong admin key',async()=>{
  process.env.SUPABASE_URL='https://upvklqpoekudqifydmwr.supabase.co';
  process.env.GV_ENABLE_IMPORT_DRY_RUN='1';
  process.env.GV_IMPORT_ADMIN_KEY='a'.repeat(40);
  const res=response();
  await handler(request('POST',{'x-gv-import-key':'b'.repeat(40)}),res);
  assert.equal(res.statusCode,401);
});

test('authorized test request returns a read-only review report',async()=>{
  process.env.SUPABASE_URL='https://upvklqpoekudqifydmwr.supabase.co';
  process.env.GV_ENABLE_IMPORT_DRY_RUN='1';
  process.env.GV_IMPORT_ADMIN_KEY='a'.repeat(40);
  const csvText='Maker,Year,Product,Set,Number,Player\nPanini,2025,Absolute,Rookie Force,RF-KWS,Kyle Williams\n';
  const body=JSON.stringify({csvText,columnMapping:{
    manufacturer:'Maker',release_year:'Year',product_name:'Product',
    set_name:'Set',card_number:'Number',player_name:'Player'
  },licenseStatus:'permission_review_pending'});
  const req={method:'POST',headers:{'x-gv-import-key':'a'.repeat(40),'content-type':'application/json'},
    async *[Symbol.asyncIterator](){yield Buffer.from(body);}};
  const res=response();
  await handler(req,res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.mode,'dry_run');
  assert.equal(res.body.database_writes,0);
  assert.equal(res.body.license_verified,false);
  assert.equal(res.body.safe_to_promote,false);
  assert.equal(res.body.summary.parsed,1);
});
test('rejects an oversized payload',async()=>{
  process.env.SUPABASE_URL='https://upvklqpoekudqifydmwr.supabase.co';
  process.env.GV_ENABLE_IMPORT_DRY_RUN='1';
  process.env.GV_IMPORT_ADMIN_KEY='a'.repeat(40);
  const req={method:'POST',headers:{'x-gv-import-key':'a'.repeat(40),'content-type':'application/json'},
    async *[Symbol.asyncIterator](){yield Buffer.alloc(1024*1024+1,65);}};
  const res=response();
  await handler(req,res);
  assert.equal(res.statusCode,413);
});
