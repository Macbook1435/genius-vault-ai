import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSerialCandidates,normalizeCardTokens,rankCardCandidates} from '../lib/card-ocr-evidence.mjs';
test('extracts valid slash stamp as unverified candidate',()=>{const r=parseSerialCandidates('No. 42 05/99');assert.equal(r.length,1);assert.equal(r[0].serial,'5/99');assert.equal(r[0].requires_visual_confirmation,true)});
test('marks pipe separator ambiguous',()=>assert.equal(parseSerialCandidates('05|99')[0].confidence,'ambiguous_separator'));
test('rejects impossible and zero stamps',()=>assert.deepEqual(parseSerialCandidates('100/99 0/10'),[]));
test('does not turn ordinary spaces or letters into separators',()=>assert.deepEqual(parseSerialCandidates('05 99 05I99 05199'),[]));
test('normalizes noisy OCR without inventing text',()=>assert.deepEqual(normalizeCardTokens('prizm RC  Jayden-Daniels'),['PRIZM','RC','JAYDEN','DANIELS']));
test('ranks evidence but never verifies candidate',()=>{const r=rankCardCandidates('2024 PRIZM JAYDEN DANIELS 152',[{manufacturer:'Panini',product_name:'Prizm',player_name:'Jayden Daniels',card_number:'152'}]);assert.equal(r[0].verified,false);assert.equal(r[0].evidence.card_number,true)});
