// Evidence-gated subset resolution. OCR/autograph model flags are advisory,
// not proof that a card belongs to the Rated Rookie Autographs subset.
import { opticSubsetCandidates } from './catalog-optic-subset-candidates.js';
const clean=v=>String(v??'').trim().toLowerCase();
export function resolveOpticSubset(scan, evidence) {
 const range=opticSubsetCandidates(scan);
 if(range.status!=='ambiguous_subset'&&range.status!=='unique_range_candidate')
   return {status:'not_verified',subset_id:null,candidates:range.candidates};
 // A caller-supplied status and URL are not independently authenticated.
 // Until trusted ingestion exists, no external evidence can verify a subset.
 const trustedProvenance = false;
 const approved=trustedProvenance && evidence?.verification_status==='verified' &&
   evidence?.source_url?.startsWith('https://') &&
   evidence?.card_number!=null && String(evidence.card_number).replace(/^#/,'')===String(scan?.cardNumber??'').replace(/^#/,'') &&
   clean(evidence.player)===clean(scan?.player) &&
   clean(evidence.product_id)==='2025-donruss-optic-football';
 const matches=range.candidates.filter(c=>c.id===evidence?.subset_id);
 if(!approved||matches.length!==1)return {status:'not_verified',subset_id:null,candidates:range.candidates};
 return {status:'verified_subset',subset_id:matches[0].id,candidates:range.candidates};
}
