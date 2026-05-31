export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ results: "Use POST only." });
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.SPECIAL_API_KEY;

    if (!apiKey) {
      return res.status(200).json({ results: "Missing OpenAI API key in Vercel." });
    }

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const contentType = req.headers["content-type"] || "";
    let imageBase64 = "";

    if (contentType.includes("multipart/form-data")) {
      const boundary = "--" + contentType.split("boundary=")[1];
      const parts = buffer.toString("latin1").split(boundary);
      const const fileParts = parts.filter(p => p.includes("filename="));
const filePart = fileParts[0];
const backFilePart = fileParts[1];
      if (filePart) {
        const start = filePart.indexOf("\r\n\r\n");
        const raw = filePart
          .slice(start + 4)
          .replace(/\r\n--$/, "")
          .replace(/\r\n$/, "");

        imageBase64 = Buffer.from(raw, "latin1").toString("base64");
      }
      let backImageBase64 = "";

if (backFilePart) {
  const backStart = backFilePart.indexOf("\r\n\r\n");
  const backRaw = backFilePart
    .slice(backStart + 4)
    .replace(/\r\n--$/, "")
    .replace(/\r\n$/, "");

  backImageBase64 = Buffer.from(backRaw, "latin1").toString("base64");
}
    }

    if (!imageBase64) {
      return res.status(200).json({ results: "No card image received." });
    }

    const prompt = `Identify this sports card.
    If the back of the card clearly shows a year, copyright date, card number, or set name, trust the back of the card over visual guessing from the front. Never invent earlier years if the back explicitly shows the correct year.
    If the card appears to be unlicensed, custom, Wild Card, Leaf, Sage, Onyx, college-only, NIL, or does not clearly show a licensed brand logo, DO NOT guess Panini, Prizm, Mosaic, Absolute, or other major sets. Instead mark Brand/Set as "Unknown or Unlicensed" and set Confidence to low.
    Return this exact format:

Possible Matches:
1. [year] [brand/set] [player] [parallel/insert] [numbering if visible] - Confidence: [high/medium/low]
2. [year] [brand/set] [player] [parallel/insert] [numbering if visible] - Confidence: [high/medium/low]
3. [year] [brand/set] [player] [parallel/insert] [numbering if visible] - Confidence: [high/medium/low]

Best Guess:
Player:
Year:
Brand / Set:
Parallel / Insert:
Rookie Card:
Auto / Patch:
Numbered:
Condition Estimate:
Suggested eBay Search:
Suggested 130point Search:
Estimated Value Range:
Listing Title:
TikTok Caption: Write a long viral TikTok caption between 120-180 words with collector hype, card details, investment potential, fan engagement, and a strong call to action.
Hashtags:`;

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: "You are a sports card identification and pricing assistant for Koollicks Vault. Identify only what is visible."
      },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },

          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`
            }
          },

          ...(backImageBase64 ? [{
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${backImageBase64}`
            }
          }] : [])
        ]
      }
    ],
    max_tokens: 700
  })
});

    const data = await aiResponse.json();

    if (!aiResponse.ok) {
      return res.status(200).json({ results: JSON.stringify(data) });
    }

    const text = data.choices[0].message.content || "AI could not read this card.";
    return res.status(200).json({ results: text });

  } catch (error) {
    return res.status(200).json({ results: "AI scan failed: " + error.message });
  }
}
