// Adapter for sample external card-observation metadata. No network, images, or pricing.
const clean = v => typeof v === 'string' ? v.trim() : '';
const normalized = v => clean(v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const cardNumber = v => clean(String(v ?? '')).replace(/^#\s*/, '').toUpperCase();
const footballText = v => /\bfootball\b|\bnfl\b/i.test(clean(v));
const imageFields = ['frontImage', 'backImage', 'image', 'images', 'imageUrl'];

export function normalizeObservation(record, source = {}) {
 const issues = [];
 if (!record || typeof record !== 'object' || Array.isArray(record))
   return { status:'rejected',issues:['invalid_record'],card:null };
 const year = record.year;
 const player = clean(record.playerName);
 const manufacturer = clean(record.manufacturer);
 const product = clean(record.set);
 const number = cardNumber(record.cardNumber);
 if (!Number.isInteger(year) || year < 1880 || year > 2100) issues.push('invalid_year');
 if (!player) issues.push('missing_player');
 if (!manufacturer) issues.push('missing_manufacturer');
 if (!product) issues.push('missing_product');
 if (!number || number.toLowerCase() === 'unknown') issues.push('missing_card_number');
 const sport = clean(record.sport);
 if (!(footballText(sport) || footballText(product))) issues.push('not_established_football');
 const ocr = record.extractedData && typeof record.extractedData === 'object' ? record.extractedData : {};
 const combinedOcr = [ocr.frontOcrText,ocr.backOcrText].filter(x=>typeof x === 'string').join(' ');
 // OCR disagreement is a warning rather than trusting a third-party AI label.
 const ocrNums = Array.from(combinedOcr.matchAll(/\b(?:No\.?|#)\s*([A-Z0-9-]{1,15})\b/gi), m=>m[1].toUpperCase());
 if (ocrNums.length && number && !ocrNums.includes(number)) issues.push('ocr_card_number_conflict');
 const attributes = Array.isArray(record.attributes) ? record.attributes.filter(x => typeof x === 'string') : [];
 const aiAttrs = Array.isArray(record.aiAttributes) ? record.aiAttributes.filter(x => typeof x === 'string') : [];
 const autoTag = [...attributes,...aiAttrs].some(x=>/\b(auto|autograph|signature)\b/i.test(x));
 if (autoTag && /\b(unsigned|no autograph|not signed|no signature)\b/i.test(clean(record.aiInsight))) issues.push('autograph_evidence_conflict');
 const provenance = {sourceId:clean(source.id)||'unknown',sourceUrl:clean(source.url)||null,licenseReviewed:source.licenseReviewed===true,recordId:clean(String(record.id??''))||null};
 const card = {year, sport:'football', manufacturer,product,player,cardNumber:number,
  team:clean(record.team)||null, attributes, provenance,
  // Parallels and autograph identity cannot be verified from an observation alone.
  parallel:null,autograph:null,verification:'unconfirmed'};
 // No source image paths, OCR dumps, third-party prices or estimates returned.
 if (imageFields.some(f=>Object.hasOwn(record,f))) { /* intentionally ignored */ }
 return {status:issues.length?'quarantined':'candidate_only',issues,card};
}
export function auditObservations(records,source={}) {
 if (!Array.isArray(records)) throw new TypeError('Expected observation array');
 const result={total:records.length,candidateOnly:0,quarantined:0,rejected:0,issues:{}};
 for(const item of records){
  const row=normalizeObservation(item,source);
  if(row.status==='candidate_only')result.candidateOnly++;
  else if(row.status==='quarantined')result.quarantined++;
  else result.rejected++;
  for(const issue of row.issues)result.issues[issue]=(result.issues[issue]||0)+1;
 }
 return result;
}
