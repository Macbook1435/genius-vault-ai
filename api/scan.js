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
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ results: "Use POST only." });
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.SPECIAL_API_KEY;

    if (!apiKey) {
      return res.status(200).json({ results: "Missing OpenAI API key in Vercel." });
    }

    const { files } = await parseForm(req);

    const frontFile = getFile(files, "front") || getFile(files, "image") || getFile(files, "card");
    const backFile = getFile(files, "back");

    const imageBase64 = fileToDataUrl(frontFile);
    const backImageBase64 = fileToDataUrl(backFile);
console.log("FRONT DATA URL START:", imageBase64.slice(0, 40));
console.log("BACK DATA URL START:", backImageBase64.slice(0, 40));
console.log("BACK EXISTS:", !!backFile);
    if (!imageBase64) {
      return res.status(200).json({ results: "No front card image received." });
    }

    const prompt = `
You are a sports card identification assistant for Koollicks Vault.

CRITICAL RULES:
- NEVER use prior sports card knowledge, checklist memory, rookie-year memory, or known player data to identify the card.
- ONLY use text and details physically visible in the uploaded images.
- Treat the images as the ONLY source of truth.
- If the back image shows a year or card number, you MUST use that exact visible value.
- Do not replace visible values with known rookie card information.
- If text is not clearly visible, write Unknown.
- Use the BACK image as source of truth for year, copyright date, card number, set name, and player spelling.
- Do NOT use player career years, rookie season, stats, or biography as the card year.
- Card year must come from copyright/set text on the card.
- Use the FRONT image for patch, autograph, parallel, color, rookie logo, and visual card design.
- If front and back conflict, trust the back for year/set/card number.
- Do NOT invent eBay sold prices.
- If the back image clearly shows a copyright year, card number, or set name, you MUST use those exact values even if they conflict with known rookie-year data or player memory.
- Estimated Value Range must say: Needs sold comp lookup.
- Suggested eBay Search and Suggested 130point Search should be clean search phrases only.

UNLICENSED / EDGE BRAND RULE:
If the card appears to be Wild Card, Leaf, Sage, Onyx, Bowman U, NIL, college-only, custom, or unlicensed:
- Do NOT force Panini, Prizm, Mosaic, Absolute, Donruss, or Select.
- Use the visible brand if readable.
- If not readable, write Unknown or Unlicensed.
- Confidence should be low or medium unless the brand is clearly visible.

Return this exact format:

Possible Matches:
1. [year] [brand/set] [player] [parallel/insert] [numbering if visible] - Confidence: [high/medium/low]
2. [year] [brand/set] [player] [parallel/insert] [numbering if visible] - Confidence: [high/medium/low]
3. [year] [brand/set] [player] [parallel/insert] [numbering if visible] - Confidence: [high/medium/low]

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
              "You identify sports cards from images. Be conservative. Never invent missing details.",
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

    const text = data?.choices?.[0]?.message?.content || "AI could not read this card.";
    return res.status(200).json({ results: text });
  } catch (error) {
    return res.status(200).json({
      results: "AI scan failed: " + error.message,
    });
  }
}
