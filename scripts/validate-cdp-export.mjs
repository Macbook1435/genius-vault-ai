// Test-only validator for extracted CDP export and a Genius Vault manifest.
// Usage: node scripts/validate-cdp-export.mjs manifest.json extracted-directory
import fs from 'node:fs';
import path from 'node:path';
const [manifestPath, imageDir] = process.argv.slice(2);
if (!manifestPath || !imageDir) { console.error('Usage: node scripts/validate-cdp-export.mjs manifest.json extracted-directory'); process.exit(2); }
const manifest = JSON.parse(fs.readFileSync(manifestPath,'utf8'));
if (!Array.isArray(manifest.records)) throw Error('Missing records array');
const ids=new Set(), missing=[], duplicates=[], pairs=[];
for(const [i,record] of manifest.records.entries()){
 const id=String(record.copy_id ?? '');
 if(!id || ids.has(id)) duplicates.push({row:i+1,id});
 ids.add(id);
 const obj=record.images ?? record.image_files ?? {};
 const front=obj.front_archive_path ?? obj.front ?? record.front ?? record.front_image;
 const back=obj.back_archive_path ?? obj.back ?? record.back ?? record.back_image;
 for(const [side,name] of Object.entries({front,back})){
  if(typeof name!=='string' || !name || path.basename(name)!==name || !fs.existsSync(path.join(imageDir,name))) missing.push({row:i+1,side,name:name??null});
 }
 pairs.push({copy_id:id,front:front??null,back:back??null});
}
const report={source_batch:manifest.source_batch,records:manifest.records.length,unique_copy_ids:ids.size,expected_images:manifest.records.length*2,missing,duplicate_copy_ids:duplicates,pairs,valid:!missing.length&&!duplicates.length};
console.log(JSON.stringify(report,null,2));
if(!report.valid) process.exitCode=1;
