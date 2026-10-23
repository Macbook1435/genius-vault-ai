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
