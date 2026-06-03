import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,
  },
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

  if (
    mimeType !== "image/jpeg" &&
    mimeType !== "image/png" &&
    mimeType !== "image/webp"
  ) {
    mimeType = "image/jpeg";
  }

  const base64 = fs
    .readFileSync(file.filepath)
    .toString("base64")
    .replace(/\s/g, "");

  return `data:${mimeType};base64,${base64}`;
}

function getField(text, fieldName) {
  const regex = new RegExp(`${fieldName}:\\s*(.*)`, "i");
  const match = text.match(regex);
  return match ? match[1].trim() : "";
}

function buildSoldCompQuery(scanText) {
  const player = getField(scanText, "Player");
  const year = getField(scanText, "Year");
  const brand = getField(scanText, "Brand / Set");
  const cardNumber = getField(scanText, "Card Number");
  const parallel = getField(scanText, "Parallel / Insert");
  const numbered = getField(scanText, "Numbered");

  return [
    year,
    brand,
    player,
    cardNumber ? `#${cardNumber}` : "",
    parallel,
    numbered,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function build130PointUrl(query) {
  return `https://130point.com/sales/?search=${encodeURIComponent(query)}`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        results: "Use POST only.",
      });
    }

    const apiKey =
      process.env.OPENAI_API_KEY ||
      process.env.SPECIAL_API_KEY;

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

    console.log(
      "FRONT DATA URL START:",
      imageBase64.slice(0, 40)
    );

    console.log(
      "BACK DATA URL START:",
      backImageBase64.slice(0, 40)
    );

    console.log("BACK EXISTS:", !!backFile);

    if (!imageBase64) {
      return res.status(200).json({
        results: "No front card image received.",
      });
    }

    const prompt = `
You are a sports card identification assistant for Koollicks Vault.

CRITICAL RULES:
- NEVER use prior sports card knowledge.
- ONLY use text/details visible in uploaded images.
- Treat images as ONLY source of truth.
- If back image shows year/card number, use exact visible value.
- If text not visible, write Unknown.
- Use BACK image for year, card number, set name.
- Use FRONT image for parallel/color/rookie/logo/design.
- Only label Patch if actual fabric/material visible.
- If no visible fabric, write No Patch.
- Do NOT invent sold prices.
- Estimated Value Range must say:
Needs sold comp lookup.

UNLICENSED / EDGE BRAND RULE:
- Do NOT force Panini/Prizm/Mosaic/etc.
- Use visible brand only.
- If unreadable, write Unknown or Unlicensed.

Return this exact format:

Possible Matches:
1. [year] [brand/set] [player] [parallel/insert] [numbering if visible] - Confidence: [high/medium/low]

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
      {
        type: "text",
        text: prompt,
      },
      {
        type: "image_url",
        image_url: {
          url: imageBase64,
        },
      },
    ];

    if (backImageBase64) {
      content.push({
        type: "image_url",
        image_url: {
          url: backImageBase64,
        },
      });
    }

    const aiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
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
                "You identify sports cards from images. Never invent details.",
            },
            {
              role: "user",
              content,
            },
          ],
          max_tokens: 900,
        }),
      }
    );

    const data = await aiResponse.json();

    if (!aiResponse.ok) {
      return res.status(200).json({
        results:
          "OpenAI error: " +
          JSON.stringify(data),
      });
    }

    const text =
      data?.choices?.[0]?.message?.content ||
      "AI could not read this card.";

    const soldCompQuery =
      buildSoldCompQuery(text);

    const soldCompUrl =
      build130PointUrl(soldCompQuery);

    const finalResults =
      text +
      "\n\nBACK OF CARD SCANNED SUCCESSFULLY" +
      "\n\nREAL SOLD COMPS:\n" +
      soldCompUrl;

    return res.status(200).json({
      results: finalResults,
    });
  } catch (error) {
    return res.status(200).json({
      results:
        "AI scan failed: " + error.message,
    });
  }
}
