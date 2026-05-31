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
    });

    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

export default async function handler(req, res) {
  try {
    const { files } = await parseForm(req);

    const frontFile = files.front?.[0] || files.front || files.image?.[0] || files.image;
    const backFile = files.back?.[0] || files.back;

    if (!frontFile) {
      return res.status(400).json({ error: "No front image uploaded" });
    }

    const frontBase64 = fs.readFileSync(frontFile.filepath).toString("base64");
   const frontMime = "image/jpeg";

    const content = [
      {
        type: "text",
        text: `Identify this sports card. Return this exact format only:

Player:
Team:
Year:
Brand:
Set:
Parallel/Insert:
Card Number:
Serial Number:
Condition:
Short Description:
TikTok Description:
First Comment:
Hashtags:`
      },
      {
        type: "image_url",
        image_url: {
        url: `data:image/jpeg;base64,${frontBase64.replace(/\s/g, "")}`
        }
      }
    ];

    if (backFile) {
      const backBase64 = fs.readFileSync(backFile.filepath).toString("base64");
      const backMime = "image/jpeg";
      content.push({
        type: "image_url",
        image_url: {
        url: `data:image/jpeg;base64,${backBase64.replace(/\s/g, "")}`  
        }
      });
    }

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content,
          },
        ],
        max_tokens: 900,
      }),
    });

    const data = await aiResponse.json();

    const result =
      data.choices?.[0]?.message?.content ||
      data.error?.message ||
      "AI scan failed";

    return res.status(200).json({
      result,
      scan: result,
      text: result,
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Scan failed",
      details: error.message,
    });
  }
}
