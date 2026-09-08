import formidable from "formidable";
import fs from "fs";
import OpenAI from "openai";

export const config = {
  api: { bodyParser: false },
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.SPECIAL_API_KEY,
});

const CARD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    player: { type: ["string", "null"] },
    year: { type: ["integer", "null"] },
    brand: { type: ["string", "null"] },
    set: { type: ["string", "null"] },
    cardNumber: { type: ["string", "null"] },
    parallel: { type: ["string", "null"] },
    rookie: { type: "boolean" },
    team: { type: ["string", "null"] },
    serialNumber: { type: ["string", "null"] },
    numberedTo: { type: ["integer", "null"] },
    autograph: { type: "boolean" },
    memorabilia: { type: "boolean" },
    gradingCompany: { type: ["string", "null"] },
    grade: { type: ["string", "null"] },
    notes: { type: "string" },
    matchScore: { type: "number", minimum: 0, maximum: 1 },
    alternates: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          player: { type: ["string", "null"] },
          year: { type: ["integer", "null"] },
          brand: { type: ["string", "null"] },
          set: { type: ["string", "null"] },
          cardNumber: { type: ["string", "null"] },
          parallel: { type: ["string", "null"] },
          reason: { type: "string" },
          matchScore: { type: "number", minimum: 0, maximum: 1 },
        },
        required: [
          "player",
          "year",
          "brand",
          "set",
          "cardNumber",
          "parallel",
          "reason",
          "matchScore",
        ],
      },
    },
  },
  required: [
    "player",
    "year",
    "brand",
    "set",
    "cardNumber",
    "parallel",
    "rookie",
    "team",
    "serialNumber",
    "numberedTo",
    "autograph",
    "memorabilia",
    "gradingCompany",
    "grade",
    "notes",
    "matchScore",
    "alternates",
  ],
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
  if (!file?.filepath) return "";

  let mimeType = file.mimetype || "image/jpeg";
  if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    mimeType = "image/jpeg";
  }

  const base64 = fs
    .readFileSync(file.filepath)
    .toString("base64")
    .replace(/\s/g, "");

  return `data:${mimeType};base64,${base64}`;
}

function cleanPart(value) {
  if (value === null || value === undefined) return "";
  const cleaned = String(value).trim();
  const bad = new Set(["unknown", "n/a", "none", "no", "not visible"]);
  return bad.has(cleaned.toLowerCase()) ? "" : cleaned;
}

function buildSoldCompQuery(card) {
  const parts = [
    cleanPart(card.year),
    cleanPart(card.brand),
    cleanPart(card.set),
    cleanPart(card.player),
    card.cardNumber
      ? `#${cleanPart(card.cardNumber).replace(/^#/, "")}`
      : "",
    cleanPart(card.parallel),
    card.numberedTo ? `/${card.numberedTo}` : "",
    card.autograph ? "auto" : "",
    cleanPart(card.gradingCompany),
    cleanPart(card.grade),
  ];

  return parts
    .filter(Boolean)
    .join(" ")
    .replace(/\bunknown\b/gi, "")
    .replace(/\bno patch\b/gi, "")
    .replace(/\bnot numbered\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function build130PointUrl(query) {
  return `https://130point.com/sales/?search=${encodeURIComponent(query)}`;
}

function buildEbaySoldUrl(query) {
  const params = new URLSearchParams({
    _nkw: query,
    LH_Sold: "1",
    LH_Complete: "1",
    _sop: "13",
  });

  return `https://www.ebay.com/sch/i.html?${params.toString()}`;
}

function decodeHtml(value = "") {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, number) =>
      String.fromCodePoint(parseInt(number, 10)),
    )
    .replace(/\s+/g, " ")
    .trim();
}

function extractFirst(html, regex) {
  const match = html.match(regex);
  return match ? decodeHtml(match[1]) : "";
}

function parseEbaySoldItems(html) {
  const blocks =
    html.match(
      /<li\b[^>]*class="[^"]*s-item[^"]*"[\s\S]*?<\/li>/gi,
    ) || [];

  const seen = new Set();
  const items = [];

  for (const block of blocks) {
    const title = extractFirst(
      block,
      /<(?:div|span)\b[^>]*class="[^"]*s-item__title[^"]*"[^>]*>([\s\S]*?)<\/(?:div|span)>/i,
    ).replace(/^New Listing\s*/i, "");

    const priceText = extractFirst(
      block,
      /<span\b[^>]*class="[^"]*s-item__price[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    );

    const soldDate = extractFirst(
      block,
      /<span\b[^>]*class="[^"]*(?:s-item__title--tagblock|POSITIVE)[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    );

    if (!title || !priceText || /\bto\b|–|—/i.test(priceText)) {
      continue;
    }

    const priceMatch = priceText.match(
      /US\s*\$\s*([\d,]+(?:\.\d{1,2})?)|\$\s*([\d,]+(?:\.\d{1,2})?)/i,
    );

    const rawPrice = priceMatch?.[1] || priceMatch?.[2];
    if (!rawPrice) continue;

    const price = Number(rawPrice.replace(/,/g, ""));
    if (!Number.isFinite(price) || price <= 0) continue;

    const key = `${title.toLowerCase()}|${price}`;
    if (seen.has(key)) continue;

    seen.add(key);
    items.push({ title, price, soldDate: soldDate || null });

    if (items.length === 20) break;
  }

  return items;
}

function calculateCompStats(items) {
  const prices = items
    .map((item) => item.price)
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);

  if (!prices.length) {
    return { min: null, max: null, median: null, count: 0 };
  }

  const middle = Math.floor(prices.length / 2);
  const median =
    prices.length % 2
      ? prices[middle]
      : (prices[middle - 1] + prices[middle]) / 2;

  const money = (value) => Number(value.toFixed(2));

  return {
    min: money(prices[0]),
    max: money(prices[prices.length - 1]),
    median: money(median),
    count: prices.length,
  };
}

async function fetchWithTimeout(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchSoldComps(query) {
  const sourceUrl = buildEbaySoldUrl(query);
  const searchUrl = build130PointUrl(query);

  if (!query) {
    return {
      ...calculateCompStats([]),
      currency: "USD",
      items: [],
      source: "ebay_sold",
      sourceUrl,
      searchUrl,
      error: "Not enough card information to build a sold-comps query.",
    };
  }

  try {
    const response = await fetchWithTimeout(sourceUrl);

    if (!response.ok) {
      throw new Error(`Sold search returned ${response.status}`);
    }

    const html = await response.text();
    const items = parseEbaySoldItems(html);

    return {
      ...calculateCompStats(items),
      currency: "USD",
      items,
      source: "ebay_sold",
      sourceUrl,
      searchUrl,
      error: items.length
        ? null
        : "No sold listings could be auto-parsed.",
    };
  } catch (error) {
    return {
      ...calculateCompStats([]),
      currency: "USD",
      items: [],
      source: "ebay_sold",
      sourceUrl,
      searchUrl,
      error: error?.message || "Sold prices could not be loaded.",
    };
  }
}

function getConfidence(matchScore) {
  return Number(matchScore) >= 0.85 ? "high" : "medium";
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function buildReadoutSummary(card, comps) {
  const identity = [
    card.year,
    card.brand,
    card.set,
    card.player,
    card.parallel,
    card.cardNumber
      ? `#${String(card.cardNumber).replace(/^#/, "")}`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  const traits = [
    card.rookie ? "rookie card" : null,
    card.autograph ? "autograph" : null,
    card.memorabilia ? "memorabilia" : null,
    card.numberedTo ? `numbered to ${card.numberedTo}` : null,
    card.grade
      ? `${card.gradingCompany ? `${card.gradingCompany} ` : ""}${card.grade}`
      : null,
  ].filter(Boolean);

  const cardText = identity || "Sports card";
  const traitText = traits.length ? ` (${traits.join(", ")})` : "";

  if (!comps.count) {
    return `${cardText}${traitText}. No reliable sold prices were auto-loaded; open the sold-comps search link to verify manually.`;
  }

  return `${cardText}${traitText}. Based on ${comps.count} sold ${
    comps.count === 1 ? "listing" : "listings"
  }, prices range from ${formatMoney(comps.min)} to ${formatMoney(
    comps.max,
  )}, with a median of ${formatMoney(comps.median)}.`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({
        results: "Use POST only.",
      });
    }

    if (
      !process.env.OPENAI_API_KEY &&
      !process.env.SPECIAL_API_KEY
    ) {
      return res.status(500).json({
        results: "Missing OpenAI API key in Vercel.",
      });
    }

    const { files } = await parseForm(req);

    const frontFile =
      getFile(files, "front") ||
      getFile(files, "image") ||
      getFile(files, "card");

    const backFile = getFile(files, "back");

    const frontImage = fileToDataUrl(frontFile);
    const backImage = fileToDataUrl(backFile);

    if (!frontImage) {
      return res.status(400).json({
        results: "No front card image received.",
      });
    }

    const content = [
      {
        type: "text",
        text: `Identify this sports card from the supplied front and optional back images.

Use visible evidence first. The back image should confirm the year, set, card number, serial numbering, and parallel. matchScore must be from 0 to 1 and represent confidence in the complete identification. Provide 2 to 5 plausible alternate identifications, especially nearby parallels or sets that look similar. Do not claim a serial number, autograph, memorabilia feature, grade, or rookie designation unless it is visible or strongly supported. An alternate may repeat the player but must differ by set, card number, year, or parallel.`,
      },
      {
        type: "image_url",
        image_url: {
          url: frontImage,
          detail: "high",
        },
      },
    ];

    if (backImage) {
      content.push({
        type: "image_url",
        image_url: {
          url: backImage,
          detail: "high",
        },
      });
    }

    const completion = await openai.chat.completions.create({
      model:
        process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "sports_card_identification",
          strict: true,
          schema: CARD_SCHEMA,
        },
      },
      max_tokens: 1200,
    });

    const text =
      completion.choices[0]?.message?.content;

    if (!text) {
      throw new Error(
        "OpenAI returned an empty identification.",
      );
    }

    const scanResult = JSON.parse(text);

    const alternates = Array.isArray(scanResult.alternates)
      ? scanResult.alternates.slice(0, 5)
      : [];

    delete scanResult.alternates;

    const confidence = getConfidence(
      scanResult.matchScore,
    );

    const query = buildSoldCompQuery(scanResult);
    const comps = await fetchSoldComps(query);

    const readoutSummary = buildReadoutSummary(
      scanResult,
      comps,
    );

    const legacySummary = comps.count
      ? `Min ${formatMoney(comps.min)} | Median ${formatMoney(
          comps.median,
        )} | Max ${formatMoney(comps.max)} | ${
          comps.count
        } sold`
      : "No prices auto-pulled. Use the sold-comps link below.";

    return res.status(200).json({
      results: "Scan completed successfully.",
      scan: scanResult,
      confidence,
      comps: {
        min: comps.min,
        max: comps.max,
        median: comps.median,
        count: comps.count,
        currency: comps.currency,
        items: comps.items,
        source: comps.source,
        url: comps.sourceUrl,
        searchUrl: comps.searchUrl,
        error: comps.error,
      },
      readoutSummary,
      alternates,
      soldComps: {
        query,
        url: comps.searchUrl,
        summary: legacySummary,
      },
    });
  } catch (err) {
    console.error("scan error:", err);

    return res.status(500).json({
      results: "Scan failed.",
      error: err?.message || String(err),
    });
  }
}
