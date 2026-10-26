import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeTestBatch } from '../scripts/test-batch-admission.mjs';
const base = {environment:'test',scans:110,approvedMaxScans:110,estimatedUsdPerScan:0.02,approvedUsd:3,authenticated:true,externalServicesBounded:true};
test('accepts valid TEST preflight (not execution permission)',()=>assert.equal(authorizeTestBatch(base).allowed,true));
for (const [label,changes] of [
  ['production',{environment:'production'}],
  ['no auth',{authenticated:false}],
  ['unbounded services',{externalServicesBounded:false}],
  ['too many scans',{scans:111}],
  ['over budget',{approvedUsd:1}],
  ['unknown cost',{estimatedUsdPerScan:0}],
  ['invalid count',{scans:1.5}]
]) test('rejects '+label,()=>assert.equal(authorizeTestBatch({...base,...changes}).allowed,false));
