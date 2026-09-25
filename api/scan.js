import formidable from "formidable";
import fs from "fs";
import OpenAI from "openai";
import { hasUsableCardIdentity, scanConfidence, cleanCardField } from "./scan-validation.js";

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
    const front = imageUrl(firstFile(files, "front") || firstFile(files, "image") || firstFile(files, "card"));
    if (!front) return res.status(400).json({ results: "No front card image received." });
    const back = imageUrl(firstFile(files, "back"));
    const content = [{ type: "text", text: `Identify this sports card from visible evidence in the front and optional back images. Read text carefully; use the back to confirm year, set, card number, and serial numbering. Set uncertain fields to null, not guesses. Do not infer a parallel, rookie status, autograph, memorabilia, grade, or serial number without supporting evidence. matchScore reflects confidence in the entire identification, not just the player. If unreadable, use null identity fields and a low score. Give only evidence-supported alternates, or an empty array; explain uncertainty in notes.` },
      { type: "image_url", image_url: { url: front, detail: "high" } }];
    if (back) content.push({ type: "image_url", image_url: { url: back, detail: "high" } });
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content }],
      response_format: { type: "json_schema", json_schema: { name: "sports_card_identification", strict: true, schema: CARD_SCHEMA } },
      max_tokens: 1200
    });
    const message = response.choices?.[0]?.message;
    if (message?.refusal || !message?.content) throw new Error("The card could not be identified.");
    const card = JSON.parse(message.content);
    const alternates = Array.isArray(card.alternates) ? card.alternates.slice(0, 5) : [];
    delete card.alternates;
    const usable = hasUsableCardIdentity(card);
    const confidence = scanConfidence(card);
    const verifiedEnoughToSearch = usable && confidence !== "low";
    const query = verifiedEnoughToSearch ? soldQuery(card) : "";
    const comps = manualComps(query);
    const identity = [card.year, card.brand, card.set, card.player, card.parallel,
      card.cardNumber ? `#${String(card.cardNumber).replace(/^#/, "")}` : null].filter(Boolean).join(" " );
    const readoutSummary = !verifiedEnoughToSearch
      ? "Could not identify this card reliably. Try a clearer front photo and add the back. Verify all details manually."
      : `${identity}. AI identification requires verification. No verified sold prices were auto-loaded; check matching sold listings manually.`;
    return res.status(200).json({
      results: verifiedEnoughToSearch ? "Scan completed; verify details." : "Scan needs manual verification.",
      scan: verifiedEnoughToSearch ? card : null, confidence, comps, readoutSummary, alternates: verifiedEnoughToSearch ? alternates : [],
      soldComps: { query, url: comps.searchUrl, summary: "No verified prices auto-pulled. Check exact sold matches manually." }
    });
  } catch (err) {
    console.error("scan error:", err);
    return res.status(500).json({ results: "Scan failed.", error: err?.message || String(err) });
  }
}
