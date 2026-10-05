// Fails if any test-card term appears in scanner code, prompts, or checklist data.
// Allowed only inside the LEGACY-BEGIN/LEGACY-END block of api/_lib/prompt-examples.js.
// Run: node tools/check-no-test-cards.mjs
import fs from "fs";
import path from "path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const terms = fs.readFileSync(path.join(root, "tools/test-card-terms.txt"), "utf8").split("\n")
  .map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((l) => new RegExp(l, "i"));
const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : /\.(js|mjs|json)$/.test(f) && files.push(p); } };
walk(path.join(root, "api"));
walk(path.join(root, "tools/checklists/products"));
let bad = 0;
for (const f of files) {
  let text = fs.readFileSync(f, "utf8");
  if (f.endsWith(path.join("_lib", "prompt-examples.js"))) text = text.replace(/\/\/ --- LEGACY-BEGIN ---[\s\S]*?\/\/ --- LEGACY-END ---/, "");
  text.split("\n").forEach((line, i) => {
    for (const re of terms) if (re.test(line)) { bad++; console.log(`${path.relative(root, f)}:${i + 1}: "${line.trim().slice(0, 100)}" matches ${re}`); }
  });
}
if (bad) { console.log(`FAIL: ${bad} test-card reference(s).`); process.exit(1); }
console.log(`OK: no test-card references in ${files.length} files.`);
