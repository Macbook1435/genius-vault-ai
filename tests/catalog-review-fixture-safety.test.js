import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reviewPlayerParallel } from '../api/_lib/catalog-parallel-review.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/donruss-optic-rps-review.json', import.meta.url), 'utf8'));

test('third-party review fixture is never authorized for catalog promotion', () => {
 assert.equal(fixture.safe_to_promote, false);
 assert.equal(fixture.source_status, 'published_third_party_pending_independent_review');
 assert.ok(Array.isArray(fixture.cases));
});

test('every review exception identifies a player and card without duplicates', () => {
 const keys = new Set();
 for (const row of fixture.cases) {
  assert.match(row.card_number, /^\d+$/);
  assert.ok(typeof row.player === 'string' && row.player.trim());
  assert.ok(['only','exclude','base_print_run'].includes(row.rule));
  const key = row.card_number + ':' + row.player.toLowerCase();
  assert.equal(keys.has(key), false, 'duplicate review case: ' + key);
  keys.add(key);
 }
});

test('review-only parallel exclusions never claim verification', () => {
 const result = reviewPlayerParallel({player:'Isaac TeSlaa',cardNumber:'219',parallel:'Gold Vinyl'},fixture);
 assert.equal(result.status,'excluded_by_review_fixture');
 assert.notEqual(result.status,'verified');
 assert.equal(result.identity_verified,undefined);
 assert.equal(result.parallel_verified,undefined);
});

test('a review-only candidate is never a verified parallel', () => {
 const result = reviewPlayerParallel({player:'Isaac TeSlaa',cardNumber:'219',parallel:'Purple Stars'},fixture);
 assert.equal(result.status,'candidate_requires_independent_verification');
});
