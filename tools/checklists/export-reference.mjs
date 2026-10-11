// Audit/export curated reference rows locally. Do not republish commercial checklist
// contents without confirming source permissions. Run:
// node tools/checklists/export-reference.mjs
import fs from "node:fs";
import { catalogCoverage, listReferenceVariants } from "../../api/_lib/catalog-reference.js";

const rows=[];
for (const product of catalogCoverage()) {
 const reference=listReferenceVariants({productId:product.id,limit:1000});
 for (const v of reference.variants) {
  rows.push({
   product_id:v.productId,product:product.label,year:product.year,sport:product.sport,
   subset_id:v.subsetId,subset:v.subsetName,rookie:v.rookie,autograph:v.autograph,
   parallel:v.name,numbered_to:v.numberedTo??"",
   source_status:v.status,source_domains:v.sourceDomains.join("; "),
   source_urls:v.sourceUrls.join("; "),conflict_count:v.unresolvedConflicts.length
  });
 }
 if(reference.total>reference.returned)throw new Error("Truncated product: "+product.id);
}
const columns=["product_id","product","year","sport","subset_id","subset","rookie",
 "autograph","parallel","numbered_to","source_status","source_domains","source_urls","conflict_count"];
function cell(v) {
 let value=String(v??"");
 // The CSV is for auditing; protect spreadsheets from formula execution.
 if(/^\s*[=+\-@\t\r]/.test(value))value="'"+value;
 return '"'+value.replaceAll('"','""')+'"';
}
const csv=[columns.map(cell).join(","),...rows.map(r=>columns.map(c=>cell(r[c])).join(","))].join("\n")+"\n";
const destination=process.argv[2]||"/tmp/genius-vault-checklist-reference.csv";
fs.writeFileSync(destination,csv);
console.log(JSON.stringify({destination,products:catalogCoverage().length,referenceRows:rows.length,
 verifiedRows:rows.filter(x=>x.source_status==="cross_checked_reference").length,
 needsReview:rows.filter(x=>x.source_status!=="cross_checked_reference").length},null,2));
