import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync(new URL('../database/binder-relational-proposal.sql',import.meta.url),'utf8');
test('does not alter existing subscription or scan tables',()=>{
 assert.doesNotMatch(sql,/\b(drop|truncate)\s+table\b/i);
 assert.doesNotMatch(sql,/\b(alter|update|delete from)\s+(table\s+)?public\.gv_(accounts|entitlements|scan_usage)\b/i);
});
test('all binder tables are protected by RLS',()=>{
 for(const table of ['gv_binder_cards','gv_binder_sale_comps'])assert.match(sql,new RegExp('alter table public\\.'+table+' enable row level security','i'));
});
test('sale rows require owner match to binder card',()=>{
 assert.match(sql,/exists \(select 1 from public\.gv_binder_cards b where b\.id=binder_card_id and b\.user_id=auth\.uid\(\)\)/);
});
test('preserves serial validation and exact price evidence',()=>{
 assert.match(sql,/serial_limit >= serial_sequence/);
 assert.match(sql,/verified_final_price boolean not null default false/);
 assert.match(sql,/matched_exact_parallel boolean not null default false/);
});
test('reference tables are read-only to clients by default',()=>{
 for(const table of ['gv_catalog_sources','gv_card_references','gv_reference_variants']) assert.match(sql,new RegExp('alter table public\\.'+table+' enable row level security','i'));
 assert.doesNotMatch(sql,/create policy .* on public\.gv_card_references/i);
});

test('binder variant must belong to the selected card reference',()=>{
 assert.match(sql,/unique \(card_reference_id,id\)/);
 assert.match(sql,/foreign key \(card_reference_id,variant_id\)\s+references public\.gv_reference_variants\(card_reference_id,id\)/);
});
test('serial must either be absent or a complete valid stamp',()=>{
 assert.match(sql,/serial_sequence is null and serial_limit is null/);
 assert.match(sql,/serial_sequence is not null and serial_limit is not null/);
 assert.match(sql,/serial_limit >= serial_sequence/);
});
