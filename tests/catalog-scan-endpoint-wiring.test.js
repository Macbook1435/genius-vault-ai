import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Static regression guard: this test does not make network calls or use scan credits.
const endpoint = readFileSync(new URL('../api/scan.js', import.meta.url), 'utf8');
test('completed scan response passes through fail-closed review decorator', () => {
 assert.match(endpoint, /import\s*\{\s*addParallelReviewToScanResponse\s*\}\s*from\s*["']\.\/_lib\/catalog-scan-response-review\.js["']/);
 assert.match(endpoint, /return res\.status\(200\)\.json\(addParallelReviewToScanResponse\(scanResponse, null, null\)\)/);
});
test('scanner keeps authentication and credit accounting', () => {
 assert.match(endpoint, /authenticatedUser\(req\)/);
 assert.match(endpoint, /reserveScan\(member\.id, requestId\)/);
 assert.match(endpoint, /scanReservation = null; \/\/ A completed result legitimately consumes one scan\./);
 assert.match(endpoint, /releaseScan\(scanReservation\.userId, scanReservation\.requestId\)/);
});
test('completed response retains existing pricing and verification fields', () => {
 assert.match(endpoint, /const scanResponse = \{/);
 for (const field of ['scan: scanResult','verification,','market,','comps: {','soldComps: {']) {
   assert.ok(endpoint.includes(field), 'Missing existing response field: '+field);
 }
});
