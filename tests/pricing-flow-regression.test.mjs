import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const scanner=fs.readFileSync(new URL('../api/scan.js',import.meta.url),'utf8');
test('early broad sold fetch is gated',()=>{
 assert.match(scanner,/earlySoldCompsAllowed\(\{ identityTrusted, card: scanResult/);
});
test('numbered cards cannot fall through to base pricing',()=>{
 assert.match(scanner,/scanResult\.numberedTo && plan\.mode !== "parallel"/);
 assert.match(scanner,/plan\.mode = "blocked";\s*catalog\.parallelComps = \{ mode: "blocked"/);
});
test('catalog load failure cannot authorize base pricing',()=>{
 assert.match(scanner,/plan\.mode === "base" && !Array\.isArray\(list\)/);
});
test('unresolved variation clears sold items and count before response',()=>{
 assert.match(scanner,/if \(variationUnresolved\) \{\s*Object\.assign\(comps, \{ \.\.\.calculateCompStats\(\[\]\), items: \[\], count: 0,/);
 assert.match(scanner,/const soldBlocked = !identityTrusted \|\| variationUnresolved/);
});
test('catalog pricing only called when plan is not blocked',()=>{
 assert.match(scanner,/if \(plan\.mode === "blocked"\) \{[\s\S]*?\} else \{\s*catalogSold = await cardsightSoldComps/);
});
