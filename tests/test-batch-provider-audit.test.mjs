import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const scan = fs.readFileSync(new URL('../api/scan.js',import.meta.url), 'utf8');
const cardsight = fs.readFileSync(new URL('../api/cardsight.js',import.meta.url), 'utf8');
test('automated batch requests are denied before any photo upload is parsed', () => {
  const guard = scan.indexOf('req.headers["x-gv-test-batch"] !== undefined');
  const parse = scan.indexOf('await parseForm(req)');
  assert.ok(guard !== -1 && guard < parse);
  assert.match(scan.slice(guard,parse), /status\(423\)/);
});
test('paid providers have retries and require separate cost controls', () => {
  assert.match(scan,/openai\.chat\.completions\.create\(/);
  assert.match(scan,/for \(let i = 0; i < 2; i\+\+\)/);
  assert.match(cardsight,/fetch\(BASE \+ path/);
  assert.match(cardsight,/response\.status === 429 && attempt < 2/);
});
