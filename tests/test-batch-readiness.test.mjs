import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../api/test-batch-preflight.js',import.meta.url),'utf8');
test('TEST readiness checks real project and bearer session',()=>{
 assert.match(src,/upvklqpoekudqifydmwr\.supabase\.co/);
 assert.match(src,/authenticatedUser\(req\)/);
 assert.match(src,/status\(403\)/);
 assert.match(src,/status\(401\)/);
});
test('readiness endpoint never triggers paid calls or enables batch',()=>{
 assert.doesNotMatch(src,/openai|cardsight|reserveScan|fetch\(/i);
 assert.match(src,/batchEnabled: false/);
 assert.match(src,/providerCostCeilingVerified: false/);
});
