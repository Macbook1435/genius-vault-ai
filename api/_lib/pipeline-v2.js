// Pipeline v2: generic card-number + player-name agreement and product/subset checklists.
//
// Switch:
//   default                         → "off": nothing here runs; the scanner is unchanged.
//   form field pipeline=v2-shadow   → "shadow": runs next to v1, result returned under "v2" only.
//   env GV_PIPELINE=v2              → "primary": v2 results replace v1 player/card number/parallel.
// Turning it off again = remove GV_PIPELINE (or set it to anything else).
import { resolveCardNumberReads, cleanCardNumber } from "./card-number.js";
import { resolvePlayerNameReads } from "./player-name.js";
import { findProduct, findSubset, logoProducts, getProduct } from "./checklist-registry.js";
import { fitsFormat } from "./card-number.js";
import { matchParallel, isCardTypeNotParallel } from "./parallel-match.js";
import { buildFieldVerification } from "./verification.js";

export function pipelineV2Mode(fields) {
  if (process.env.GV_PIPELINE === "v2") return "primary";
  const f = fields?.pipeline;
  const v = Array.isArray(f) ? f[0] : f;
  return v === "v2-shadow" ? "shadow" : "off";
}

// Extra fields the two checks return when v2 runs: sport, the copyright year (check A did
// not read it before), and — for products whose cards print no set name — the logo.
function logoPrompt() {
  const list = logoProducts();
  if (!list.length) return "";
  return `

PRODUCT LOGO (only for cards with no set name printed):
- productLogo: if the card shows NO printed set/product name, compare its logo with these and give the id ONLY if the logo clearly matches the description; otherwise "none".
${list.map((p) => `  - "${p.id}": ${p.logo}`).join("\n")}
- If a set/product name is printed on the card, use "none".`;
}
const logoIds = () => [...logoProducts().map((p) => p.id), "none"];

export function v2Extras(kind) { // "main" | "combined" | "strong"
  const props = { productLogo: { type: "string", enum: logoIds() } };
  const req = ["productLogo"];
  let prompt = logoPrompt();
  if (kind === "combined") {
    props.sport = { type: "string", enum: ["football", "baseball", "basketball", "hockey", "soccer", "other", "unknown"] };
    props.copyrightYearSeen = { type: ["string", "null"] };
    req.push("sport", "copyrightYearSeen");
    prompt = `

SPORT:
- sport: the sport shown (football, baseball, basketball, hockey, soccer), from league logos, uniforms, positions or stats. "unknown" if you cannot tell.

COPYRIGHT YEAR:
- copyrightYearSeen: the 4-digit year in the copyright line (starts with "©", tiny print at the bottom of the back), digit by digit. Small 3, 5, 6 and 8 look alike; zoom in. Null if not readable.` + prompt;
  }
  return { properties: props, required: req, prompt };
}
// Kept for the existing import in scan.js.
export const V2_COMBINED_EXTRA = v2Extras("combined");

const present = (v) => v !== null && v !== undefined && String(v).trim() !== "";
const strip = (v) => (present(v) ? String(v).trim() : null);

function parseSerial(text) {
  const m = String(text || "").match(/(\d{1,4})\s*\/\s*(\d{1,4})/);
  return m ? { num: Number(m[1]), den: Number(m[2]) } : null;
}

export async function runPipelineV2({ scan, raw, verification, serialImage, tiebreak, copyrightCloseup }) {
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

  // 2. Product: printed set name (brand + set words + sport), or — when no name is printed —
  //    the logo, if BOTH checks name the same product and the card number fits its numbering.
  card.sport = A.sport || null;
  let years = yearEvidence(main, A, B, raw?.copyright);
  // Zoom in on the copyright line only when the full-photo reads do not already agree.
  const photoYears = new Set(years.valid.map((r) => r.year));
  if (!raw?.copyright && copyrightCloseup && (years.valid.length < 2 || photoYears.size !== 1)) {
    raw.copyright = await copyrightCloseup();
    years = yearEvidence(main, A, B, raw.copyright);
  }
  const yearTest = (p) => {
    const { fit, against } = yearSupport(p, years);
    return fit > 0 ? fit > against : !years.valid.length && (!years.latestEvent || p.year >= years.latestEvent);
  };
  let prod = findProduct(card, undefined, { yearTest });
  let route = prod.product ? "printed_name" : null;
  const firstNumber = resolveCardNumberReads([main.cardNumber, A.cardNumberText, B.cardNumberText], { jerseyNumbers: [A.jerseyNumberText, B.jerseyNumberText] });
  // Logo: at least 2 of the 3 checks must name the same product, and none may name another.
  const logoVotes = [main.productLogo, A.productLogo, B.productLogo].filter((v) => v && v !== "none");
  const logoCounts = logoVotes.reduce((m, v) => ((m[v] = (m[v] || 0) + 1), m), {});
  const logoIds = Object.keys(logoCounts);
  const logoPick = logoIds.length === 1 && logoCounts[logoIds[0]] >= 2 ? logoIds[0] : null;
  if (!prod.product && logoPick) {
    const p = getProduct(logoPick);
    const reads = [firstNumber.value, ...firstNumber.reads].filter(Boolean);
    const fitsP = p && reads.some((r) => p.subsets.some((sub) => fitsFormat(r, sub.numberFormats)));
    if (p && fitsP && yearTest(p) && (!card.sport || card.sport === "unknown" || card.sport === p.sport)) {
      prod = { product: p, status: "matched" };
      route = "logo";
      notes.push(`Product: no set name printed; ${logoCounts[logoPick]} of 3 checks matched the ${p.label} logo and the card number fits its numbering.`);
    } else if (p) {
      notes.push(`Product: ${logoCounts[logoPick]} of 3 checks matched the ${p.label} logo, but the card number/year/sport do not fit it, so it was not used.`);
    }
  } else if (!prod.product && logoVotes.length) {
    notes.push(`Product: logo votes ${JSON.stringify(logoCounts)} — need 2 of 3 agreeing on one product; not used.`);
  }
  const product = prod.product;
  const ysup = product ? yearSupport(product, years) : null;
  // The product (and so its checklist) is only trusted when the year is backed by a copyright read.
  const productYearConfirmed = Boolean(product && ysup.fit >= 1 && ysup.fit > ysup.against);
  if (product && productYearConfirmed) card.year = product.year;
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
    if ((printRunFromChecks || !productYearConfirmed) && par.status === "confirmed") par.status = "probable";
    if (par.status === "ambiguous" && par.candidates.length >= 2 && par.candidates.length <= 4 && tiebreak) {
      const tb = await tiebreak(par.candidates).catch(() => null);
      if (tb) {
        const pick = par.candidates.find((c) => c.name === tb.answer);
        if (pick) {
          // One closer look alone is a guess; it confirms only when a second, independent look agrees.
          // An "unsure" second look abstains; a second look naming a DIFFERENT parallel blocks it.
          const single = tb.agreed === false && Boolean(tb.second);
          par = { ...par, parallel: pick, tiebreakAgreed: !single, tiebreakSecond: tb.second ?? null, status: printRunFromChecks || !productYearConfirmed || single ? "probable" : pick.verified ? "confirmed" : "single_source", tiebreak: tb.reason };
        }
      }
    }
    card.parallel = par.status === "confirmed" ? par.parallel.name : par.status === "base" ? null : null;
  }

  const fields = buildFieldsV2({ card, raw, verification, catalogOk, catalog, prod, sub, number, player, par, serialImage, route, years, ysup, productYearConfirmed });
  return {
    scan: card,
    year: { reads: years.reads, ignored: years.ignored, superseded: years.superseded, closeup: years.closeup, closeupStatus: years.closeupStatus, closeupFallback: years.closeupFallback, latestEvent: years.latestEvent, productYearConfirmed },
    product: product ? { id: product.id, label: product.label, status: prod.status, route, yearConfirmed: productYearConfirmed, sources: product.sources.length } : { status: prod.status, candidates: prod.candidates || [] },
    subset: sub ? { id: sub.subset.id, label: sub.subset.label, status: sub.status, steps: sub.steps, numberFits: sub.numberFits } : null,
    cardNumber: number,
    player,
    parallel: { status: par.status, name: par.parallel?.name || null, verified: par.parallel?.verified ?? null, candidates: par.candidates.map((c) => `${c.name}${c.numberedTo ? ` /${c.numberedTo}` : ""}${c.verified ? "" : " (1 source)"}`), steps: par.steps, tiebreak: par.tiebreak || null },
    pipeline: fields,
    notes,
    diff: diffScans(scan, card),
  };
}

function buildFieldsV2({ card, raw, verification, catalogOk, catalog, prod, sub, number, player, par, serialImage, route, years, ysup, productYearConfirmed }) {
  const f = {};
  const product = prod.product;
  const idn = verification?.identity || {};
  const C = (value, basis) => ({ value: present(value) ? value : null, status: "confirmed", basis });
  const U = (value, basis) => ({ value: present(value) ? value : null, status: "unconfirmed", basis });

  // Player
  if (catalogOk) f.player = C(card.player, "Matches the catalog (CardSight).");
  else if (["agreed", "majority"].includes(player.status) && player.agreeing >= 2) f.player = C(card.player, `${player.agreeing} independent reads agree.`);
  else f.player = U(card.player, player.status === "no_agreement" ? "Name reads disagree." : player.status === "single_read" ? "Only one read; not confirmed." : player.status === "one_letter_majority" ? "Reads differ by a letter." : "Not readable.");

  // Year (the product year; the copyright line may show the next year, e.g. a 2025 set released in 2026)
  const readList = years.reads.map((r) => `${r.year} (${r.by})`).join(", ") || "none";
  if (catalogOk && Number(catalog.match?.year) === Number(card.year)) f.year = C(card.year, "Matches the catalog (CardSight).");
  else if (product && productYearConfirmed) f.year = C(product.year, `${years.closeup ? "Zoomed-in copyright line read twice:" : `Copyright read${ysup.fit > 1 ? "s" : ""}`} ${ysup.fitYears.join(", ")} fit the ${product.label} (${product.copyrightYears.join(" or ")} copyright).`);
  else if (product) f.year = U(card.year, `Copyright year not confirmed (reads: ${readList}${years.ignored.length ? `; ignored ${years.ignored.join(", ")} as earlier than a year printed on the card` : ""}).`);
  else if (!present(card.year)) f.year = U(null, "Not readable on the card.");
  else f.year = U(card.year, "No catalog/checklist for this product yet.");

  // Set (product + subset)
  const setText = [card.brand, card.set].filter(present).join(" ");
  if (catalogOk) f.set = C(setText, "Matches the catalog (CardSight).");
  else if (product && productYearConfirmed) f.set = C(`${product.label}${sub && sub.status === "matched" ? ` — ${sub.subset.label}` : ""}`, route === "logo"
    ? `No set name printed; 2+ of 3 checks matched the ${product.label} logo, the card number fits ${sub?.subset.label || "its numbering"}, and the copyright year fits (${product.sources.length} sources).`
    : `Matches the ${product.label} checklist (${product.sources.length} sources).`);
  else if (product) f.set = U(card.set ? setText : null, `Probably ${product.label}${route === "logo" ? " (logo + card number)" : ""}, but the copyright year was not confirmed.`);
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
    probable: () => U(null, par.tiebreakAgreed === false
      ? `Probably ${par.parallel.name}; the two closer looks disagreed (other: ${par.tiebreakSecond || "unsure"}). Could be: ${par.candidates.map((c) => c.name).join(", ")}.`
      : `Probably ${par.parallel.name}, but the serial/print run was not confirmed.`),
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

// Year reads from the three checks. A copyright year earlier than a year printed on the card
// (draft line, bio) is impossible and is ignored.
function yearEvidence(main, A, B, closeup) {
  const y = (v) => { const m = String(v ?? "").match(/\b(19|20)\d\d\b/); return m ? Number(m[0]) : null; };
  const events = (A.eventYears || []).map(y).filter((v) => v && v <= new Date().getFullYear() + 1);
  const latestEvent = events.length ? Math.max(...events) : null;
  const photo = [
    { by: "main scan", year: y(main.evidence?.copyrightLineText) || y(main.year) },
    { by: "check A", year: y(A.copyrightYearSeen) },
    { by: "check B", year: y(B.copyrightYearText) },
  ].filter((r) => r.year);
  const close = (closeup?.reads || []).map((r) => ({ by: r.by, year: y(r.year) })).filter((r) => r.year);
  const possible = (r) => !(latestEvent && r.year < latestEvent);
  // Two agreeing reads of the enlarged copyright crop outrank reads of the whole photo.
  const closeAgree = close.length === 2 && close[0].year === close[1].year && possible(close[0]);
  const reads = closeAgree ? close : [...photo, ...close];
  const ignored = reads.filter((r) => !possible(r)).map((r) => `${r.year} (${r.by})`);
  const valid = reads.filter(possible);
  const superseded = closeAgree ? photo.filter((r) => r.year !== close[0].year).map((r) => `${r.year} (${r.by})`) : [];
  return { reads, valid, ignored, superseded, latestEvent, closeup: closeAgree ? close[0].year : null, closeupStatus: closeup?.status || null, closeupFallback: closeup?.usedFallback || false };
}

function yearSupport(p, years) {
  const fits = years.valid.filter((r) => p.year === r.year || (p.copyrightYears || [p.year]).includes(r.year));
  return { fit: fits.length, against: years.valid.length - fits.length, fitYears: [...new Set(fits.map((r) => r.year))] };
}
