// Local product-specific reference data. Does not fetch CardSight or call OpenAI.
// Existing product checklist records have heterogeneous source quality; commercial
// re-use/licensing must be reviewed before syndicating third-party data.
import { PRODUCTS } from "../_data/checklists/index.js";
import { vocabularyCandidates } from "../_data/variant-vocabulary.js";

function normalize(value) { return String(value ?? "").toLowerCase().trim().replace(/\s+/g," "); }
export function catalogCoverage(products = PRODUCTS) {
 return products.map(product=>{
  const subsets = product.subsets || [];
  const variants = subsets.flatMap(subset => subset.parallels || []);
  return {
   id:product.id,label:product.label,year:product.year,sport:product.sport,
   subsetCount:subsets.length,variantRows:variants.length,
   crossCheckedRows:variants.filter(v=>v.verified === true).length,
   singleSourceOrUnresolvedRows:variants.filter(v=>v.verified !== true).length,
   conflictRows:variants.filter(v=>Array.isArray(v.conflicts)&&v.conflicts.length).length,
   rookieSubsetCount:subsets.filter(x=>x.rookie===true).length,
   autographSubsetCount:subsets.filter(x=>x.auto===true).length,
   insertSubsetCount:subsets.filter(x=>/insert|rookie|star|future|case hit|short print|ssp/i.test(x.label||"")).length,
   subsetCoverage:subsets.map(x=>({id:x.id,label:x.label,rookie:x.rookie===true,autograph:x.auto===true,
     rows:(x.parallels||[]).length,
     crossChecked:(x.parallels||[]).filter(v=>v.verified===true&&!(v.conflicts||[]).length).length})),
   sourceUrls:product.sources || []
  };
 });
}
// This is a reference lookup scoped to an exact release and optional subset.
// Never label these data as independently verified physical cards.
export function listReferenceVariants({productId, subsetId=null, term="", numberedTo=undefined, rookie=undefined, autograph=undefined, verifiedOnly=false, limit=300}={},products=PRODUCTS) {
 if(!productId || typeof productId !== "string") return {status:"product_required",variants:[]};
 const product=products.find(p=>p.id===productId);
 if(!product)return {status:"unknown_product",variants:[]};
 const subsets=(product.subsets||[]).filter(s=>!subsetId||s.id===subsetId);
 if(subsetId&&!subsets.length)return {status:"unknown_subset",variants:[]};
 const q=normalize(term);
 const matches=subsets.filter(subset=>(rookie===undefined||Boolean(subset.rookie)===rookie)
   &&(autograph===undefined||Boolean(subset.auto)===autograph)).flatMap(subset=>(subset.parallels||[]).map(variant=>({
  productId:product.id,subsetId:subset.id,subsetName:subset.label,
  rookie:subset.rookie===true,autograph:subset.auto===true,
  name:variant.name,numberedTo:Number.isInteger(variant.numberedTo)?variant.numberedTo:null,
  limitKnown:Number.isInteger(variant.numberedTo),
  crossSourceVerified:variant.verified===true && !(variant.conflicts||[]).length,
  sourceDomains:variant.sources||[],
  sourceUrls:product.sources||[],
  unresolvedConflicts:variant.conflicts||[],
  status:(variant.conflicts||[]).length ? "source_conflict" : variant.verified===true ? "cross_checked_reference" : "needs_source_review"
 }))).filter(v=>(!q||normalize(v.name).includes(q)||normalize(v.subsetName).includes(q))
  &&(numberedTo===undefined||v.numberedTo===numberedTo)
  &&(!verifiedOnly||v.crossSourceVerified));
 const cap=Math.min(Math.max(Math.floor(Number(limit)||300),1),1000);
 return {status:"ok",productId,returned:Math.min(matches.length,cap),total:matches.length,
  variants:matches.slice(0,cap)};
}
export { vocabularyCandidates };
