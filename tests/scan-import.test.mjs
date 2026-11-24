import test from 'node:test';
import assert from 'node:assert/strict';

// `node --check` only parses scan.js, and offline.test.mjs evaluates extracted
// slices of it in a vm. Neither runs the module's top level, so a stray
// statement (like a bare `async` token) could ship and crash every request with
// a ReferenceError on load. Importing the real module catches that.
test('api/scan.js loads as a module and exports its handler', async () => {
 process.env.OPENAI_API_KEY ||= 'offline-test-placeholder';
 const mod = await import('../api/scan.js');
 assert.equal(typeof mod.default, 'function', 'scan.js must export a default handler');
 assert.equal(typeof mod.config, 'object', 'scan.js must export its Vercel config');
});
