const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/generate", async (req, res) => {
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
Create a ${mode} sports card listing.

Player: ${player}
Year: ${year}
Brand: ${brand}
Parallel: ${parallel}
Condition: ${condition}
Numbered: ${numbered}
Price: ${price}

Include:
- Strong title
- Engaging description
- 5 hashtags
- First comment
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    res.json({
      result: completion.choices[0].message.content,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Something went wrong",
    });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
