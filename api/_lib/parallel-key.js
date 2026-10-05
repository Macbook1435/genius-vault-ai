// Comparison key for parallel names, so different sources' spellings line up:
//   "Pink Refractors" / "Pink Refractor"            → "pink"
//   "Football Leather Green" / "Green Football Leather Refractor" → "football green leather"
//   "Ray Wave Refractor" / "RayWave"               → "raywave"
//   "Rookie Prizm Blue Ice" / "Blue Ice Prizms"     → "blue ice"
// Plain "Refractor" keeps the key "refractor". Plain base lines ("Base", "Rookie") return "".
const FILLER = new Set([
  "refractor", "refractors", "prizm", "prizms", "parallel", "parallels", "base", "rookie", "rookies",
  "autograph", "autographs", "auto", "autos", "the", "and", "rated", "card", "cards", "variation", "variations",
]);

export function parallelKey(name, extraFiller = []) {
  const extra = new Set(extraFiller.map((w) => String(w).toLowerCase()));
  let t = String(name || "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/ray\s*-?\s*wave/g, "raywave")
    .replace(/x\s*-?\s*fractor/g, "xfractor")
    .replace(/super\s*-?\s*fractor/g, "superfractor")
    .replace(/frozen\s*-?\s*fractor/g, "frozenfractor")
    .replace(/tie\s*-?\s*dye/g, "tiedye")
    .replace(/fuschia/g, "fuchsia")
    .replace(/[^a-z0-9 ]/g, " ");
  const words = t.split(/\s+/).filter(Boolean).map((w) => (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
  const kept = words.filter((w) => !FILLER.has(w) && !extra.has(w));
  if (!kept.length) return words.some((w) => w.startsWith("refractor")) ? "refractor" : "";
  return [...new Set(kept)].sort().join(" ");
}
