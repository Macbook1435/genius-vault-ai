import test from 'node:test';
import assert from 'node:assert/strict';
import {routeOcrScan} from '../lib/ocr-fallback-router.mjs';
test('empty OCR asks for retry',()=>assert.equal(routeOcrScan([]).action,'RETRY_SCAN'));
test('glared front requests back',()=>assert.equal(routeOcrScan([{text:'PRIZM',conf:91},{text:'WSH',conf:62},{text:'D4N13LS',conf:41.5}]).action,'REQUEST_FLIP'));
test('high-confidence front remains unverified candidate',()=>{const r=routeOcrScan([{text:'PRIZM',conf:92},{text:'DANIELS',conf:90}]);assert.equal(r.action,'PROCEED_FRONT_CANDIDATE');assert.equal(r.verified,false)});
test('front without brand requests back',()=>assert.equal(routeOcrScan([{text:'DANIELS',conf:95},{text:'WASHINGTON',conf:95}]).action,'REQUEST_FLIP'));
test('back card number is candidate only',()=>{const r=routeOcrScan([{text:'No. RR-12',conf:94}],'back');assert.equal(r.card_number,'RR-12');assert.equal(r.verified,false)});
test('back without number asks for manual search',()=>assert.equal(routeOcrScan([{text:'copyright',conf:99}],'back').action,'MANUAL_SEARCH_FALLBACK'));
test('invalid side fails closed',()=>assert.throws(()=>routeOcrScan([],'sideways'),TypeError));
test('invalid confidence never advances front',()=>assert.equal(routeOcrScan([{text:'PRIZM',conf:120},{text:'DANIELS',conf:90}]).action,'REQUEST_FLIP'));

test('low confidence back OCR cannot suggest a number',()=>assert.equal(routeOcrScan([{text:'No. RR-12',conf:25}],'back').action,'MANUAL_SEARCH_FALLBACK'));
test('missing confidence back OCR cannot suggest a number',()=>assert.equal(routeOcrScan([{text:'No. RR-12'}],'back').action,'MANUAL_SEARCH_FALLBACK'));
