import formidable from "formidable";
import fs from "fs";

export const config = {
  api: { bodyParser: false },
};

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      multiples: true,
      keepExtensions: true,
      maxFileSize: 25 * 1024 * 1024,
    });

    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

function getFile(files, name) {
  const file = files[name];
  if (!file) return null;
  return Array.isArray(file) ? file[0] : file;
}

function fileToDataUrl(file) {
  if (!file || !file.filepath) return "";

  let mimeType = file.mimetype || "image/jpeg";

  if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    mimeType = "image/jpeg";
  }

  const base64 = fs.readFileSync(file.filepath).toString("base64").replace(/\s/g, "");

  return `data:${mimeType};base64,${base64}`;
}

function getField(text, fieldName) {
  const regex = new RegExp(`${fieldName}:\\s*(.*)`, "i");
  const match = text.match(regex);
  return match ? match[1].replace(/["]/g, "").trim() : "";
}

function cleanValue(value) {
  if (!value) return "";
  const bad = ["unknown", "n/a", "none", "no", "not visible"];
  const cleaned = value.trim();
  return bad.includes(cleaned.toLowerCase()) ? "" : cleaned;
}

function buildSoldCompQuery(scanText) {
  const player = cleanValue(getField(scanText, "Player"));
  const year = cleanValue(getField(scanText, "Year"));
  const brand = cleanValue(getField(scanText, "Brand / Set"));
  const cardNumber = cleanValue(getField(scanText, "Card Number"));
  const parallel = cleanValue(getField(scanText, "Parallel / Insert"));
  const numbered = cleanValue(getField(scanText, "Numbered"));

  const parts = [
    year,
    brand,
    player,
    cardNumber ? `#${cardNumber.replace("#", "")}` : "",
    parallel,
    numbered,
  ];

  return parts
    .filter(Boolean)
    .join(" ")
    .replace(/\bunknown\b/gi, "")
    .replace(/\bno patch\b/gi, "")
    .replace(/\bnot numbered\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function build130PointUrl(query) {
  return `https://130point.com/sales/?search=${encodeURIComponent(query)}`;
}

function cleanAiText(text) {
  return text
    .replace(/BACK OF CARD SCANNED SUCCESSFULLY/gi, "")
    .replace(/COPY SOLD COMP SEARCH:/gi, "")
    .replace(/REAL SOLD COMPS:/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchSoldComps(query) {
  try {
    const url = build130PointUrl(query);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const html = await response.text();

    const priceMatches = [...html.matchAll(/\$[\d,]+(?:\.\d{2})?/g)]
      .map((m) => m[0])
      .slice(0, 8);

    if (!priceMatches.length) {
      return {
        url,
        summary: "No prices auto-pulled yet. Use the 130point link below.",
      };
    }

    return {
      url,
      summary: priceMatches.join(" | "),
    };
  } catch {
    return {
      url: build130PointUrl(query),
      summary: "Sold prices could not auto-load. Use the 130point link below.",
    };
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ results: "Use POST only." });
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.SPECIAL_API_KEY;

    if (!apiKey) {
      return res.status(200).json({
        results: "Missing OpenAI API key in Vercel.",
      });
    }

    const { files } = await parseForm(req);

    const frontFile =
      getFile(files, "front") ||
      getFile(files, "image") ||
      getFile(files, "card");

    const backFile = getFile(files, "back");

    const imageBase64 = fileToDataUrl(frontFile);
    const backImageBase64 = fileToDataUrl(backFile);

    if (!imageBase64) {
      return res.status(200).json({
        results: "No front card image received.",
      });
    }

    const prompt = `
You are a sports card identification assistant for Koollicks Vault.

CRITICAL RULES:
- ONLY use visible card details from the uploaded image/images.
- Do NOT use player memory, rookie-year memory, checklist memory, or internet knowledge.
- The BACK image is the source of truth for year, copyright date, card number, set name, and player spelling.
- The FRONT image is the source of truth for autograph, patch, rookie logo, color, and parallel.
- If something is not clearly visible, write Unknown.
- Do NOT invent sold prices.
- Estimated Value Range must say: Needs sold comp lookup.
- Keep search phrases clean and short.
- Do NOT repeat sections.
- Do NOT add extra notes after First Comment.

UNLICENSED / EDGE BRAND RULE:
If the card appears to be Wild Card, Leaf, Sage, Onyx, Bowman U, NIL, college-only, custom, or unlicensed:
- Do NOT force Panini, Prizm, Mosaic, Absolute, Donruss, or Select.
- Use the visible brand if readable.
- If not readable, write Unknown or Unlicensed.
- Confidence should be Low or Medium unless brand text is clearly visible.

Return this exact format:

Possible Matches:
1. [year] [brand/set] [player] [parallel/insert] [numbering if visible] - Confidence: [High/Medium/Low]

Best Guess:
Player:
Year:
Brand / Set:
Card Number:
Parallel / Insert:
Rookie Card:
Auto / Patch:
Numbered:
Condition Estimate:
Confidence:
Suggested eBay Search:
Suggested 130point Search:
Estimated Value Range: Needs sold comp lookup.
Listing Title:
TikTok Caption:
Hashtags:
First Comment:
`;

    const content = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: imageBase64 } },
    ];

    if (backImageBase64) {
      content.push({ type: "image_url", image_url: { url: backImageBase64 } });
    }

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content:
              "You identify sports cards from images only. Be conservative. Never invent missing details.",
          },
          {
            role: "user",
            content,
          },
        ],
        max_tokens: 900,
      }),
    });

    const data = await aiResponse.json();

    if (!aiResponse.ok) {
      return res.status(200).json({
        results: "OpenAI error: " + JSON.stringify(data),
      });
    }

    const aiText = cleanAiText(
      data?.choices?.[0]?.message?.content || "AI could not read this card."
    );

    const soldCompQuery =
      cleanValue(getField(aiText, "Suggested 130point Search")) ||
      buildSoldCompQuery(aiText);

    const comps = await fetchSoldComps(soldCompQuery);

    const finalResults =
      aiText +
      "\n\n✅ BACK OF CARD SCANNED SUCCESSFULLY" +
      "\n\n🔎 COPY SOLD COMP SEARCH:\n" +
      soldCompQuery +
      "\n\n💰 AUTO-PULLED SOLD PRICE HITS:\n" +
      comps.summary +
      "\n\n🔗 REAL SOLD COMPS LINK:\n" +
      comps.url;

    return res.status(200).json({
      results: finalResults,
    });
  } catch (error) {
    return res.status(200).json({
      results: "AI scan failed: " + error.message,
    });
  }
}
