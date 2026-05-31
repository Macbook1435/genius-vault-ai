import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function parseForm(req) {
  return await new Promise((resolve, reject) => {
    const form = formidable({
      multiples: true,
      keepExtensions: true,
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }

      resolve({ fields, files });
    });
  });
}

export default async function handler(req, res) {
  try {
    const { files } = await parseForm(req);

    const frontFile = files.front?.[0] || files.front;
    const backFile = files.back?.[0] || files.back;

    if (!frontFile) {
      return res.status(400).json({
        error: "Front image missing",
      });
    }

    const frontBase64 = fs
      .readFileSync(frontFile.filepath)
      .toString("base64");

    let backBase64 = null;

    if (backFile) {
      backBase64 = fs
        .readFileSync(backFile.filepath)
        .toString("base64");
    }

    return res.status(200).json({
      success: true,
      frontImage: frontBase64,
      backImage: backBase64,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Upload parser failed",
      details: error.message,
    });
  }
}
