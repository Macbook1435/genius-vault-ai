const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const multer = require("multer");
const app = express();

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const upload = multer({ storage: multer.memoryStorage() });
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
app.post("/api/scan", upload.single("image"), async (req, res) => {
  try {
    const base64Image = req.file.buffer.toString("base64");

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this sports card image. Return JSON with player, year, brand, parallel, condition, and numbered."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ]
    });

    const result = response.choices[0].message.content;

    res.json({
      success: true,
      result
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "AI scan failed"
    });
  }
});
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
