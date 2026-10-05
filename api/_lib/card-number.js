// Generic card-number cleanup and agreement across independent reads.
// Nothing here knows about any specific card or player.

const DASHES = /[\u2010-\u2015\u2212_~]/g; // ‐ ‑ ‒ – — ― − _ ~
// Label text before the number. Needs a separator so real prefixes ("NOV-3", "IDA-5") survive.
const LABEL = /^(?:CARD\s*(?:NO\.?|NUMBER|#)\s*|NO\.\s*|NO\s+|NUMBER\s+|NUM\s+|ID\s*#\s*|ID:\s*|ID\s+|#\s*)/;

// Characters a camera/OCR read commonly confuses. Each group maps to one class.
const LOOK_ALIKE_CLASS = { O: "0", D: "0", Q: "0", I: "1", L: "1", S: "5", B: "8", Z: "2", G: "6" };

/** Uppercase, drop labels ("#", "No.", "Card", "ID#"), unify dashes, remove stray spaces/punctuation. */
export function cleanCardNumber(raw) {
  if (raw === null || raw === undefined) return null;
  let t = String(raw).toUpperCase().trim().replace(DASHES, "-");
  for (let i = 0; i < 3; i++) t = t.replace(LABEL, "").trim();
  t = t.replace(/\s*-\s*/g, "-").replace(/\s+/g, "").replace(/[^A-Z0-9-]/g, "").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
  return t || null;
}

/** Comparison key: cleaned, without dashes. */
export function compactKey(v) {
  const c = cleanCardNumber(v);
  return c ? c.replace(/-/g, "") : null;
}

/** Key that treats look-alike characters as the same (S≈5, I≈1≈L, O≈0≈D, B≈8, Z≈2, G≈6). */
export function lookAlikeKey(v) {
  const k = compactKey(v);
  return k ? [...k].map((c) => LOOK_ALIKE_CLASS[c] || c).join("") : null;
}

// A dash-separated part that is all letters or all digits ("ITS", "102") is how card
// codes are printed; a part mixing them ("IT5") is more likely a misread. Real mixed
// parts exist ("F15", "90CB"), so this is only used to break ties.
function pureParts(v) {
  return v.split("-").filter((seg) => /^[A-Z]+$/.test(seg) || /^[0-9]+$/.test(seg)).length;
}

/** Does a card number fit one of a subset's formats ({range:[a,b]} or {regex}). */
export function fitsFormat(value, formats = []) {
  const c = cleanCardNumber(value);
  if (!c) return false;
  return formats.some((f) => {
    if (f.range) return /^\d+$/.test(c) && Number(c) >= f.range[0] && Number(c) <= f.range[1];
    if (f.regex) return new RegExp(f.regex).test(c);
    return false;
  });
}

/**
 * Settle the card number from several independent reads.
 * @param {Array<string|null>} reads      raw reads (e.g. main scan, check A, check B)
 * @param {object} opts
 *   jerseyNumbers: numbers printed as jersey/uniform numbers (never a card number)
 *   formats: allowed formats for the identified product (any subset), optional
 * @returns {{ value, status, agreeing, reads, notes }}
 *   status: "agreed" | "single_read" | "majority" | "look_alike_majority" | "prefix_completed" |
 *           "format_tiebreak" | "no_agreement" | "unreadable"
 */
export function resolveCardNumberReads(reads, opts = {}) {
  const notes = [];
  const jersey = new Set((opts.jerseyNumbers || []).map((j) => String(j || "").replace(/\D/g, "")).filter(Boolean).map((j) => String(Number(j))));
  let cleaned = reads.map(cleanCardNumber).filter(Boolean);
  const dropped = cleaned.filter((r) => /^\d+$/.test(r) && jersey.has(String(Number(r))));
  if (dropped.length) notes.push(`Ignored ${dropped.length} read(s) equal to the jersey number.`);
  cleaned = cleaned.filter((r) => !dropped.includes(r));
  if (!cleaned.length) return { value: null, status: "unreadable", agreeing: 0, reads: [], notes };
  // One read alone is not enough to fill in a card number (the others saw none).
  if (cleaned.length === 1) {
    notes.push(`Only one read saw a card number (${cleaned[0]}); left blank.`);
    return { value: null, status: "single_read", agreeing: 1, reads: cleaned, notes };
  }

  const fits = (v) => opts.formats?.length ? fitsFormat(v, opts.formats) : null;
  const countBy = (list, key) => list.reduce((m, x) => ((m[key(x)] = (m[key(x)] || []).concat([x])), m), {});
  // Display spelling inside a group: most common exact spelling; ties → fits the product
  // format → all-letter/all-digit parts → more dashes. Unresolved tie of 2 reads → null.
  const pickSpelling = (list) => {
    const bySpelling = Object.entries(countBy(list, (x) => x));
    bySpelling.sort((a, b) => b[1].length - a[1].length
      || (fits(b[0]) === true) - (fits(a[0]) === true)
      || pureParts(b[0]) - pureParts(a[0])
      || b[0].split("-").length - a[0].split("-").length);
    const [best, second] = bySpelling;
    if (!second || best[1].length > second[1].length) return { value: best[0], tie: false };
    if (fits(best[0]) === true && fits(second[0]) !== true) return { value: best[0], tie: true, by: "format" };
    if (list.length >= 3 && pureParts(best[0]) > pureParts(second[0])) return { value: best[0], tie: true, by: "pure" };
    return { value: null, tie: true };
  };

  // 1) Exact agreement (ignoring dashes).
  const exact = Object.entries(countBy(cleaned, (x) => x.replace(/-/g, ""))).sort((a, b) => b[1].length - a[1].length);
  if (exact.length === 1) {
    return { value: pickSpelling(exact[0][1]).value || exact[0][1][0], status: "agreed", agreeing: cleaned.length, reads: cleaned, notes };
  }
  const looks = Object.entries(countBy(cleaned, lookAlikeKey)).sort((a, b) => b[1].length - a[1].length);
  // 2) A read that only dropped a leading prefix ("B-7" for "AB-7") supports the fuller read.
  const keys = exact.map(([k]) => k);
  const longest = keys.slice().sort((a, b) => b.length - a.length)[0];
  if (keys.every((k) => k === longest || (longest.endsWith(k) && /^[A-Z]+$/.test(longest.slice(0, longest.length - k.length)))) && longest.length > keys.find((k) => k !== longest).length && fits(exact.find(([k]) => k === longest)[1][0]) !== false) {
    notes.push("Other reads missed the letter prefix.");
    return { value: pickSpelling(exact.find(([k]) => k === longest)[1]).value || longest, status: "prefix_completed", agreeing: cleaned.length, reads: cleaned, notes };
  }
  // 3) Agreement once look-alike characters are treated as equal.
  if (looks[0][1].length >= 2 && (!looks[1] || looks[0][1].length > looks[1][1].length)) {
    const pick = pickSpelling(looks[0][1]);
    if (pick.value) {
      const distinct = new Set(looks[0][1].map((x) => x.replace(/-/g, ""))).size;
      if (distinct > 1) notes.push(`Reads differed only by look-alike characters (${looks[0][1].join(", ")}); used ${pick.value}.`);
      return { value: pick.value, status: distinct > 1 ? "look_alike_majority" : "majority", agreeing: looks[0][1].length, reads: cleaned, notes };
    }
  }
  // 4) Tie: only the product's card-number format may break it.
  if (opts.formats?.length) {
    const fitting = looks.filter(([, list]) => list.some((x) => fits(x)));
    if (fitting.length === 1) {
      const v = fitting[0][1].find((x) => fits(x));
      notes.push("Reads disagreed; only one fits this product's card-number format.");
      return { value: v, status: "format_tiebreak", agreeing: fitting[0][1].length, reads: cleaned, notes };
    }
  }
  notes.push("Reads disagree; card number left blank.");
  return { value: null, status: "no_agreement", agreeing: 0, reads: cleaned, notes };
}
