// TEST-only frame quality decisions and duplicate hints. Never reuse identification from a visual hash.
export function evaluateFrameQuality({cornerCoverage,sharpness,glareFraction,thresholds={}}={}) {
  const minCoverage=thresholds.minCoverage??0.75, minSharpness=thresholds.minSharpness??100, maxGlare=thresholds.maxGlare??0.08;
  const thresholdValid=Number.isFinite(minCoverage)&&minCoverage>=0&&minCoverage<=1&&Number.isFinite(minSharpness)&&minSharpness>0&&Number.isFinite(maxGlare)&&maxGlare>=0&&maxGlare<=1;
  if(!thresholdValid)return {status:'unknown',captureReady:false,reasons:['invalid_thresholds']};
  const valid=[cornerCoverage,sharpness,glareFraction].every(v=>typeof v==='number'&&Number.isFinite(v))&&cornerCoverage>=0&&cornerCoverage<=1&&sharpness>=0&&glareFraction>=0&&glareFraction<=1;
  if(!valid)return {status:'unknown',captureReady:false,reasons:['measurements_missing']};
  const reasons=[];
  if(cornerCoverage<minCoverage)reasons.push('move_card_into_frame');
  if(sharpness<minSharpness)reasons.push('hold_steady_focus');
  if(glareFraction>maxGlare)reasons.push('reduce_glare');
  return {status:reasons.length?'retry':'candidate_ready',captureReady:reasons.length===0,reasons,
    thresholds_are_unvalidated:true};
}
export function captureDecision(frames,thresholds) {
  if(!Array.isArray(frames)||frames.length<3)return {capture:false,reason:'need_three_frames'};
  const last=frames.slice(-3).map(f=>evaluateFrameQuality({...f,thresholds}));
  return {capture:last.every(f=>f.captureReady),reason:last.every(f=>f.captureReady)?'quality_candidate':'quality_gate_failed'};
}
export function hammingDistance64(a,b){
  const toHash=x=>{if(typeof x!=='string'||!/^[a-f0-9]{16}$/i.test(x))throw new TypeError('expected 16-character hex dHash');return BigInt('0x'+x)};
  let n=toHash(a)^toHash(b),bits=0;
  while(n){bits+=Number(n&1n);n>>=1n}
  return bits;
}
export function possibleDuplicateScans(scan,prior,{maxDistance=5}={}) {
  if(!Array.isArray(prior))throw new TypeError('prior scans must be array');
  if(!scan||typeof scan.dhash!=='string'||typeof scan.user_scope!=='string'||!scan.user_scope.trim()||!['front','back'].includes(scan.side))return [];
  if(!Number.isInteger(maxDistance)||maxDistance<0||maxDistance>64)throw new RangeError('invalid maxDistance');
  return prior.filter(p=>p&&p.side===scan.side&&typeof p.user_scope==='string'&&p.user_scope===scan.user_scope&&p.dhash
    &&hammingDistance64(scan.dhash,p.dhash)<=maxDistance)
    .map(p=>({scan_id:p.scan_id,action:'compare_images_and_ocr',reuse_card_identity:false,reuse_price:false}));
}
