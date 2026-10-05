// Narrow a subset's parallel list using what the card shows: print run (serial),
// color, and surface finish. A parallel is "confirmed" only if exactly one candidate
// survives AND that candidate is listed with the same print run by 2+ sources.

const NOT_PARALLEL_WORDS = new Set(["autograph", "autographs", "auto", "autos", "variation", "variations", "rookie", "rookies", "rc", "base", "card", "cards", "version", "signed", "signature", "signatures", "insert", "parallel", "rated"]);

export function isCardTypeNotParallel(name) {
  const words = String(name || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  return words.length > 0 && words.every((w) => NOT_PARALLEL_WORDS.has(w));
}

const FINISH_WORDS = {
  plain_refractor: [], wave: ["wave"], lava: ["lava"], geometric: ["geometric"],
  football_leather: ["leather"], prizm: ["prizm"], xfractor: ["x-fractor", "xfractor"],
  pulsar: ["pulsar"], raywave: ["raywave", "ray wave"], prism: ["prism"], shimmer: ["shimmer"], mojo: ["mojo"], cracked_ice: ["cracked ice", "ice"],
};
const SPECIAL_WORDS = ["neon pulse", "molten", "frozenfractor", "superfractor", "tie dye", "tie-dye", "speckle", "sparkle", "scope", "velocity", "hyper", "camo", "checker", "disco", "pandora", "snakeskin", "mini-diamond", "mini diamond"];
const ALL_FINISH_WORDS = [...Object.values(FINISH_WORDS).flat(), ...SPECIAL_WORDS];

export const COLOR_FAMILIES = [
  ["pink", "magenta", "purple", "fuchsia"],
  ["blue", "aqua", "teal", "sky", "navy"],
  ["gold", "yellow", "orange"],
  ["red", "orange"],
  ["silver", "white"],
  ["green", "lime", "neon"],
];
const COLOR_WORDS = ["pink", "blue", "gold", "green", "purple", "orange", "red", "black", "aqua", "teal", "yellow", "white", "silver", "bronze", "magenta", "fuchsia", "sky", "navy", "lime"];

const words = (p) => p.name.toLowerCase().split(/[\s,/-]+/);

/**
 * @param {Array<{name, numberedTo, verified}>} candidates
 * @param {{ numberedTo: number|"any"|null, color: string|null, finish: string|null }} ev
 */
export function matchParallel(candidates, ev) {
  const color = String(ev.color || "").toLowerCase().trim();
  // A product's normal surface (e.g. "prizm" on a Prizm card) is not a special finish.
  const finish = ev.finish && ev.baseFinish && ev.finish === ev.baseFinish ? "plain_refractor" : ev.finish || null;
  if (!ev.numberedTo && !color && (!finish || ["no_shine", "unknown", "other"].includes(finish))) {
    return { status: "base", parallel: null, candidates: [], steps: ["no serial, color, or special finish"] };
  }
  let list = candidates.slice();
  const steps = [];
  if (ev.numberedTo === "any") steps.push("print run unknown");
  else if (ev.numberedTo) { list = list.filter((p) => Number(p.numberedTo) === Number(ev.numberedTo)); steps.push(`/${ev.numberedTo}`); }
  else { list = list.filter((p) => !p.numberedTo); steps.push("unnumbered"); }

  let colorConflict = false;
  if (color && color !== "null") {
    const exact = list.filter((p) => words(p).includes(color));
    const family = COLOR_FAMILIES.find((f) => f.includes(color)) || [color];
    const near = list.filter((p) => family.some((c) => words(p).includes(c)));
    if (exact.length) { list = exact; steps.push(color); }
    else if (near.length) { list = near; steps.push(`${color} (close to ${family.join("/")})`); }
    else colorConflict = true;
  } else {
    list = list.filter((p) => !COLOR_WORDS.some((c) => words(p).includes(c)));
    steps.push("no color");
  }
  if (finish && !["unknown", "other"].includes(finish)) {
    const fw = FINISH_WORDS[finish];
    if (fw) {
      list = fw.length
        ? list.filter((p) => fw.some((w) => p.name.toLowerCase().includes(w)))
        : list.filter((p) => !ALL_FINISH_WORDS.some((w) => p.name.toLowerCase().includes(w)));
      steps.push(finish.replace(/_/g, " "));
    }
  }
  // Products with paper and chrome versions of the same cards: the finish picks the version.
  if (finish && list.some((p) => p.finish)) {
    const want = finish === "no_shine" ? "paper" : ["unknown", "other"].includes(finish) ? null : "chrome";
    if (want) {
      const kept = list.filter((p) => !p.finish || p.finish === want);
      if (kept.length) { list = kept; steps.push(`${want} version`); }
    }
  }
  const out = (status, parallel = null) => ({ status, parallel, candidates: list.slice(0, 8), steps });
  if (colorConflict) return out(list.length ? "ambiguous" : "no_match");
  if (!list.length) return out("no_match");
  if (list.length > 1) return out("ambiguous");
  const only = list[0];
  if (ev.numberedTo === "any") return out("probable", only);
  return out(only.verified ? "confirmed" : "single_source", only);
}
