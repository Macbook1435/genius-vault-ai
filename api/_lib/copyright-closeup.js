// Pipeline v2 only: read the copyright year from a zoomed-in crop of the card back.
// The back photo is cut into overlapping horizontal slices that are enlarged here (no AI), so
// the tiny digits become large. Two independent AI reads (fast + strong model) then find the
// "©" line in the slices and copy its year. A read counts only if its line contains "©".
// Any failure returns { reads: [] } and the pipeline carries on without it.





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

const STRIPS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    slice: { type: ["integer", "null"] },
    lineText: { type: ["string", "null"] },
    copyrightYearText: { type: ["string", "null"] },
  },
  required: ["slice", "lineText", "copyrightYearText"],
};

const STRIPS_PROMPT = (n) => `These ${n} images are enlarged, overlapping horizontal slices of ONE photo of the back of a trading card, in order from top (slice 1) to bottom (slice ${n}).
Find the copyright line: tiny print starting with "©", followed by a year and the card maker's name.
- slice: the number of the slice where you can read it best.
- lineText: the line exactly as printed in that slice.
- copyrightYearText: ONLY the 4-digit year right after "©", digit by digit (3, 5, 6 and 8 can look alike: look at each digit's shape).
Copy only what is printed in these images. If there is no copyright line or you cannot read the year, use null for all three.`;

// Horizontal slices covering the whole photo (25% tall, overlapping), each enlarged.
const SLICES = [[0, 0.25], [0.19, 0.44], [0.38, 0.63], [0.56, 0.81], [0.75, 1]];

/**
 * @param backImage data URL of the card back
 * @param askVision the scanner's AI helper ({ model, prompt, name, schema, frontImage, images, maxTokens })
 */
export async function readCopyrightCloseup(backImage, askVision, models) {
  if (!backImage) return { reads: [], status: "no_back" };
  const out = { reads: [], status: "ok", method: "slices" };
  try {
    const slices = [];
    for (const [y0, y1] of SLICES) slices.push(await cropAndEnlarge(backImage, { x0: 0, x1: 1, y0, y1 }, { padX: 0, padY: 0, targetWidth: 2048 }));
    const ask = (model) => askVision({ model, name: "copyright_read", schema: STRIPS_SCHEMA, maxTokens: 160, frontImage: slices[0], extraImages: slices.slice(1), prompt: STRIPS_PROMPT(slices.length) }).catch(() => null);
    const [a, b] = await Promise.all([ask(models.fast), ask(models.strong)]);
    // A read only counts if its line really is a copyright line ("©" + the year it gave).
    const ok = (r) => r && r.copyrightYearText && r.lineText && /©|\(c\)/i.test(r.lineText) && r.lineText.includes(String(r.copyrightYearText).trim());
    out.reads = [
      { by: "close-up A", year: ok(a) ? a.copyrightYearText : null, line: a?.lineText ?? null, slice: a?.slice ?? null },
      { by: "close-up B", year: ok(b) ? b.copyrightYearText : null, line: b?.lineText ?? null, slice: b?.slice ?? null },
    ];
  } catch (e) {
    out.status = "error";
    out.error = e.message;
  }
  return out;
}
