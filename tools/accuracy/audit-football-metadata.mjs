// Offline audit of externally acquired metadata. No network, downloads, or images.
import fs from 'node:fs';
import {normalizeObservation} from '../../api/_lib/external-observation-adapter.mjs';

export function extractRecords(payload) {
 if (Array.isArray(payload)) return payload;
 if (payload && typeof payload === 'object') {
  for (const key of ['cards','records','data','items']) if (Array.isArray(payload[key])) return payload[key];
 }
 throw new TypeError('Expected array or object containing cards/records/data/items array');
}
export function auditFootballMetadata(payload) {
 const records = extractRecords(payload);
 const result={declaredTotalCards:Number.isInteger(payload?.totalCards)?payload.totalCards:null,
  totalRecords:records.length,footballCandidates:0,otherOrUnknown:0,
  validIdentityCandidates:0,quarantinedFootball:0,duplicateIdentityKeys:0,
  unresolvedParallels:0,verifiedParallels:0,issueCounts:{},byYear:{}};
 const seen=new Set();
 for(const record of records) {
  const football=record && typeof record==='object' &&
   (/\b(football|nfl)\b/i.test(String(record.sport??'')) || /\b(football|nfl)\b/i.test(String(record.set??'')));
  if(!football) {result.otherOrUnknown++;continue;}
  result.footballCandidates++;
  const audit=normalizeObservation(record,{id:'GotThatData',licenseReviewed:false});
  if(audit.status==='candidate_only') result.validIdentityCandidates++;
  else result.quarantinedFootball++;
  for(const issue of audit.issues)result.issueCounts[issue]=(result.issueCounts[issue]||0)+1;
  const y=String(record.year??'unknown');result.byYear[y]=(result.byYear[y]||0)+1;
  if(audit.card){
   const c=audit.card;
   const k=[c.year,c.manufacturer,c.product,c.player,c.cardNumber].map(v=>String(v??'').toLowerCase().trim()).join('|');
   if(seen.has(k))result.duplicateIdentityKeys++; else seen.add(k);
  }
  // No external card observations can certify a parallel: record all as unresolved.
  result.unresolvedParallels++;
 }
 if(result.declaredTotalCards!==null && result.declaredTotalCards!==result.totalRecords)
  result.issueCounts.declared_total_mismatch=1;
 return result;
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href){
 const file=process.argv[2];
 if(!file){console.error('Usage: node tools/accuracy/audit-football-metadata.mjs <local-metadata.json>');process.exitCode=2;}
 else {
  try {const json=JSON.parse(fs.readFileSync(file,'utf8'));
   process.stdout.write(JSON.stringify(auditFootballMetadata(json),null,2)+'\n');
  } catch(e){console.error('Audit failed:',e.message);process.exitCode=1;}
 }
}
