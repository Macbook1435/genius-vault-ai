// Read-only catalog coverage API. Deliberately returns release metadata and status
// counts, NOT full third-party checklist contents or protected card databases.
// No API keys, OpenAI calls, or payments.
import { catalogCoverage } from "./_lib/catalog-reference.js";

export default function handler(req,res) {
 res.setHeader("Cache-Control","public, max-age=300");
 if(req.method!=="GET") { res.setHeader("Allow","GET"); return res.status(405).json({error:"Method not allowed"}); }
 const coverage=catalogCoverage().map(({id,label,year,sport,subsetCount,rookieSubsetCount,autographSubsetCount,insertSubsetCount,
  variantRows,crossCheckedRows,singleSourceOrUnresolvedRows,conflictRows,subsetCoverage})=>({
  id,label,year,sport,subsetCount,rookieSubsetCount,autographSubsetCount,insertSubsetCount,
  variantRows,crossCheckedRows,singleSourceOrUnresolvedRows,conflictRows,
  subsets:subsetCoverage.map(({id,label,rookie,autograph,rows,crossChecked})=>({id,label,rookie,autograph,rows,crossChecked}))
 }));
 return res.status(200).json({version:1,scope:"catalog_reference_coverage_only",products:coverage,
  disclaimer:"Coverage metrics are reference records only, not a verified identification of a physical card. Full licensed catalog integration is pending."});
}
