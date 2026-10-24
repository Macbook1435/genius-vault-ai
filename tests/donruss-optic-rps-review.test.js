import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Review-only fixture. These rules are not proof of authenticity or authorization
// to promote records into the verified catalog.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/donruss-optic-rps-review.json', import.meta.url), 'utf8'));
const evaluate = (cardNumber, player, parallel) => {
  const cases = fixture.cases.filter(c => c.card_number === String(cardNumber) && c.player.toLowerCase() === player.toLowerCase());
  const restrictions = cases.filter(c => c.rule === 'exclude' || c.rule === 'only');
  if (!restrictions.length) return 'not_verified';
  if (restrictions.some(c => c.rule === 'exclude' && c.values.includes(parallel))) return 'excluded_by_review_fixture';
  if (restrictions.some(c => c.rule === 'only' && !c.values.includes(parallel))) return 'excluded_by_review_fixture';
  return 'candidate_requires_independent_verification';
};
test('fixture remains review-only', () => assert.equal(fixture.safe_to_promote, false));
test('five distinct cases', () => assert.equal(new Set(fixture.cases.map(c => `${c.card_number}:${c.player}`)).size, 5));
test('Matthew Golden Red Stars excluded', () => assert.equal(evaluate(205, 'Matthew Golden', 'Red Stars'), 'excluded_by_review_fixture'));
test('RJ Harvey Red Stars excluded', () => assert.equal(evaluate(208, 'RJ Harvey', 'Red Stars'), 'excluded_by_review_fixture'));
test('Isaac TeSlaa Gold Vinyl excluded', () => assert.equal(evaluate(219, 'Isaac TeSlaa', 'Gold Vinyl'), 'excluded_by_review_fixture'));
test('Isaac TeSlaa Purple Stars candidate only', () => assert.equal(evaluate(219, 'Isaac TeSlaa', 'Purple Stars'), 'candidate_requires_independent_verification'));
test('Elijah Arroyo Black Gold candidate only', () => assert.equal(evaluate(214, 'Elijah Arroyo', 'Black Gold'), 'candidate_requires_independent_verification'));
test('Elijah Arroyo Red Stars excluded', () => assert.equal(evaluate(214, 'Elijah Arroyo', 'Red Stars'), 'excluded_by_review_fixture'));
test('Mason Graham base print run does not verify a parallel', () => assert.equal(evaluate(206, 'Mason Graham', 'Gold Vinyl'), 'not_verified'));
test('unknown player cannot be verified', () => assert.equal(evaluate(999, 'Unknown', 'Purple Stars'), 'not_verified'));
