import test from 'node:test';
import assert from 'node:assert/strict';
import {auditFootballMetadata,extractRecords} from '../tools/accuracy/audit-football-metadata.mjs';
const football={year:2023,playerName:'Sample Player',manufacturer:'Panini',set:'Prizm Football',cardNumber:'100'};
test('accepts reported JSON cards collection',()=>{
 assert.equal(extractRecords({totalCards:1,cards:[football]}).length,1);
});
test('does not count baseball as football',()=>{
 const r=auditFootballMetadata({totalCards:2,cards:[football,{...football,set:'Topps Chrome Baseball'}]});
 assert.equal(r.footballCandidates,1);assert.equal(r.otherOrUnknown,1);
 assert.equal(r.verifiedParallels,0);assert.equal(r.unresolvedParallels,1);
});
test('flags invalid football years and duplicates',()=>{
 const r=auditFootballMetadata({cards:[football,{...football},{...football,year:68}]});
 assert.equal(r.footballCandidates,3);assert.equal(r.duplicateIdentityKeys,1);
 assert.equal(r.issueCounts.invalid_year,1);
});
test('discloses inaccurate total without silently trusting it',()=>{
 const r=auditFootballMetadata({totalCards:1473,cards:[football]});
 assert.equal(r.totalRecords,1);assert.equal(r.issueCounts.declared_total_mismatch,1);
});
test('refuses unrecognized dataset shape',()=>{
 assert.throws(()=>extractRecords({totalCards:1473}),TypeError);
});
test('all third-party parallel claims remain unresolved',()=>{
 const r=auditFootballMetadata({cards:[{...football,attributes:['Gold /10'],frontImage:'sensitive'}]});
 assert.equal(r.verifiedParallels,0);assert.equal(r.unresolvedParallels,1);
});
