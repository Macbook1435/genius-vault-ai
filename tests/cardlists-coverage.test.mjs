import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const snapshot = JSON.parse(fs.readFileSync(new URL('../tools/accuracy/cardlists-coverage-snapshot.json', import.meta.url), 'utf8'));

test('CardLists source has known MIT attribution and immutable upstream tree', () => {
  assert.equal(snapshot.license, 'MIT');
  assert.match(snapshot.licenseCopyright, /JunkWaxData/);
  assert.match(snapshot.upstreamTreeSha, /^[a-f0-9]{40}$/);
  assert.match(snapshot.source, /^https:\/\/github\.com\/robert-porter\/CardLists$/);
});

test('CardLists dataset counts are internally consistent', () => {
  assert.equal(Object.values(snapshot.bySport).reduce((a,b) => a + b, 0), snapshot.checklistJsonFiles);
  assert.ok(snapshot.checklistJsonFiles > 0);
  assert.ok(snapshot.footballFiles <= snapshot.checklistJsonFiles);
  assert.ok(snapshot.year2025Files <= snapshot.checklistJsonFiles);
});

test('2025 football imports are blocked pending independently verified coverage', () => {
  assert.equal(snapshot.footballFiles, 0);
  assert.equal(snapshot.year2025Files, 0);
  assert.equal(snapshot.football2025ImportApproved, false);
});
