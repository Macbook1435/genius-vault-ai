// TEST-only OCR routing. Confidence controls next scan action, not card verification.
const normalize = x => typeof x === 'string' ? x.trim() : '';
const numberPattern = /\b(?:NO\.?\s*|#\s*)([A-Z0-9]+(?:-[A-Z0-9]+)*)\b/i;
export function routeOcrScan(results, side='front') {
  if (!['front','back'].includes(side)) throw new TypeError('side must be front or back');
  const items = Array.isArray(results) ? results.filter(r=>r && normalize(r.text)) : [];
  if (!items.length) return {action:'RETRY_SCAN',reason:'no_text',prompt:'No readable text detected. Try another angle with less glare.'};
  const confs = items.map(r=>Number(r.conf)).filter(n=>Number.isFinite(n)&&n>=0&&n<=100);
  const confidence = confs.length===items.length ? Math.round(confs.reduce((a,b)=>a+b,0)/confs.length*10)/10 : null;
  const text=items.map(r=>normalize(r.text)).join(' ');
  if(side==='back'){
    if(confidence===null||confidence<70)return {action:'MANUAL_SEARCH_FALLBACK',confidence,prompt:'Card number OCR confidence is insufficient. Retake the back or enter the printed number.'};
    const match=text.match(numberPattern);
    return match ? {action:'PROCEED_BACK_CANDIDATE',card_number:match[1].toUpperCase(),confidence,verified:false}
      : {action:'MANUAL_SEARCH_FALLBACK',confidence,prompt:'Card number unclear. Retake the back or enter the printed number.'};
  }
  const hasBrand=/\b(PRIZM|OPTIC|BOWMAN|SELECT|MOSAIC|DONRUSS|SCORE|LEAF|WILD\s*CARD|ZENITH|ABSOLUTE|ILLUSIONS|CERTIFIED|PRESTIGE|PHOENIX|ELEMENTS|OBSIDIAN|SPECTRA|CONTENDERS)\b/i.test(text);
  const reliable=items.filter(r=>Number(r.conf)>=75 && normalize(r.text).length>=3);
  if(confidence===null||confidence<70||!hasBrand||reliable.length<2)
    return {action:'REQUEST_FLIP',confidence,reason:'front_evidence_insufficient',prompt:'Please scan the back to capture the card number.'};
  return {action:'PROCEED_FRONT_CANDIDATE',confidence,tokens:reliable.map(r=>normalize(r.text)),verified:false};
}
