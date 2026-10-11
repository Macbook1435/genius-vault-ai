// Conservative label extraction from card notes/manufacturer copy.
// These are descriptions for review, never image authentication or grading.
const TYPES=[
 ["jersey_number_patch", /\b(?:jersey\s+number|player\s+number|uniform\s+number|number)\s+patch\b/i],
 ["logo_patch", /\b(?:team\s+logo|logo|shield|crest)\s+(?:patch|relic)\b|\b(?:patch|relic)\s+(?:of\s+)?(?:a\s+)?(?:team\s+)?logo\b/i],
 ["jersey_swatch", /\b(?:jersey|uniform|fabric)\s+(?:swatch|relic|piece)\b|\b(?:swatch|piece)\s+of\s+(?:a\s+)?(?:game\s+)?(?:jersey|uniform)\b/i],
 ["patch", /\b(?:multicolor|multi-color|two-color|three-color|four-color|premium)\s+patch\b|\bpatch\s+card\b/i]
];
const AUTO=/\b(?:autograph(?:ed)?|signed|signature|on-card\s+auto|sticker\s+auto)\b/i;
// A serial stamp ("12/25") or jersey number ("#7") is NOT a number patch.
export function describeMemorabiliaEvidence(notes,card={}) {
 const text=typeof notes==="string"?notes.slice(0,4000):"";
 // Explicit negations take priority over a keyword hit in the same short note.
 const positive=TYPES.filter(([name,re])=>re.test(text) && !(
   name==="jersey_number_patch" && /\\b(?:no|without|not a|isn.t a)\\s+(?:jersey\\s+)?number\\s+patch\\b/i.test(text)
 )).map(([name])=>name);
 const kinds=[...new Set(positive)];
 const autographMention=AUTO.test(text);
 if(kinds.length>1) return {status:"ambiguous",type:null,candidates:kinds,
  autograph:autographMention||card.autograph===true,basis:"Multiple memorabilia types mentioned; review physical card and manufacturer checklist."};
 if(!kinds.length) return {status:"not_identified",type:null,candidates:[],
  autograph:card.autograph===true,basis:"No specific patch type is established by the provided description."};
 const type=kinds[0];
 return {status:"description_only",type,candidates:[type],
  autograph:autographMention||card.autograph===true,
  basis:"Descriptive text suggests this memorabilia type. Verify with the card photo and product checklist; not manufacturer-authenticated."};
}
