import formidable from "formidable";
import fs from "fs";
import OpenAI from "openai";
import { hasUsableCardIdentity, cleanCardField } from "./scan-validation.js";
import { cardsightConfigured, cardsightIdentify, resolveParallel, cardsightSoldComps } from "./cardsight.js";

export const config = { api: { bodyParser: false } };

const fields = {
  player: { type: ["string", "null"] }, year: { type: ["integer", "null"] },
  brand: { type: ["string", "null"] }, set: { type: ["string", "null"] },
  cardNumber: { type: ["string", "null"] }, parallel: { type: ["string", "null"] },
  rookie: { type: "boolean" }, team: { type: ["string", "null"] },
  serialNumber: { type: ["string", "null"] }, numberedTo: { type: ["integer", "null"] },
  autograph: { type: "boolean" }, memorabilia: { type: "boolean" },
  gradingCompany: { type: ["string", "null"] }, grade: { type: ["string", "null"] },
  notes: { type: "string" }, matchScore: { type: "number", minimum: 0, maximum: 1 },
  alternates: { type: "array", items: {
    type: "object", additionalProperties: false,
    properties: { player: { type: ["string", "null"] }, year: { type: ["integer", "null"] },
      brand: { type: ["string", "null"] }, set: { type: ["string", "null"] },
      cardNumber: { type: ["string", "null"] }, parallel: { type: ["string", "null"] },
      reason: { type: "string" }, matchScore: { type: "number", minimum: 0, maximum: 1 } },
    required: ["player", "year", "brand", "set", "cardNumber", "parallel", "reason", "matchScore"]
  } }
};
const CARD_SCHEMA = { type: "object", additionalProperties: false, properties: fields, required: Object.keys(fields) };

function parseForm(req) {
  return new Promise((resolve, reject) => {
    formidable({ multiples: true, maxFileSize: 25 * 1024 * 1024 }).parse(req, (err, unused, files) =>
      err ? reject(err) : resolve(files));
  });
}
function firstFile(files, name) { const file = files[name]; return Array.isArray(file) ? file[0] : file || null; }
function imageUrl(file) {
  if (!file?.filepath) return "";
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) throw new Error("Upload a JPEG, PNG, or WebP image.");
  return `data:${file.mimetype};base64,${fs.readFileSync(file.filepath).toString("base64")}`;
}
function soldQuery(card) {
  return [card.year, cleanCardField(card.brand), cleanCardField(card.set), cleanCardField(card.player),
    cleanCardField(card.cardNumber) ? `#${cleanCardField(card.cardNumber).replace(/^#/, "")}` : "",
    cleanCardField(card.parallel), card.numberedTo ? `/${card.numberedTo}` : "",
    card.autograph ? "auto" : "", cleanCardField(card.gradingCompany), cleanCardField(card.grade)]
    .filter(Boolean).join(" " );
}
function manualComps(query) {
  const searchUrl = query ? `https://130point.com/sales/?search=${encodeURIComponent(query)}` : null;
  return { min: null, max: null, median: null, count: 0, currency: "USD", items: [],
    source: "manual_verification_required", url: searchUrl, searchUrl,
    error: "No verified sold prices auto-loaded. Check exact card matches manually." };
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ results: "Use POST only." }); }
  const apiKey = process.env.OPENAI_API_KEY || process.env.SPECIAL_API_KEY;
  if (!apiKey) return res.status(500).json({ results: "Missing OpenAI API key in Vercel." });
  try {
    const files = await parseForm(req);
    const frontFile = firstFile(files, "front") || firstFile(files, "image") || firstFile(files, "card");
    const front = imageUrl(frontFile);
    if (!front) return res.status(400).json({ results: "No front card image received." });
    const back = imageUrl(firstFile(files, "back"));
    const content = [{ type: "text", text: `Identify this sports card from visible evidence in the front and optional back images. Read printed card text carefully; use the back to confirm year, set, card number, and serial numbering. Ignore anything handwritten or on a sleeve, toploader, sticker, or holder (for example a price like "3.5" written on a penny sleeve) - that is never an autograph, serial number, or grade. Only mark autograph true if an on-card or sticker signature is clearly visible on the card itself. Set uncertain fields to null, not guesses. Do not infer a parallel, rookie status, memorabilia, grade, or serial number without supporting evidence. If the card shows a colored or patterned finish you cannot name with certainty, set parallel to null and describe it in notes. If unreadable, use null identity fields and a low score. Give only evidence-supported alternates, or an empty array.` },
      { type: "image_url", image_url: { url: front, detail: "high" } }];
    if (back) content.push({ type: "image_url", image_url: { url: back, detail: "high" } });
    const client = new OpenAI({ apiKey });
    const aiPromise = client.chat.completions.create({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content }],
      response_format: { type: "json_schema", json_schema: { name: "sports_card_identification", strict: true, schema: CARD_SCHEMA } },
      max_tokens: 1200
    });
    const csPromise = cardsightConfigured()
      ? cardsightIdentify(fs.readFileSync(frontFile.filepath), frontFile.mimetype).catch(err => ({ error: err.message }))
      : Promise.resolve({ error: "CardSight is not configured on this deployment." });
    const [response, cs] = await Promise.all([aiPromise, csPromise]);
    const message = response.choices?.[0]?.message;
    if (message?.refusal || !message?.content) throw new Error("The card could not be identified.");
    const ai = JSON.parse(message.content);
    const alternates = Array.isArray(ai.alternates) ? ai.alternates.slice(0, 5) : [];
    delete ai.alternates;

    const det = cs?.detection;
    const csCard = det?.card || null;
    const catalogMatch = Boolean(csCard?.id && csCard?.name);
    const warnings = [];
    if (cs?.error) warnings.push(`Catalog check unavailable: ${cs.error}`);
    let card, identityConfidence, parallelInfo = { status: "not_checked", parallel: null, candidates: [] };

    if (catalogMatch) {
      // Identity comes from the CardSight catalog record, not the vision model's guess.
      parallelInfo = resolveParallel(csCard);
      const attrs = (csCard.attributes || []).map(a => String(a).toLowerCase());
      const grading = det.grading || null;
      card = {
        player: csCard.name, year: csCard.year ? Number(csCard.year) : null, brand: csCard.manufacturer || null,
        set: [csCard.releaseName, csCard.setName && !/^base( set)?$/i.test(csCard.setName) ? csCard.setName : null].filter(Boolean).join(" ") || null,
        cardNumber: csCard.number || null, parallel: parallelInfo.parallel?.name || null,
        rookie: attrs.some(a => a.includes("rookie") || a === "rc"), autograph: attrs.some(a => a.includes("auto")),
        memorabilia: attrs.some(a => /relic|memorabilia|patch|jersey/.test(a)), team: ai.team || null,
        serialNumber: null, numberedTo: parallelInfo.parallel?.numberedTo || csCard.numberedTo || null,
        gradingCompany: grading?.company?.name || null, grade: grading?.grade?.value || null,
        notes: ai.notes || "", catalogCardId: csCard.id
      };
      identityConfidence = det.confidence === "High" ? "high" : det.confidence === "Medium" ? "medium" : "low";
      const aiPlayer = cleanCardField(ai.player).toLowerCase();
      if (aiPlayer && !csCard.name.toLowerCase().split(/\s+/).some(w => w.length > 2 && aiPlayer.includes(w))) {
        warnings.push(`Vision read "${ai.player}" but catalog matched "${csCard.name}". Verify the player.`);
        identityConfidence = "low";
      }
      if (ai.year && card.year && ai.year !== card.year) warnings.push(`Vision model guessed ${ai.year}; catalog says ${card.year}. Catalog year used.`);
      if (ai.autograph && !card.autograph) warnings.push("Vision model suggested an autograph, but the catalog card is not an autograph card. Auto removed.");
      if (parallelInfo.status === "uncertain") warnings.push("Parallel not confirmed. Pick the matching parallel before listing or pricing.");
      if (parallelInfo.status === "none_detected") warnings.push("No parallel detected. Confirm this is the base card (check for colored/patterned finishes).");
    } else {
      // No exact catalog match: keep only what the vision model saw, and never report high confidence.
      card = { ...ai, year: null, autograph: false, parallel: null, serialNumber: null, numberedTo: null };
      identityConfidence = hasUsableCardIdentity(ai) && Number(ai.matchScore) >= 0.6 ? "medium" : "low";
      warnings.push("No exact catalog match. Year, parallel, and autograph are not verified and were left blank.");
    }
    // Overall confidence can only be high when the identity AND the parallel are both confirmed.
    const confidence = identityConfidence === "high" && parallelInfo.status !== "confirmed" ? "medium" : identityConfidence;
    const usable = confidence !== "low" && hasUsableCardIdentity(card);

    let comps;
    const query = usable ? soldQuery(card) : "";
    if (usable && catalogMatch && parallelInfo.status !== "uncertain") {
      try {
        const gradeId = card.gradingCompany ? det.grading?.grade?.id : "null";
        if (!gradeId) throw new Error("Graded slab detected but grade could not be matched to the catalog.");
        comps = await cardsightSoldComps(csCard.id, { parallelId: parallelInfo.parallel?.id || "null", gradeId });
        comps.basis = `${card.gradingCompany ? `${card.gradingCompany} ${card.grade}` : "Raw"} ${parallelInfo.parallel ? parallelInfo.parallel.name : "base"} - completed auctions, last 6 months`;
        comps.searchUrl = query ? `https://130point.com/sales/?search=${encodeURIComponent(query)}` : null;
        if (!comps.count) comps.error = "No completed auction sales found for this exact card in the last 6 months.";
      } catch (err) { comps = { ...manualComps(query), error: `Sold comps unavailable: ${err.message}` }; }
    } else {
      comps = { ...manualComps(query), error: parallelInfo.status === "uncertain"
        ? "Sold prices withheld until the parallel is confirmed (parallels sell for very different prices)."
        : "No verified sold prices: card is not an exact catalog match." };
    }

    const identity = [card.year, card.brand, card.set, card.player, card.parallel,
      card.cardNumber ? `#${String(card.cardNumber).replace(/^#/, "")}` : null].filter(Boolean).join(" ");
    const readoutSummary = !usable
      ? "Could not identify this card reliably. Try a clearer front photo and add the back. Verify all details manually."
      : `${identity}. ${catalogMatch ? "Matched to CardSight catalog." : "AI read only - not catalog-verified."}`;
    return res.status(200).json({
      results: usable ? "Scan completed; verify details." : "Scan needs manual verification.",
      scan: usable ? card : null, confidence, identityConfidence, catalogMatch,
      parallelStatus: parallelInfo.status, parallelCandidates: parallelInfo.candidates, warnings,
      comps, readoutSummary, alternates: usable && !catalogMatch ? alternates : [],
      soldComps: { query, url: comps.searchUrl, summary: comps.count ? `${comps.count} completed auction sales, median $${comps.median}` : comps.error }
    });
  } catch (err) {
    console.error("scan error:", err);
    return res.status(500).json({ results: "Scan failed.", error: err?.message || String(err) });
  }
}
