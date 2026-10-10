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
  const images=[],labels=[];
  for(const [side,photo] of [['front',front],['back',back]]) {
   if(!photo) continue;
   for(const [y0,y1] of [[0,0.4],[0.3,0.7],[0.6,1]]) {
    images.push(await crop(photo,{x0:0,x1:1,y0,y1},{padX:0,padY:0,targetWidth:2048}));
    labels.push(`${images.length}: ${side}, ${Math.round(y0*100)}–${Math.round(y1*100)}% from the top`);
   }
  }
  // Foil serials are frequently tiny in the upper corners (e.g. 371/375).
  // Include focused corner enlargements rather than only full-width strips.
  for(const [side,photo] of [['front',front],['back',back]]) {
   if(!photo) continue;
   for(const [x0,x1] of [[0,0.46],[0.54,1]]) {
    images.push(await crop(photo,{x0,x1,y0:0,y1:0.48},{padX:0,padY:0,targetWidth:2048}));
    labels.push(`${images.length}: ${side}, ${x0===0?'upper left':'upper right'} corner, magnified`);
   }
  }
  if(!images.length) return {status:'no_photo',reads:[],serial:null};
  const prompt=`These images are enlarged overlapping sections of the supplied trading card photos. Image labels: ${labels.join('; ')}.
Find a physical printed or foil-stamped serial such as 033/250, including faint stamps near the edges, corners, or autograph. Copy all digits and preserve leading zeros. Never infer numbering from the color, parallel, checklist, jersey, card number, or another listing. Dates, copyright lines, and seat/row numbers are not serials. Return its side and location/appearance. If digits are unreadable, return null; do not guess.`;
  const read=model=>askVision({model,name:'serial_photo_retry',schema,maxTokens:180,frontImage:images[0],extraImages:images.slice(1),prompt}).catch(()=>null);
  const reads=await Promise.all([read(models.fast),read(models.strong)]);
  return {status:'ok',reads,serial:agreeSerialReads(reads)};
 } catch(e) {return {status:'error',reads:[],serial:null};}
}
