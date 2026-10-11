// A search vocabulary, NOT a checklist and NOT verification evidence.
// No print runs are assigned here: /50 Gold is not universal across releases.
export const VARIANT_VOCABULARY = Object.freeze({
  products: [
    "Topps Chrome", "Bowman Chrome", "Chrome Update", "Chrome Sapphire",
    "Donruss Optic", "Panini Prizm", "Select", "Mosaic", "Spectra", "Revolution",
    "Certified", "Contenders", "National Treasures", "Immaculate"
  ],
  categories: [
    "base", "rookie", "insert", "rookie_insert", "parallel", "autograph",
    "rookie_autograph", "autograph_parallel", "relic", "autograph_relic",
    "short_print", "super_short_print", "case_hit", "printing_plate", "one_of_one"
  ],
  finishTerms: [
    "Chrome", "Refractor", "Prizm", "Holo", "Silver", "Rainbow Foil",
    "Shimmer", "Wave", "RayWave", "Mojo", "Pulsar", "Lava", "Scope", "Laser",
    "Cracked Ice", "Disco", "Sparkle", "Glitter", "Hyper", "Velocity",
    "Camo", "Checkerboard", "X-Fractor", "Atomic", "Sapphire",
    "Flash", "Tie-Dye", "Die-Cut", "Gold Vinyl", "Superfractor"
  ],
  colorTerms: [
    "Black", "White", "Red", "Blue", "Aqua", "Teal", "Green", "Gold",
    "Orange", "Purple", "Pink", "Yellow", "Bronze", "Silver", "Rainbow",
    "Blue Ice", "Red Ice", "Green Ice", "Neon Green", "Neon Pink"
  ],
  insertAndRookieTerms: [
    "Rated Rookie", "Rookie Ticket", "Rookie Autographs", "Rookie Patch Autographs",
    "Rookie Debut", "Future Stars", "Emerging Stars", "The Rookies",
    "Downtown", "Kaboom!", "Color Blast", "Stained Glass", "Manga",
    "Helix", "Ultraviolet", "My House!", "Bomb Squad", "Optic Illusions",
    "Color Wheel", "Case Hit", "SP", "SSP"
  ],
  autographTerms: [
    "Autograph", "Auto", "On-Card Auto", "Sticker Auto", "Rookie Auto",
    "Dual Auto", "Triple Auto", "Autograph Relic", "Rookie Patch Autograph"
  ],
  memorabiliaTerms: [
    "Patch", "Jersey", "Relic", "Laundry Tag", "Logo Patch", "Shield",
    "Game-Worn", "Player-Worn", "Manufactured Relic"
  ]
});
export const CATALOG_EVIDENCE_LEVELS = Object.freeze([
  "manufacturer_checklist", "licensed_catalog", "independently_cross_checked",
  "single_source_unverified", "photo_suggestion"
]);
// No generic parallel name may imply a fixed serial-number denominator.
export function vocabularyCandidates(term) {
  const query = String(term || "").trim().toLowerCase();
  if (!query) return [];
  return Object.entries(VARIANT_VOCABULARY).flatMap(([group,values]) =>
    values.filter(value => value.toLowerCase().includes(query)).map(name=>({group,name,verification:"vocabulary_only",numberedTo:null}))
  );
}
