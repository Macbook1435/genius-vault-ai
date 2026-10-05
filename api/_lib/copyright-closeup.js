// Pipeline v2 only: read the copyright year from a zoomed-in crop of the card back.
// Step 1: a quick AI call finds where the copyright line is (a box, as fractions of the image).
// Step 2: that area is cut out and enlarged here (no AI), so the tiny digits become large.
// Step 3: two independent AI reads copy the year from the enlarged crop.
// Any failure returns { reads: [] } and the pipeline carries on without it.

const LOCATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    found: { type: "boolean" },
    x0: { type: "number" }, y0: { type: "number" }, x1: { type: "number" }, y1: { type: "number" },
    vertical: { type: "boolean" },
  },
  required: ["found", "x0", "y0", "x1", "y1", "vertical"],
};

const READ_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    lineText: { type: ["string", "null"] },
    copyrightYearText: { type: ["string", "null"] },
  },
  required: ["lineText", "copyrightYearText"],
};

const LOCATE_PROMPT = `This is the BACK of a trading card (it may be in a plastic holder, on a table).
Find the copyright line: tiny print that starts with "©" (often followed by the year and the maker, e.g. "© 20xx THE ... COMPANY"), usually near the bottom edge of the card.
Give its box as fractions of the WHOLE image (0 = left/top, 1 = right/bottom): x0, y0 (top-left) and x1, y1 (bottom-right). Make the box a little larger than the text.
vertical = true if the line runs up/down the side instead of across.
If you cannot find it, found = false and all numbers 0.`;

const READ_PROMPT = `This is an enlarged crop of the copyright line from the back of a trading card.
Copy the line as printed into lineText, then copy ONLY the 4-digit year that follows "©" into copyrightYearText, digit by digit (3, 5, 6 and 8 can look alike: look at each digit's shape). Do not use any other number. Null if the year is not readable.`;

const clamp = (v) => Math.max(0, Math.min(1, Number(v) || 0));

/** Cut out and enlarge a box (fractions of the image). Returns a JPEG data URL. */
export async function cropAndEnlarge(dataUrl, box, { padX = 0.04, padY = 0.03, targetWidth = 1800 } = {}) {
  const { Jimp } = await import("jimp");
  const buf = Buffer.from(String(dataUrl).split(",")[1] || "", "base64");
  const img = await Jimp.read(buf);
  const W = img.bitmap.width;
  const H = img.bitmap.height;
  const x0 = clamp(Math.min(box.x0, box.x1) - padX);
  const x1 = clamp(Math.max(box.x0, box.x1) + padX);
  const y0 = clamp(Math.min(box.y0, box.y1) - padY);
  const y1 = clamp(Math.max(box.y0, box.y1) + padY);
  const w = Math.max(8, Math.round((x1 - x0) * W));
  const h = Math.max(8, Math.round((y1 - y0) * H));
  img.crop({ x: Math.round(x0 * W), y: Math.round(y0 * H), w: Math.min(w, W - Math.round(x0 * W)), h: Math.min(h, H - Math.round(y0 * H)) });
  if (box.vertical) img.rotate(90);
  const scale = Math.min(6, Math.max(1, targetWidth / img.bitmap.width));
  if (scale > 1) img.resize({ w: Math.round(img.bitmap.width * scale) });
  return img.getBase64("image/jpeg", { quality: 92 });
}

/**
 * @param backImage data URL of the card back
 * @param askVision the scanner's AI helper ({ model, prompt, name, schema, frontImage, maxTokens })
 */
export async function readCopyrightCloseup(backImage, askVision, models) {
  if (!backImage) return { reads: [], status: "no_back" };
  const out = { reads: [], status: "ok", box: null, usedFallback: false };
  try {
    let box = await askVision({ model: models.fast, name: "copyright_locate", schema: LOCATE_SCHEMA, maxTokens: 120, frontImage: backImage, prompt: LOCATE_PROMPT }).catch(() => null);
    const sane = box && box.found && Math.abs(box.x1 - box.x0) > 0.02 && Math.abs(box.y1 - box.y0) > 0.005 && Math.abs(box.y1 - box.y0) < 0.4;
    if (!sane) {
      // Fallback: the bottom third of the photo, where copyright lines usually are.
      box = { x0: 0.05, y0: 0.66, x1: 0.95, y1: 0.98, vertical: false };
      out.usedFallback = true;
    }
    out.box = { x0: box.x0, y0: box.y0, x1: box.x1, y1: box.y1, vertical: box.vertical };
    const crop = await cropAndEnlarge(backImage, box, out.usedFallback ? { padX: 0, padY: 0, targetWidth: 2000 } : undefined);
    const [a, b] = await Promise.all([
      askVision({ model: models.fast, name: "copyright_read", schema: READ_SCHEMA, maxTokens: 120, frontImage: crop, prompt: READ_PROMPT }).catch(() => null),
      askVision({ model: models.strong, name: "copyright_read", schema: READ_SCHEMA, maxTokens: 120, frontImage: crop, prompt: READ_PROMPT }).catch(() => null),
    ]);
    out.reads = [
      { by: "close-up A", year: a?.copyrightYearText ?? null, line: a?.lineText ?? null },
      { by: "close-up B", year: b?.copyrightYearText ?? null, line: b?.lineText ?? null },
    ];
  } catch (e) {
    out.status = "error";
    out.error = e.message;
  }
  return out;
}
