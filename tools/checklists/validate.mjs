// Checks every product checklist file. Run: node tools/checklists/validate.mjs
import { PRODUCTS } from "../../api/_data/checklists/index.js";
let errors = 0;
let warnings = 0;
const err = (m) => { errors++; console.log("ERROR  " + m); };
const warn = (m) => { warnings++; console.log("warn   " + m); };
const ids = new Set();
for (const p of PRODUCTS) {
  const where = p.id;
  if (ids.has(p.id)) err(`${where}: duplicate product id`);
  ids.add(p.id);
  for (const k of ["id", "label", "year", "sport", "brand", "product", "match", "subsets"]) if (p[k] === undefined || p[k] === null) err(`${where}: missing ${k}`);
  if (!Number.isInteger(p.year) || p.year < 1880 || p.year > 2100) err(`${where}: bad year`);
  const groups = [...(p.match?.include?.length ? [p.match.include] : []), ...(p.match?.includeAny || [])];
  if (!groups.length || groups.some((g) => !Array.isArray(g) || !g.length)) err(`${where}: match.include / match.includeAny must list the product words`);
  if ((p.sources || []).length < 2) err(`${where}: needs at least 2 sources`);
  for (const u of p.sources || []) if (!/^https:\/\//.test(u)) err(`${where}: source is not an https URL: ${u}`);
  for (const s of p.subsets || []) {
    const sw = `${where}/${s.id}`;
    if (!s.numberFormats?.length) err(`${sw}: no card-number format`);
    for (const f of s.numberFormats || []) {
      if (f.regex) { try { new RegExp(f.regex); } catch { err(`${sw}: bad regex ${f.regex}`); } }
      else if (!(Array.isArray(f.range) && f.range.length === 2 && f.range[0] <= f.range[1])) err(`${sw}: bad range`);
    }
    if (!s.parallels?.length) warn(`${sw}: no parallels listed`);
    if (s.sourceCount < 2) warn(`${sw}: only ${s.sourceCount} source(s); its parallels cannot be confirmed`);
    const seen = new Set();
    for (const par of s.parallels || []) {
      if (!par.name) err(`${sw}: parallel without a name`);
      if (!(par.numberedTo === null || Number.isInteger(par.numberedTo))) err(`${sw}: ${par.name}: bad print run`);
      const k = `${par.key}|${par.numberedTo}`;
      if (seen.has(k)) err(`${sw}: duplicate ${par.name} /${par.numberedTo}`);
      seen.add(k);
      if (par.conflicts?.length) warn(`${sw}: ${par.name}: sources disagree on print run (${[par.numberedTo, ...par.conflicts.map((c) => c.numberedTo)].join(" vs ")})`);
    }
    const v = (s.parallels || []).filter((x) => x.verified).length;
    console.log(`ok     ${sw}: ${v}/${(s.parallels || []).length} parallels confirmed by 2+ sources`);
  }
}
console.log(`\n${PRODUCTS.length} products, ${errors} errors, ${warnings} warnings`);
process.exit(errors ? 1 : 0);
