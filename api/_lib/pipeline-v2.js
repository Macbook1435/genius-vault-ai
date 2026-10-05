// Pipeline v2: generic card-number + player-name agreement and product/subset checklists.
//
// Switch:
//   default                         → "off": nothing here runs; the scanner is unchanged.
//   form field pipeline=v2-shadow   → "shadow": runs next to v1, result returned under "v2" only.
//   env GV_PIPELINE=v2              → "primary": v2 results replace v1 player/card number/parallel.
// Turning it off again = remove GV_PIPELINE (or set it to anything else).
import { resolveCardNumberReads, cleanCardNumber } from "./card-number.js";
import { resolvePlayerNameReads } from "./player-name.js";
import { findProduct, findSubset } from "./checklist-registry.js";
import { matchParallel, isCardTypeNotParallel } from "./parallel-match.js";
import { buildFieldVerification } from "./verification.js";

export function pipelineV2Mode(fields) {
  if (process.env.GV_PIPELINE === "v2") return "primary";
  const f = fields?.pipeline;
  const v = Array.isArray(f) ? f[0] : f;
  return v === "v2-shadow" ? "shadow" : "off";
}

// Extra field for check A when v2 runs: the sport (to tell apart same-name products).
export const V2_COMBINED_EXTRA = {
  properties: { sport: { type: "string", enum: ["football", "baseball", "basketball", "hockey", "soccer", "other", "unknown"] } },
  required: ["sport"],
  prompt: `

SPORT:
- sport: the sport shown (football, baseball, basketball, hockey, soccer), from league logos, uniforms, positions or stats. "unknown" if you cannot tell.`,
};

const present = (v) => v !== null && v !== undefined && String(v).trim() !== "";
const strip = (v) => (present(v) ? String(v).trim() : null);

function parseSerial(text) {
  const m = String(text || "").match(/(\d{1,4})\s*\/\s*(\d{1,4})/);
  return m ? { num: Number(m[1]), den: Number(m[2]) } : null;
}

export async function runPipelineV2({ scan, raw, verification, serialImage, tiebreak }) {
  const card = structuredClone(scan);
  const main = raw?.main || {};
  const A = raw?.combined || {};
  const B = raw?.strong || {};
  const catalog = verification?.outside?.catalog || {};
  const catalogOk = catalog.status === "accepted";
  const notes = [];

  // 1. Player name: three independent reads (main scan, check A, check B).
  const player = resolvePlayerNameReads([main.evidence?.playerNameText || main.player, A.playerNameText, B.playerNameText]);
  card.player = player.value;
  notes.push(...player.notes.map((n) => `Player: ${n}`));

  // 2. Product from year + sport + brand + set.
  card.sport = A.sport || null;
  const prod = findProduct(card);
  const product = prod.product;
  const allFormats = product ? product.subsets.flatMap((s) => s.numberFormats) : [];

  // 3. Card number: three independent reads, look-alike repair, product formats as tiebreak.
  const number = resolveCardNumberReads([main.cardNumber, A.cardNumberText, B.cardNumberText], {
    jerseyNumbers: [A.jerseyNumberText, B.jerseyNumberText],
    formats: allFormats,
  });
  card.cardNumber = number.value;
  notes.push(...number.notes.map((n) => `Card number: ${n}`));

  // 4. Subset (base / rookies / rookie autographs / ...).
  const sub = product ? findSubset(product, card) : null;

  // 5. Parallel.
  let par = { status: "no_checklist", parallel: null, candidates: [], steps: [] };
  if (present(card.parallel) && isCardTypeNotParallel(card.parallel)) card.parallel = null;
  if (catalogOk && verification?.parallelId?.source === "catalog") {
    par = { status: "confirmed", source: "catalog", parallel: { name: card.parallel, verified: true }, candidates: [] };
  } else if (sub && !sub.subset.parallels.length) {
    par = { status: "none_listed", parallel: null, candidates: [], steps: [] };
    card.parallel = null;
  } else if (sub) {
    let numberedTo = card.numberedTo || null;
    if (!numberedTo) {
      const a = parseSerial(A.stampedSerial);
      const b = parseSerial(B.stampedSerial);
      if (a && b) numberedTo = a.den === b.den ? a.den : "any";
    }
    const printRunFromChecks = !card.numberedTo && numberedTo ? true : false;
    par = matchParallel(sub.subset.parallels, {
      numberedTo,
      color: A.parallelColor,
      finish: A.parallelFinish,
      baseFinish: product.baseFinish,
    });
    if (printRunFromChecks && par.status === "confirmed") par.status = "probable";
    if (par.status === "ambiguous" && par.candidates.length >= 2 && par.candidates.length <= 4 && tiebreak) {
      const tb = await tiebreak(par.candidates).catch(() => null);
      if (tb) {
        const pick = par.candidates.find((c) => c.name === tb.answer);
        if (pick) {
          par = { ...par, parallel: pick, status: printRunFromChecks ? "probable" : pick.verified ? "confirmed" : "single_source", tiebreak: tb.reason };
        }
      }
    }
    card.parallel = par.status === "confirmed" ? par.parallel.name : par.status === "base" ? null : null;
  }

  const fields = buildFieldsV2({ card, raw, verification, catalogOk, catalog, prod, sub, number, player, par, serialImage });
  return {
    scan: card,
    product: product ? { id: product.id, label: product.label, status: prod.status, sources: product.sources.length } : { status: prod.status, candidates: prod.candidates || [] },
    subset: sub ? { id: sub.subset.id, label: sub.subset.label, status: sub.status, steps: sub.steps, numberFits: sub.numberFits } : null,
    cardNumber: number,
    player,
    parallel: { status: par.status, name: par.parallel?.name || null, verified: par.parallel?.verified ?? null, candidates: par.candidates.map((c) => `${c.name}${c.numberedTo ? ` /${c.numberedTo}` : ""}${c.verified ? "" : " (1 source)"}`), steps: par.steps, tiebreak: par.tiebreak || null },
    pipeline: fields,
    notes,
    diff: diffScans(scan, card),
  };
}

function buildFieldsV2({ card, raw, verification, catalogOk, catalog, prod, sub, number, player, par, serialImage }) {
  const f = {};
  const product = prod.product;
  const idn = verification?.identity || {};
  const C = (value, basis) => ({ value: present(value) ? value : null, status: "confirmed", basis });
  const U = (value, basis) => ({ value: present(value) ? value : null, status: "unconfirmed", basis });

  // Player
  if (catalogOk) f.player = C(card.player, "Matches the catalog (CardSight).");
  else if (["agreed", "majority"].includes(player.status) && player.agreeing >= 2) f.player = C(card.player, `${player.agreeing} independent reads agree.`);
  else f.player = U(card.player, player.status === "no_agreement" ? "Name reads disagree." : player.status === "single_read" ? "Only one read; not confirmed." : player.status === "one_letter_majority" ? "Reads differ by a letter." : "Not readable.");

  // Year
  if (!present(card.year)) f.year = U(null, "Not readable on the card.");
  else if (catalogOk && Number(catalog.match?.year) === Number(card.year)) f.year = C(card.year, "Matches the catalog (CardSight).");
  else if (product && idn.yearOk) f.year = C(card.year, `Copyright line agrees and matches the ${product.label} checklist.`);
  else f.year = U(card.year, product ? "Copyright line not confirmed." : "No catalog/checklist for this product yet.");

  // Set (product + subset)
  const setText = [card.brand, card.set].filter(present).join(" ");
  if (catalogOk) f.set = C(setText, "Matches the catalog (CardSight).");
  else if (product) f.set = C(`${product.label}${sub && sub.status === "matched" ? ` — ${sub.subset.label}` : ""}`, `Matches the ${product.label} checklist (${product.sources.length} sources).`);
  else if (prod.status === "ambiguous") f.set = U(setText, `Could be ${prod.candidates.join(" or ")}; sport/set not clear enough.`);
  else f.set = U(setText, "No catalog/checklist for this product yet.");

  // Card number
  const num = cleanCardNumber(card.cardNumber);
  if (!num) f.cardNumber = U(null, number.status === "no_agreement" ? "Reads disagree; left blank." : "Not readable.");
  else if (catalogOk && catalog.match?.number) f.cardNumber = C(num, "Matches the catalog (CardSight).");
  else if (sub && sub.numberFits === false) f.cardNumber = U(num, `Does not fit any ${product.label} card-number format.`);
  else if (sub) f.cardNumber = U(num, `${number.agreeing} reads agree and it fits the ${sub.subset.label} format; no card list to confirm the exact card.`);
  else f.cardNumber = U(num, `${number.agreeing} reads agree; no catalog/checklist to check it against.`);

  // Parallel
  const parBasis = {
    confirmed: () => C(par.parallel.name, par.source === "catalog" ? "Matches the catalog (CardSight)." : `Only ${sub.subset.label} parallel that fits ${par.steps.join(" + ")}${par.tiebreak ? " (closer look)" : ""}; listed by ${par.parallel.sources?.length || 2}+ sources.`),
    base: () => C("Base", "No serial, parallel color, or special finish: base card."),
    probable: () => U(null, `Probably ${par.parallel.name}, but the serial/print run was not confirmed.`),
    single_source: () => U(null, `Probably ${par.parallel.name}, but only one source lists it with that print run.`),
    ambiguous: () => U(null, `Could be: ${par.candidates.map((c) => c.name + (c.numberedTo ? ` /${c.numberedTo}` : "")).join(", ")}.`),
    no_match: () => U(null, `Nothing in the ${sub?.subset.label || ""} checklist matches what the card shows.`),
    no_checklist: () => U(card.parallel, "No checklist for this product yet."),
    none_listed: () => U(null, `The sources list no parallels for ${sub?.subset.label}; check the card for a serial or color.`),
  };
  f.parallel = (parBasis[par.status] || parBasis.no_checklist)();

  // Serial (same rules as the current pipeline)
  const v1 = buildFieldVerification(card, { ...verification, parallelId: { status: par.status === "ambiguous" ? "ambiguous" : par.status, candidateObjects: par.candidates } }, { serialImage, identity: idn, checklist: null, strongCheck: raw?.strong });
  f.serial = v1.fields.serial;

  const order = ["player", "year", "set", "cardNumber", "parallel", "serial"];
  const unconfirmed = order.filter((k) => f[k].status !== "confirmed");
  return { version: 2, fields: f, unconfirmed, allConfirmed: unconfirmed.length === 0, serialCloseup: v1.serialCloseup };
}

function diffScans(a, b) {
  const out = [];
  for (const k of ["player", "cardNumber", "parallel"]) {
    const x = strip(a[k]);
    const y = strip(b[k]);
    if ((x || "") !== (y || "")) out.push({ field: k, v1: x, v2: y });
  }
  return out;
}
