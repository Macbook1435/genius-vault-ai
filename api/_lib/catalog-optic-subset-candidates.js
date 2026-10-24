// Conservative subset candidate from reviewed product reference metadata.
// A card number range alone cannot establish whether an autograph is RPS.
import { P_2025_donruss_optic_football as product } from '../_data/checklists/2025-donruss-optic-football.js';
const normalize=v=>String(v??'').trim().toLowerCase();
export function opticSubsetCandidates(scan) {
 const release=[scan?.brand,scan?.set].filter(Boolean).join(' ').toLowerCase();
 if(Number(scan?.year)!==2025||!release.includes('optic')||!release.includes('donruss'))return {status:'unrelated_product',candidates:[]};
 const raw=String(scan?.cardNumber??'').trim().replace(/^#/,'');
 if(!/^\d+$/.test(raw))return {status:'card_number_unconfirmed',candidates:[]};
 const number=Number(raw);
 const candidates=(product.subsets||[]).filter(subset=>(subset.numberFormats||[]).some(f=>Array.isArray(f.range)&&number>=f.range[0]&&number<=f.range[1])).map(s=>({id:s.id,label:s.label,autograph:s.auto===true}));
 return {status:candidates.length===1?'unique_range_candidate':candidates.length?'ambiguous_subset':'no_matching_subset',candidates,verified_subset:false};
}
