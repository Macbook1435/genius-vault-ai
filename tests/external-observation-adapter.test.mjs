import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeObservation,auditObservations} from '../api/_lib/external-observation-adapter.mjs';
const sample={id:'sample-football-1',playerName:'Puka Nacua',year:2023,manufacturer:'Panini',set:'Prizm Football',cardNumber:'#357',team:'Rams',attributes:['RC'],frontImage:'https://example.test/photo.jpg',extractedData:{backOcrText:'No. 357'}};
test('synthetic football record remains unconfirmed and excludes image URLs',()=>{
 const r=normalizeObservation(sample,{id:'synthetic',licenseReviewed:false});
 assert.equal(r.status,'candidate_only');assert.equal(r.card.cardNumber,'357');
 assert.equal(r.card.verification,'unconfirmed');assert.equal(r.card.parallel,null);
 assert.equal(r.card.autograph,null);assert.equal('frontImage' in r.card,false);
});
test('reject invalid year without auto-correction',()=>{
 const r=normalizeObservation({...sample,year:68});assert.equal(r.status,'quarantined');assert.ok(r.issues.includes('invalid_year'));
});
test('reject conflicting OCR card number rather than silently overwriting',()=>{
 const r=normalizeObservation({...sample,extractedData:{backOcrText:'No. 206'}});
 assert.equal(r.status,'quarantined');assert.ok(r.issues.includes('ocr_card_number_conflict'));
});
test('detect autograph conflicting evidence',()=>{
 const r=normalizeObservation({...sample,attributes:['On-Card Auto'],aiInsight:'Unsigned proof with no signature'});
 assert.equal(r.status,'quarantined');assert.ok(r.issues.includes('autograph_evidence_conflict'));
});
test('non-football records are not silently placed in football catalog',()=>{
 const r=normalizeObservation({...sample,set:'Topps Chrome Baseball'});
 assert.equal(r.status,'quarantined');assert.ok(r.issues.includes('not_established_football'));
});
test('does not ingest market estimates or OCR dumps',()=>{
 const r=normalizeObservation({...sample,estimatedValue:999,extractedData:{frontOcrText:'No. 357'}});
 assert.equal('estimatedValue' in r.card,false);assert.equal('extractedData' in r.card,false);
});
test('audit reports issues without needing images or external API',()=>{
 const r=auditObservations([sample,{...sample,year:68},null]);assert.deepEqual([r.total,r.candidateOnly,r.quarantined,r.rejected],[3,1,1,1]);
});
