// Offline, side-effect-free customer readout for a partial sports-card identification.
// Raw readable facts survive catalog failure; absent data is never invented.
export function partialScanReadout(card={},catalogStatus='no_match') {
 const present=v=>v!==null&&v!==undefined&&String(v).trim()!=='';
 const details={player:present(card.player)?card.player:null,
  team:present(card.team)?card.team:null,
  cardNumber:present(card.cardNumber)?String(card.cardNumber):null,
  autograph:card.autograph===true?true:card.autograph===false?false:null,
  serialNumber:present(card.serialNumber)?String(card.serialNumber):null,
  year:present(card.year)?card.year:null,
  set:present(card.set)?card.set:null,
  parallel:present(card.parallel)&&card.parallelVerified===true?card.parallel:null};
 const incomplete=['no_match','error','rejected','not_configured'].includes(catalogStatus);
 return {status:incomplete?'partially_identified':'needs_verification',
  details,
  exactParallelStatus:details.parallel?'verified':'unconfirmed',
  exactSoldPriceAvailable:!incomplete&&Boolean(details.parallel||(!details.serialNumber&&card.baseVerified===true)),
  message:incomplete?'Catalog match unavailable. Readable card details were preserved; unverified attributes and exact prices must not be guessed.':'Complete remaining verification before claiming an exact match.'};
}
