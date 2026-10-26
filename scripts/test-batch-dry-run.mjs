// Offline-only manifest validator for the 110-card regression.
// Deliberately no network imports, credentials, or scan execution.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function validateBatchManifest(manifest, expectedCount = 110) {
  const errors = [];
  if (!Array.isArray(manifest?.pairs)) {
    return { ready: false, count: 0, errors: ['Manifest must contain a pairs array'], paidCalls: 0 };
  }
  const ids = new Set();
  const files = new Set();
  for (const [index, pair] of manifest.pairs.entries()) {
    const id = String(pair?.imageId ?? '').trim();
    if (!id) errors.push(`Pair ${index + 1}: missing imageId`);
    else if (ids.has(id)) errors.push(`Pair ${index + 1}: duplicate imageId ${id}`);
    ids.add(id);
    for (const side of ['front', 'back']) {
      const path = pair?.[side];
      if (typeof path !== 'string' || !/\.(jpe?g|png|webp)$/i.test(path)) {
        errors.push(`Pair ${index + 1}: invalid ${side} filename`);
        continue;
      }
      if (path.startsWith('/') || path.includes('..') || path.includes('\\')) {
        errors.push(`Pair ${index + 1}: unsafe ${side} filename`);
      }
      if (files.has(path)) errors.push(`Pair ${index + 1}: reused image file ${path}`);
      files.add(path);
    }
    if (pair?.front === pair?.back) errors.push(`Pair ${index + 1}: front and back are identical`);
  }
  if (manifest.pairs.length !== expectedCount) errors.push(`Expected ${expectedCount} pairs; found ${manifest.pairs.length}`);
  return { ready: errors.length === 0, count: manifest.pairs.length, errors, paidCalls: 0, scanExecutionEnabled: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const filename = process.argv[2];
  if (!filename) {
    process.stderr.write('Usage: node scripts/test-batch-dry-run.mjs <normalized-manifest.json>\n');
    process.exitCode = 2;
  } else {
    try {
      const result = validateBatchManifest(JSON.parse(readFileSync(filename, 'utf8')));
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      if (!result.ready) process.exitCode = 1;
    } catch (error) {
      process.stderr.write('Invalid manifest: ' + error.message + '\n');
      process.exitCode = 1;
    }
  }
}
