export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ results: "Use POST only." });
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.SPECIAL_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ results: "Missing OpenAI API key in Vercel." });
    }

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

   const body = JSON.parse(buffer.toString() || "{}")
const imageBase64 = body.imageBase64 || ""

if (!imageBase64) {
  return res.status(400).json({ results: "No card image received." })
}

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a sports card identification and pricing assistant for Koollicks Vault. Identify only what is visible. Do not guess Jahmyr Gibbs unless the card actually says Jahmyr Gibbs."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Identify this sports card. Return this exact format:

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
TikTok Caption:
Hashtags:`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 700
      })
    });

    const data = await aiResponse.json();
    const text = data.choices?.[0]?.message?.content || "AI could not read this card.";

    return res.status(200).json({ results: text });

  } catch (error) {
    return res.status(500).json({ results: "AI scan failed: " + error.message });
  }
}
