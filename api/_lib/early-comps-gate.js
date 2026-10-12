// Pure offline gate for early broad sold-comps requests.
// Early searches can only use unnumbered, explicitly confirmed non-base variants.
// Base / unknown and numbered cards need the later exact catalog verification.
export function earlySoldCompsAllowed({identityTrusted,card,parallelStatus}={}) {
 if(identityTrusted!==true || !card || typeof card!=='object')return false;
 if(card.numberedTo || card.serialNumber)return false;
 const name=String(card.parallel??'').trim();
 if(!name || /^(base|none|unknown|unconfirmed|null)$/i.test(name))return false;
 return parallelStatus==='confirmed';
}
