import { cropAndEnlarge } from './copyright-closeup.js';

const schema = { type:'object', additionalProperties:false, properties:{
 stampedSerial:{type:['string','null']}, stampedSerialSide:{type:['string','null'],enum:['front','back',null]},
 stampedSerialAppearance:{type:['string','null']}, isDate:{type:'boolean'} },
 required:['stampedSerial','stampedSerialSide','stampedSerialAppearance','isDate'] };
export function serialValue(text) {
 const m=String(text||'').trim().match(/^(\d+)\s*\/\s*(\d+)$/);
 if(!m) return null;
 const num=Number(m[1]),den=Number(m[2]);
 return num>0 && den>=num ? {num,den,text:m[1]+'/'+m[2]} : null;
}
export function agreeSerialReads(reads) {
 const [a,b]=reads||[],x=serialValue(a?.stampedSerial),y=serialValue(b?.stampedSerial);
 return x && y && !a.isDate && !b.isDate && x.num===y.num && x.den===y.den
  && ['front','back'].includes(a.stampedSerialSide) && a.stampedSerialSide===b.stampedSerialSide
  ? {...x,side:a.stampedSerialSide} : null;
}
// Retry the original photos automatically. No catalog name or print run is supplied to the readers.
export async function readSerialFromPhotos(front,back,askVision,models,crop=cropAndEnlarge) {
 try {
  // Start with only the four enlarged upper corners: most serial stamps are
  // here, and sending ten images to two vision models slows every scan.
  const readRegions=async(regions,name)=>{
   const images=[],labels=[];
   for(const [side,photo] of [['front',front],['back',back]]) {
    if(!photo) continue;
    for(const [label,region] of regions) {
     images.push(await crop(photo,region,{padX:0,padY:0,targetWidth:2048}));
     labels.push(`${images.length}: ${side}, ${label}`);
    }
   }
   if(!images.length) return {status:'no_photo',reads:[],serial:null};
   const prompt=`These are enlarged crops of trading-card photos. Image labels: ${labels.join('; ')}.
Find a physical foil-stamped serial number. Transcribe EACH digit separately, then return the exact number as printed (e.g. 371/375 is NOT 037/375). Inspect the numerator carefully for faint, overlapping, or stylized digits. Never infer digits from the parallel, checklist, card number, or another listing. Dates and copyright text are not serials. If any digit is unclear, return null, not a guess. Report which side shows the stamp.`;
   const read=model=>askVision({model,name,schema,maxTokens:180,frontImage:images[0],extraImages:images.slice(1),prompt}).catch(()=>null);
   const reads=await Promise.all([read(models.fast),read(models.strong)]);
   return {status:'ok',reads,serial:agreeSerialReads(reads)};
  };
  const corners=[['upper left',{x0:0,x1:0.46,y0:0,y1:0.48}],
                 ['upper right',{x0:0.54,x1:1,y0:0,y1:0.48}]];
  const first=await readRegions(corners,'serial_corner_retry');
  if(first.serial || first.status==='no_photo') return first;
  // Only on a miss: inspect the remaining full-width strips, including
  // bottom corners and middle stamps. This avoids a second call on successes.
  const strips=[['top strip',{x0:0,x1:1,y0:0,y1:0.4}],
                ['middle strip',{x0:0,x1:1,y0:0.3,y1:0.7}],
                ['bottom strip',{x0:0,x1:1,y0:0.6,y1:1}]];
  const second=await readRegions(strips,'serial_full_retry');
  return second.serial ? second : {...first,fallback:second};
 } catch(e) {return {status:'error',reads:[],serial:null};}
}
