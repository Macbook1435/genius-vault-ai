import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateFrameQuality,captureDecision,hammingDistance64,possibleDuplicateScans} from '../lib/scan-quality-cache-hints.mjs';
test('missing measurements never allow capture',()=>assert.equal(evaluateFrameQuality({}).captureReady,false));
test('rejects blurry, glared, and poorly framed candidates',()=>assert.deepEqual(evaluateFrameQuality({cornerCoverage:.5,sharpness:50,glareFraction:.2}).reasons,['move_card_into_frame','hold_steady_focus','reduce_glare']));
test('three consecutive acceptable frames required',()=>{const good={cornerCoverage:.9,sharpness:150,glareFraction:.02};assert.equal(captureDecision([good,good]).capture,false);assert.equal(captureDecision([good,good,good]).capture,true)});
test('hamming distance counts bits',()=>assert.equal(hammingDistance64('0000000000000000','000000000000000f'),4));
test('duplicate hint never reuses identity or price',()=>{const hints=possibleDuplicateScans({dhash:'0000000000000000',side:'front',user_scope:'u1'},[{dhash:'0000000000000001',side:'front',user_scope:'u1',scan_id:'s1'}]);assert.equal(hints[0].reuse_card_identity,false);assert.equal(hints[0].reuse_price,false)});
test('duplicate hints are scoped by side and user',()=>assert.equal(possibleDuplicateScans({dhash:'0000000000000000',side:'front',user_scope:'u1'},[{dhash:'0000000000000000',side:'back',user_scope:'u2'}]).length,0));
