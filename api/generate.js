export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ result: "Method not allowed" });
  }

  try {
    const {
      player,
      year,
      brand,
      parallel,
      condition,
      numbered,
      price,
      mode
    } = req.body;

    const prompt = `
Create a strong sports card listing.

Player: ${player}
Year: ${year}
Brand/Set: ${brand}
Parallel/Insert: ${parallel}
Condition: ${condition}
Numbered: ${numbered}
Price Paid: ${price}
Platform: ${mode}

Include:
- strong title
- platform-ready description
- 5 hashtags
- first comment
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    const data = await response.json();

    const result =
      data.choices?.[0]?.message?.content || "No AI response received.";

    return res.status(200).json({ result });

  } catch (error) {
    return res.status(500).json({ result: "AI backend error." });
  }
}
