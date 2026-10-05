// Example snippets used inside the AI instructions.
//
// LEGACY: the exact wording the live scanner uses today. Kept byte-for-byte so the
//         default (switched-off) scanner behaves exactly as before. Some of these came
//         from early test cards; they are DELETED when pipeline v2 becomes the default.
//         (tools/check-no-test-cards.mjs allows them in this block only.)
// NEUTRAL: made-up examples that do not describe any real test card. Used by pipeline v2.

// --- LEGACY-BEGIN ---
export const LEGACY = {
  cardNumberLetters: `"FC-2", "RC-12", "BDC-45", "101"`,
  jerseyExample: `"Freshman #32", "QB #8"`,
  mainCardNumber: `"FC-2", not "C-2"`,
  mainParallel: `"Signature Class Airlines", "Gold Refractor"`,
  mainSponsor: `"Glaxo", a police department, a bank`,
  productName: `"First Class", "Prizm", "Chrome"`,
  parallelName: `"Signature Class Airlines", "Silver Prizm", "Gold Refractor"`,
  stylizedName: `"TeSlaa"`,
  sponsorList: `"Glaxo", "Adolescent CareUnit", a police department, a bank, a restaurant`,
  draftLine: `"DRAFTED: DETROIT (2) 2025" gives "2025"`,
  closeupSerial: `"06/10" or "112/199"`,
};
// --- LEGACY-END ---

export const NEUTRAL = {
  cardNumberLetters: `"AB-7", "RC-12", "XYZ-45", "101"`,
  jerseyExample: `"Senior #14", "QB #8"`,
  mainCardNumber: `"AB-7", not "B-7"`,
  mainParallel: `"Gold Refractor", "Silver Prizm"`,
  mainSponsor: `a soft-drink brand, a police department, a bank`,
  productName: `"Chrome", "Prizm", "Optic"`,
  parallelName: `"Silver Prizm", "Gold Refractor", "Blue Wave"`,
  stylizedName: `"McDonald" or "DeSmith"`,
  sponsorList: `a soft-drink brand, a hospital, a police department, a bank, a restaurant`,
  draftLine: `"DRAFTED: ROUND 3, 2019" gives "2019"`,
  closeupSerial: `"12/99" or "112/199"`,
};

export function promptExamples(useNeutral) {
  return useNeutral ? NEUTRAL : LEGACY;
}
