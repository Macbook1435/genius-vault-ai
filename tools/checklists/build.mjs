// Builds api/_data/checklists/<product>.js from:
//   tools/checklists/products/<product>.json   (match rules + card-number formats per subset)
//   tools/checklists/sources/<dir>/*.txt       (one file per public source, "## Subset" headers,
//                                                "Name — /N" or "Name — unnumbered" lines)
// A parallel is marked verified only when 2+ independent sources list it with the SAME
// print run and none disagree (or 3+ agree and outnumber the dissent 2:1). Everything else is kept but unverified.
//
// Run: node tools/checklists/build.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parallelKey } from "../../api/_lib/parallel-key.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const outDir = path.join(root, "api/_data/checklists");

// Header words made comparable across sources ("Veterans Class Autographs" ≈ "Veteran Class Auto").
function headerWords(h) {
  return " " + h.toLowerCase().split("(")[0]
    .replace(/^\s*\d{4}\s+topps\s+[a-z ]+?\s+[–-]\s+/, "") // "2025 Topps Resurgence – Base Set"
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/).filter(Boolean)
    .map((w) => ({ veterans: "veteran", rookies: "rookie", signatures: "signature", autographs: "auto", autograph: "auto", autos: "auto" }[w] || w))
    .join(" ") + " ";
}

// Product-specific header rules (in the product JSON): [{ subset, all: [...], none: [...] }].
// A header maps to every subset whose words are all present and none of whose "none" words are.
function subsetsByRules(h, rules) {
  const t = headerWords(h);
  const has = (w) => t.includes(" " + w + " ");
  return rules.filter((r) => r.all.every(has) && !(r.none || []).some(has)).map((r) => r.subset);
}

// Generic header → subset ids. Named inserts ("Prospects: Helix", "Image Variation") are skipped.
function subsetsForHeader(h, cfg) {
  if (cfg?.headerRules) return subsetsByRules(h, cfg.headerRules);
  const t = h.toLowerCase();
  const title = t.split("(")[0];
  if (title.includes(":") || /variation|award|event|rps|image|insert/.test(title)) return [];
  if (/overall|base \(all|base parallels/.test(t)) return ["base_vet", "base_rookie"];
  if (/prospect/.test(t) && /auto/.test(t)) return ["prospect_auto"];
  if (/prospect/.test(t)) return ["prospects"];
  if (/rookie/.test(t) && /auto/.test(t)) return ["rookie_auto"];
  if (/autographs \(all\)/.test(t)) return ["rookie_auto", "base_auto"];
  if (/base auto/.test(t)) return ["base_auto"];
  if (/base rookie|rated rookie/.test(t)) return ["base_rookie"];
  if (/base veteran/.test(t)) return ["base_vet"];
  return [];
}

function parseRun(s) {
  const t = s.trim().toLowerCase();
  if (/unnumbered/.test(t)) return { run: null };
  if (/not stated|not specified/.test(t)) return { skip: true };
  let m = t.match(/^1\/1\b|one-of-one/);
  if (m) return { run: 1 };
  m = t.match(/^\/?\s*(-?\d+)\b/);
  if (m) return { run: Number(m[1]) };
  return { skip: true };
}

function parseSource(file, extraFiller, cfg) {
  const text = fs.readFileSync(file, "utf8");
  const url = (text.match(/^SOURCE:\s*(\S+)/m) || [])[1];
  const lines = text.split("\n");
  const bySubset = {};
  let current = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("##")) { current = subsetsForHeader(line.replace(/^#+/, ""), cfg); continue; }
    if (!current.length) continue;
    const m = line.replace(/^[-*]\s*/, "").replace(/^#\d+\s+/, "").match(/^(.+?)\s+[—–-]\s+(.+)$/);
    if (!m) continue;
    const name = m[1].replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
    const r = parseRun(m[2]);
    if (r.skip) continue;
    const key = parallelKey(name, extraFiller);
    if (!key) continue; // plain base card line ("Rookie", "Base")
    for (const sub of current) {
      bySubset[sub] = bySubset[sub] || new Map();
      if (!bySubset[sub].has(key)) bySubset[sub].set(key, { name, run: r.run });
    }
  }
  return { url, host: url ? new URL(url).hostname : path.basename(file), bySubset };
}

function displayName(names) {
  // Most common spelling; tie → the one that ends in "Refractor"/"Prizm" or the longest.
  const counts = {};
  for (const n of names) counts[n] = (counts[n] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0];
}

function cleanDisplay(n) {
  return n.replace(/^(Bowman Chrome|Topps Chrome|Donruss Optic|Optic|Prizm)\s+(Prospects?|Prospect Autographs|Rookie Autographs)?\s*/i, "").replace(/\s+Parallel$/i, "").replace(/\bRefractors\b/g, "Refractor").replace(/\bPrizms\b/g, "Prizm")
    .replace(/^(Base|Rookie|Rookies)\s+(Prizm\s+)?/i, "").replace(/^Rookie Autographs\s+(Prizm\s+)?/i, "")
    .replace(/\s+Rookie Autographs$/i, "").replace(/\s+Auto$/i, "").trim();
}

function build(cfg) {
  const dir = path.join(here, "sources", cfg.sourcesDir);
  // Product words ("Bowman", "Chrome", "Prospects") are not part of a parallel's name.
  const words = (v) => String(v || "").toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2);
  const extraFiller = [...new Set([...words(cfg.brand), ...words(cfg.product), ...(cfg.brandAliases || []).flatMap(words),
    ...cfg.subsets.flatMap((s) => words(s.label)), "prospect", "prospects", "parallel"])];
  const sources = fs.readdirSync(dir).filter((f) => f.endsWith(".txt")).map((f) => parseSource(path.join(dir, f), extraFiller, cfg));
  const subsets = cfg.subsets.map((s) => {
    const merged = new Map();
    for (const src of sources) {
      for (const [key, e] of src.bySubset[s.id] || []) {
        if (!merged.has(key)) merged.set(key, { key, names: [], runs: [] });
        const m = merged.get(key);
        let shown = cleanDisplay(e.name);
        // Chrome versions of a paper set: show "Orange Refractor", not "Orange".
        if (s.nameSuffix && !new RegExp(s.nameSuffix.replace(/s$/, "") + "|fractor", "i").test(shown)) shown = `${shown} ${s.nameSuffix}`;
        m.names.push(shown);
        m.runs.push({ run: e.run, source: src.host });
      }
    }
    const parallels = [...merged.values()].map((m) => {
      const byRun = {};
      for (const r of m.runs) (byRun[String(r.run)] = byRun[String(r.run)] || []).push(r.source);
      const ranked = Object.entries(byRun).sort((a, b) => b[1].length - a[1].length);
      const [topRun, topSources] = ranked[0];
      const others = m.runs.length - topSources.length;
      // Verified: 2+ sources agree and none disagree, or 3+ agree and outnumber dissent 2:1.
      const verified = (topSources.length >= 2 && others === 0) || (topSources.length >= 3 && topSources.length >= 2 * others);
      return {
        name: displayName(m.names),
        key: m.key,
        numberedTo: topRun === "null" ? null : Number(topRun),
        verified,
        sources: topSources,
        ...(ranked.length > 1 ? { conflicts: ranked.slice(1).map(([run, srcs]) => ({ numberedTo: run === "null" ? null : Number(run), sources: srcs })) } : {}),
      };
    }).sort((a, b) => (b.numberedTo || 100000) - (a.numberedTo || 100000) || a.name.localeCompare(b.name));
    const sourceCount = new Set(sources.filter((src) => src.bySubset[s.id]?.size).map((src) => src.host)).size;
    return { ...s, sourceCount, parallels };
  });
  return {
    id: cfg.id, label: cfg.label, year: cfg.year, sport: cfg.sport, brand: cfg.brand,
    brandAliases: cfg.brandAliases || [], product: cfg.product, baseFinish: cfg.baseFinish || "plain_refractor", match: cfg.match,
    copyrightYears: cfg.copyrightYears || [cfg.year], ...(cfg.logo ? { logo: cfg.logo } : {}),
    sources: sources.map((s) => s.url).filter(Boolean),
    subsets,
  };
}

fs.mkdirSync(outDir, { recursive: true });
const ids = [];
for (const f of fs.readdirSync(path.join(here, "products")).filter((x) => x.endsWith(".json")).sort()) {
  const cfg = JSON.parse(fs.readFileSync(path.join(here, "products", f), "utf8"));
  const product = build(cfg);
  const varName = "P_" + cfg.id.replace(/[^a-z0-9]/gi, "_");
  fs.writeFileSync(path.join(outDir, `${cfg.id}.js`),
    `// GENERATED by tools/checklists/build.mjs — do not edit by hand.\n// Sources: ${product.sources.join(" , ")}\nexport const ${varName} = ${JSON.stringify(product, null, 1)};\nexport default ${varName};\n`);
  ids.push([cfg.id, varName]);
  const summary = product.subsets.map((s) => `${s.id}: ${s.parallels.filter((p) => p.verified).length}/${s.parallels.length} verified (${s.sourceCount} sources)`).join("; ");
  console.log(`${cfg.id}: ${summary}`);
}
fs.writeFileSync(path.join(outDir, "index.js"),
  `// GENERATED by tools/checklists/build.mjs — product registry.\n${ids.map(([id, v]) => `import ${v} from "./${id}.js";`).join("\n")}\nexport const PRODUCTS = [${ids.map(([, v]) => v).join(", ")}];\n`);
