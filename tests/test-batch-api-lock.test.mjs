import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../api/scan.js',import.meta.url),'utf8');
test('automated batch header is blocked before form parsing and scan reservation',()=>{
  const guard=source.indexOf('req.headers["x-gv-test-batch"] !== undefined');
  const form=source.indexOf('const { files, fields: formFields } = await parseForm(req)');
  const reserve=source.indexOf('await reserveScan(member.id, requestId)');
  const auth=source.indexOf('const member = subscriptionsEnabled()');
  const provider=source.indexOf('!process.env.OPENAI_API_KEY');
  assert.ok(guard>0 && guard<provider && guard<auth && guard<form && form<reserve);
  assert.match(source.slice(guard,form),/status\(423\)/);
});
