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
    evidence: {
      type: "object",
      additionalProperties: false,
      properties: {
        playerNameText: { type: ["string", "null"] },
        cardNumberText: { type: ["string", "null"] },
        setOrBrandText: { type: ["string", "null"] },
        yearText: { type: ["string", "null"] },
        copyrightLineText: { type: ["string", "null"] },
        serialNumberText: { type: ["string", "null"] },
        parallelText: { type: ["string", "null"] },
      },
      required: [
        "playerNameText",
        "cardNumberText",
        "setOrBrandText",
        "yearText",
        "copyrightLineText",
        "serialNumberText",
        "parallelText",
      ],
    },
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
    "evidence",
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
  const bad = new Set(["unknown", "n/a", "none", "no", "not visible", "null", "undefined"]);
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
    card.rookie ? "RC" : "",
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
      status: "not_searched",
      error: "Not enough card information to build a sold-comps query.",
    };
  }

  try {
    const response = await fetchWithTimeout(sourceUrl);

    if (response.status === 401 || response.status === 403 || response.status === 429) {
      return {
        ...calculateCompStats([]),
        currency: "USD",
        items: [],
        source: "ebay_sold",
        sourceUrl,
        searchUrl,
        status: "comps_access_blocked",
        error: "Price estimate unavailable: the sold-listings site blocked the automatic search. Use the manual search link.",
      };
    }

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
      status: items.length ? "comps_found" : "no_comps_found",
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
      status: "comps_search_failed",
      error: "Price estimate unavailable: the sold-listings search failed. Try again shortly.",
    };
  }
}

function hasText(value) {
  return cleanPart(value).length >= 2;
}

const normalizeCode = (v) =>
  cleanPart(v).toUpperCase().replace(/^#/, "").replace(/[^A-Z0-9]/g, "");

const yearsIn = (v) => (cleanPart(v).match(/\b(18[89]\d|19\d\d|20\d\d)\b/g) || []).map(Number);

// A date like 9/14/25 or 9-14-2025 is a printed date, not a serial number.
const looksLikeDate = (v) => /^\s*\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\s*$/.test(cleanPart(v));

// Serial numbers look like 12/25 (numerator <= denominator).
function parseSerial(v) {
  const m = cleanPart(v).match(/^\s*(\d{1,4})\s*\/\s*(\d{1,4})\s*$/);
  if (!m) return null;
  const num = Number(m[1]);
  const den = Number(m[2]);
  if (!num || !den || num > den) return null;
  return { num, den };
}

// Checks every detail against the text the model says it read off the card.
// Hard conflicts -> "rejected" (no title, no pricing).
// Unsupported details -> field is cleared and a warning is added.
// Confidence never comes from the model's own matchScore.
function verifyIdentity(card) {
  const ev = card.evidence || {};
  const warnings = [];
  const rejected = [];
  const cleared = [];

  const clear = (field, reason) => {
    if (card[field] !== null && card[field] !== undefined && card[field] !== false) {
      cleared.push(field);
      warnings.push(reason);
    }
    card[field] = typeof card[field] === "boolean" ? false : null;
  };

  // --- Player ---
  const playerOk = hasText(ev.playerNameText) && hasText(card.player);
  if (!playerOk) warnings.push("Player name is not printed clearly enough to verify.");
  if (playerOk) {
    const last = cleanPart(card.player).split(/\s+/).pop().toLowerCase();
    if (!cleanPart(ev.playerNameText).toLowerCase().includes(last)) {
      rejected.push("Identified player does not match the name printed on the card.");
    }
  }

  // --- Year: must match the copyright line when it is readable ---
  const currentYear = new Date().getFullYear();
  const copyrightYears = yearsIn(ev.copyrightLineText);
  const evidenceYears = [...copyrightYears, ...yearsIn(ev.yearText)];
  let yearOk = false;

  if (card.year && (card.year < 1880 || card.year > currentYear + 1)) {
    rejected.push(`Year ${card.year} is not a possible card year.`);
  } else if (card.year && copyrightYears.length && !copyrightYears.includes(card.year)) {
    // Card copyright years are usually the release year (or one year earlier for some sets).
    const closest = Math.max(...copyrightYears);
    if (card.year !== closest + 1) {
      rejected.push(
        `Year ${card.year} does not match the copyright line (${copyrightYears.join(", ")}).`,
      );
    } else yearOk = true;
  } else if (card.year && evidenceYears.length && !evidenceYears.includes(card.year)) {
    rejected.push(`Year ${card.year} does not match the year printed on the card.`);
  } else if (card.year && evidenceYears.length) {
    yearOk = true;
  } else {
    warnings.push("Year/copyright line was not readable.");
  }

  // --- Card number: must match the printed card number exactly ---
  let numberOk = false;
  if (cleanPart(card.cardNumber)) {
    const printed = normalizeCode(ev.cardNumberText);
    const claimed = normalizeCode(card.cardNumber);
    if (!printed) {
      clear("cardNumber", "Card number removed: it was not readable on the card.");
    } else if (printed !== claimed && !printed.endsWith(claimed) && !claimed.endsWith(printed)) {
      rejected.push(`Card number ${card.cardNumber} does not match the printed text "${ev.cardNumberText}".`);
    } else if (printed !== claimed) {
      // e.g. scanner said "C-2" but the card says "FC-2" -> partial read, reject.
      rejected.push(`Card number ${card.cardNumber} is incomplete; the card shows "${ev.cardNumberText}".`);
    } else {
      numberOk = true;
    }
  } else {
    warnings.push("Card number was not readable.");
  }

  // --- Set / brand ---
  const setOk = hasText(ev.setOrBrandText);
  if (!setOk) warnings.push("Set or brand name was not readable.");

  // --- Serial number ---
  const serialText = cleanPart(card.serialNumber) || cleanPart(ev.serialNumberText);
  if (serialText && looksLikeDate(serialText)) {
    clear("serialNumber", `"${serialText}" is a printed date, not a serial number.`);
    clear("numberedTo", "Numbered-to removed: no real serial number was found.");
  } else if (cleanPart(card.serialNumber)) {
    const serial = parseSerial(card.serialNumber);
    if (!serial) {
      clear("serialNumber", `Serial number "${card.serialNumber}" is not a valid format (should look like 12/25).`);
      clear("numberedTo", "Numbered-to removed: no valid serial number was found.");
    } else if (!cleanPart(ev.serialNumberText)) {
      clear("serialNumber", "Serial number removed: it was not read from the card.");
      clear("numberedTo", "Numbered-to removed: no serial number was read from the card.");
    } else if (card.numberedTo && card.numberedTo !== serial.den) {
      // Conflicting serial info: drop it rather than reject the whole card.
      clear("serialNumber", `Serial "${card.serialNumber}" conflicts with numbered-to /${card.numberedTo}; removed.`);
      clear("numberedTo", "Numbered-to removed: it conflicted with the serial number.");
    } else {
      card.numberedTo = serial.den;
    }
  } else if (card.numberedTo) {
    clear("numberedTo", "Numbered-to removed: no serial number was visible.");
  }

  // --- Parallel: must be a name, not a serial or date ---
  const par = cleanPart(card.parallel);
  if (par) {
    if (/^\s*\d+\s*\/\s*\d+/.test(par) || looksLikeDate(par)) {
      clear("parallel", `Parallel "${par}" looks like a number or date, not a parallel name.`);
    } else if (!hasText(ev.parallelText)) {
      warnings.push("Parallel was not printed on the card; please confirm it.");
    }
  }

  const strong = [playerOk, numberOk, setOk, yearOk].filter(Boolean).length;
  warnings.unshift(...rejected);

  let status = "needs_review";
  if (rejected.length) status = "rejected";
  else if (playerOk && strong >= 4) status = "verified";
  else if (playerOk && strong >= 3) status = "likely";

  return { status, warnings, rejected, cleared, strongIdentifiers: strong };
}

// Second, independent read focused only on serial numbers.
// The first scan's serial is kept only if this pass confirms the same serial
// and it is not part of a printed date.
const SERIAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    slashTexts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string" },
          location: { type: "string" },
          kind: { type: "string", enum: ["stamped_serial", "date", "other"] },
        },
        required: ["text", "location", "kind"],
      },
    },
    stampedSerial: { type: ["string", "null"] },
    stampedSerialSide: { type: ["string", "null"], enum: ["front", "back", null] },
    stampedSerialAppearance: { type: ["string", "null"] },
  },
  required: ["slashTexts", "stampedSerial", "stampedSerialSide", "stampedSerialAppearance"],
};

async function confirmSerial(frontImage, backImage) {
  const content = [
    {
      type: "text",
      text: `Look ONLY for text containing a slash ("/") on this sports card.
List every piece of text with a slash exactly as printed, where it is, and its kind:
- "stamped_serial": a standalone serial number such as "07/25" or "112/199", usually foil-stamped or printed alone in a small area.
- "date": any date such as "9/14/25" or "09/14/2025", including dates under labels like "Rookie Debut".
- "other": anything else.
Set stampedSerial to the exact stamped serial text, or null if there is none.
Never build a serial from parts of a date or from other numbers such as gate, seat, row, flight, or jersey numbers. Most cards have NO serial number; null is the expected answer unless you can clearly see one.
If you report a stamped serial, set stampedSerialSide to "front" or "back" and describe how it looks in stampedSerialAppearance (for example "gold foil, bottom right corner"). Otherwise set both to null.`,
    },
    { type: "image_url", image_url: { url: frontImage, detail: "high" } },
  ];
  if (backImage) {
    content.push({ type: "image_url", image_url: { url: backImage, detail: "high" } });
  }

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
    messages: [{ role: "user", content }],
    response_format: {
      type: "json_schema",
      json_schema: { name: "serial_check", strict: true, schema: SERIAL_SCHEMA },
    },
    max_tokens: 500,
  });

  const text = completion.choices[0]?.message?.content;
  return text ? JSON.parse(text) : null;
}

// Keeps a serial only if:
//  - two separate serial reads both report a stamped serial,
//  - both reads match each other AND the first scan exactly,
//  - both reads put it on the same side of the card,
//  - its numbers do not come from a printed date (e.g. "09/25" from "9/14/25").
// Anything else is removed. A missing serial is safer than an invented one.
function applySerialCheck(card, checks, warnings) {
  if (!cleanPart(card.serialNumber) && !card.numberedTo) return;

  const claimed = parseSerial(card.serialNumber);
  const valid = (checks || []).filter(Boolean);
  const reads = valid.map((c) => parseSerial(c.stampedSerial));
  const sides = valid.map((c) => cleanPart(c.stampedSerialSide).toLowerCase());
  const dates = valid
    .flatMap((c) => c.slashTexts || [])
    .filter((t) => t.kind === "date" || looksLikeDate(t.text))
    .map((t) => t.text);

  const fromDate =
    claimed &&
    dates.some((d) => {
      const parts = d.split(/[\/.-]/).map(Number);
      return parts.includes(claimed.num) || parts.includes(claimed.den);
    });

  const same = (r) => r && claimed && r.num === claimed.num && r.den === claimed.den;
  const shown = valid.map((c) => `"${c.stampedSerial ?? "none"}"`).join(" and ");

  let reason = null;
  if (valid.length < 2) reason = "Serial number removed: the serial checks could not run.";
  else if (!claimed) reason = `Serial number removed: "${card.serialNumber}" is not a valid serial.`;
  else if (reads.some((r) => !r)) reason = `Serial number removed: not every check found a stamped serial (checks read ${shown}).`;
  else if (!reads.every(same)) reason = `Serial number removed: the checks read ${shown}, not "${card.serialNumber}".`;
  else if (!sides[0] || sides.some((x) => x !== sides[0])) reason = "Serial number removed: the checks did not agree on where the serial is printed.";
  else if (fromDate) reason = `Serial number removed: "${card.serialNumber}" uses numbers from the printed date ${[...new Set(dates)].join(", ")}. If the card really has a stamped serial, enter it manually.`;

  if (reason) {
    card.serialNumber = null;
    card.numberedTo = null;
    if (card.evidence) card.evidence.serialNumberText = null;
    warnings.push(reason);
  } else {
    card.numberedTo = claimed.den;
    warnings.push(`Serial ${card.serialNumber} confirmed by two separate checks (${sides[0]}).`);
  }
}

// Second, independent read for card number, product/set name, and parallel.
// First-scan values are kept only when this pass agrees with them.
const DETAIL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    cardNumberText: { type: ["string", "null"] },
    cardNumberLocation: { type: ["string", "null"] },
    productName: { type: ["string", "null"] },
    parallelName: { type: ["string", "null"] },
    parallelLocation: { type: ["string", "null"] },
    rookieMarkText: { type: ["string", "null"] },
  },
  required: [
    "cardNumberText",
    "cardNumberLocation",
    "productName",
    "parallelName",
    "parallelLocation",
    "rookieMarkText",
  ],
};

async function confirmDetails(frontImage, backImage) {
  const content = [
    {
      type: "text",
      text: `Read three things from this sports card exactly as printed. Do not guess.

1. cardNumberText: the card number, usually on the back in a corner, often after a label like "#", "No.", "Card", or "ID#". Return ONLY the number itself without the label (for example "FC-2", "145", "RC-12"). Keep letter prefixes. Do not add letters from nearby labels. Null if not readable.
2. productName: the product/set name from the main logo (for example "First Class", "Prizm", "Chrome"). Not the parallel.
3. parallelName: the parallel or insert name printed separately from the main logo, often in a thin strip along an edge or in small text (for example "Signature Class Airlines", "Silver Prizm", "Gold Refractor"). Must be different from productName. Null if none is printed.
4. rookieMarkText: if the card shows an official rookie mark, copy it exactly: the "RC" rookie logo (often a small shield/badge), "Rookie Card", "Rookie", or "Rated Rookie". Do not count text that only mentions a player's rookie year or season in a paragraph. Null if no rookie mark is printed.
Give the location of the card number and parallel text.`,
    },
    { type: "image_url", image_url: { url: frontImage, detail: "high" } },
  ];
  if (backImage) {
    content.push({ type: "image_url", image_url: { url: backImage, detail: "high" } });
  }

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
    messages: [{ role: "user", content }],
    response_format: {
      type: "json_schema",
      json_schema: { name: "detail_check", strict: true, schema: DETAIL_SCHEMA },
    },
    max_tokens: 400,
  });

  const text = completion.choices[0]?.message?.content;
  return text ? JSON.parse(text) : null;
}

const LABEL_PREFIX = /^(ID|NO|CARD|NUM|NUMBER)(?=[A-Z0-9])/;
const normWords = (v) => cleanPart(v).toLowerCase().replace(/[^a-z0-9]/g, "");
const sameText = (a, b) => {
  const x = normWords(a);
  const y = normWords(b);
  return Boolean(x && y && (x === y || x.includes(y) || y.includes(x)));
};

function applyDetailCheck(card, check, warnings) {
  if (!check) {
    warnings.push("Detail check could not run; card number and parallel are unconfirmed.");
    card.cardNumber = null;
    card.parallel = null;
    card.rookie = false;
    return;
  }

  // --- Card number: both reads must agree after removing label text like "ID#" ---
  const strip = (v) => normalizeCode(v).replace(LABEL_PREFIX, "");
  const first = strip(card.cardNumber);
  const second = strip(check.cardNumberText);
  if (first && second && first === second) {
    card.cardNumber = cleanPart(check.cardNumberText).replace(/^#/, "");
  } else if (first || second) {
    warnings.push(
      `Card number removed: the two reads disagree ("${card.cardNumber || "none"}" vs "${check.cardNumberText || "none"}").`,
    );
    card.cardNumber = null;
  }
  if (card.evidence) card.evidence.cardNumberText = card.cardNumber;

  // --- Set and parallel: fix swaps, drop parallels that are really the set name ---
  const product = cleanPart(check.productName);
  const parallel = cleanPart(check.parallelName);
  const firstFields = [card.set, card.parallel, card.brand];

  if (product && firstFields.some((f) => sameText(f, product))) {
    if (sameText(card.parallel, product) && !sameText(card.set, product)) {
      warnings.push(`Set and parallel were swapped; corrected set to "${product}".`);
    }
    card.set = product;
  }

  if (parallel && !sameText(parallel, product) && firstFields.some((f) => sameText(f, parallel))) {
    card.parallel = parallel;
  } else if (cleanPart(card.parallel)) {
    warnings.push(`Parallel "${card.parallel}" removed: the second read did not confirm it.`);
    card.parallel = null;
  }

  // Remove a parallel name that leaked into the brand, e.g. "Topps Signature Class Airlines".
  if (card.parallel && cleanPart(card.brand).toLowerCase().includes(card.parallel.toLowerCase())) {
    card.brand = cleanPart(card.brand.replace(new RegExp(card.parallel, "i"), "")) || card.brand;
  }
  // Never let the parallel just repeat the set or brand.
  if (card.parallel && (sameText(card.parallel, card.set) || sameText(card.parallel, card.brand))) {
    warnings.push(`Parallel "${card.parallel}" removed: it repeats the set or brand.`);
    card.parallel = null;
  }
  if (card.evidence) card.evidence.parallelText = card.parallel;

  // --- Rookie: only true when a printed rookie mark is seen ---
  const mark = cleanPart(check.rookieMarkText);
  const isRookieMark = /\b(RC|ROOKIE)\b/i.test(mark);
  if (isRookieMark && !card.rookie) {
    warnings.push(`Rookie card mark found ("${mark}"); marked as rookie.`);
  } else if (!isRookieMark && card.rookie) {
    warnings.push("Rookie removed: no printed rookie mark (RC logo or \"Rookie\") was found.");
  }
  card.rookie = isRookieMark;
  card.rookieMarkText = isRookieMark ? mark : null;
}

// Stronger-model card-number read. Runs on EVERY scan and does not see the
// earlier answers, so it cannot just agree with a shared misread like "C-2".
async function strongCardNumberRead(frontImage, backImage) {
  const content = [
    {
      type: "text",
      text: `Find the card number printed on this sports card. It is usually on the back, often in a corner box, sometimes after a label like "ID#", "#", "No.", or "Card".
Zoom in and read every character, especially any letters before a dash (for example "FC-2", "RC-12", "BDC-45", "101").
Return ONLY the number itself, without the label text. Return null if you cannot read it with certainty.`,
    },
    { type: "image_url", image_url: { url: frontImage, detail: "high" } },
  ];
  if (backImage) {
    content.push({ type: "image_url", image_url: { url: backImage, detail: "high" } });
  }

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_TIEBREAK_MODEL || "gpt-4o",
    messages: [{ role: "user", content }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "card_number_read",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            cardNumberText: { type: ["string", "null"] },
            location: { type: ["string", "null"] },
          },
          required: ["cardNumberText", "location"],
        },
      },
    },
    max_tokens: 150,
  });

  const text = completion.choices[0]?.message?.content;
  return text ? JSON.parse(text) : null;
}

// Decide the final card number from the earlier reads and the strong read.
function resolveCardNumber(earlier, strongText) {
  const strip = (v) => normalizeCode(v).replace(LABEL_PREFIX, "");
  const strong = strip(strongText);
  const reads = [...new Set(earlier.map(strip).filter(Boolean))];

  if (!strong) {
    return { value: null, warning: "Card number removed: the stronger check could not read it." };
  }
  if (reads.includes(strong)) {
    return { value: cleanPart(strongText).replace(/^#/, ""), warning: null };
  }
  // Earlier reads dropped a prefix (e.g. "C-2" vs "FC-2"): trust the fuller strong read.
  if (reads.length && reads.every((r) => strong.endsWith(r) && strong.length > r.length)) {
    return {
      value: cleanPart(strongText).replace(/^#/, ""),
      warning: `Card number corrected to ${cleanPart(strongText)} by the stronger check (earlier reads: ${earlier.filter(Boolean).join(", ")}).`,
    };
  }
  return {
    value: null,
    warning: `Card number removed: the stronger check read "${cleanPart(strongText)}", which does not match earlier reads (${earlier.filter(Boolean).join(", ") || "none"}).`,
  };
}

function getConfidence(verification) {
  if (verification.status === "verified") return "high";
  if (verification.status === "likely") return "medium";
  if (verification.status === "rejected") return "rejected";
  return "needs review";
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

Use visible evidence first. In "evidence", copy the EXACT text you can read printed on the card for the player name, card number, set/brand, and year/copyright line. If you cannot read it, use null. Never fill a field from team logos, uniforms, or what seems likely. If the player name is not legible, set player to null and matchScore below 0.5. The back image should confirm the year, set, card number, serial numbering, and parallel. matchScore must be from 0 to 1 and represent confidence in the complete identification. Provide 2 to 5 plausible alternate identifications, especially nearby parallels or sets that look similar. Do not claim a serial number, autograph, memorabilia feature, grade, or rookie designation unless it is visible or strongly supported. An alternate may repeat the player but must differ by set, card number, year, or parallel.

Strict rules:
- "year" must come from the copyright line on the back (for example "© 2025 The Topps Company"). Copy that whole line into evidence.copyrightLineText.
- "cardNumber" must be copied character-for-character from the printed card number, including letter prefixes (for example "FC-2", not "C-2").
- "serialNumber" is ONLY a stamped serial like "07/25" or "12/99". Dates such as "9/14/25" (often printed under "Rookie Debut" or similar) are NOT serial numbers. Copy a real serial into evidence.serialNumberText; otherwise use null for serialNumber, numberedTo, and serialNumberText.
- "parallel" is the NAME of the parallel or insert printed on the card (for example "Signature Class Airlines", "Gold Refractor"). Never put a number or serial in "parallel". Copy the printed parallel/insert text into evidence.parallelText, or null.
- Only list real, existing products as alternates.`,
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

    const detailWarnings = [];
    let detailCheck = null;
    try {
      detailCheck = await confirmDetails(frontImage, backImage);
    } catch (e) {
      console.error("detail check failed:", e);
    }
    const firstCardNumber = cleanPart(scanResult.cardNumber).replace(/^#/, "");
    applyDetailCheck(scanResult, detailCheck, detailWarnings);

    // Always run the stronger card-number check.
    const secondCardNumber = cleanPart(detailCheck?.cardNumberText).replace(/^#/, "");
    let strongRead = null;
    try {
      strongRead = await strongCardNumberRead(frontImage, backImage);
    } catch (e) {
      console.error("strong card number read failed:", e);
    }
    if (strongRead) {
      const resolved = resolveCardNumber([firstCardNumber, secondCardNumber], strongRead.cardNumberText);
      scanResult.cardNumber = resolved.value;
      if (scanResult.evidence) scanResult.evidence.cardNumberText = resolved.value;
      const i = detailWarnings.findIndex((w) => w.startsWith("Card number removed: the two reads"));
      if (i >= 0) detailWarnings.splice(i, 1);
      if (resolved.warning) detailWarnings.push(resolved.warning);
    } else {
      scanResult.cardNumber = null;
      if (scanResult.evidence) scanResult.evidence.cardNumberText = null;
      detailWarnings.push("Card number removed: the stronger check could not run.");
    }

    const verification = verifyIdentity(scanResult);
    verification.warnings.push(...detailWarnings);
    verification.detailCheck = detailCheck;

    if (cleanPart(scanResult.serialNumber) || scanResult.numberedTo) {
      const safeRead = () =>
        confirmSerial(frontImage, backImage).catch((e) => {
          console.error("serial check failed:", e);
          return null;
        });
      const serialChecks = await Promise.all([safeRead(), safeRead()]);
      applySerialCheck(scanResult, serialChecks, verification.warnings);
      verification.serialCheck = serialChecks;
    }
    const confidence = getConfidence(verification);
    const identityTrusted =
      verification.status === "verified" || verification.status === "likely";

    // Unverified identities never reach pricing or listing titles.
    const query = identityTrusted ? buildSoldCompQuery(scanResult) : "";
    const comps = identityTrusted
      ? await fetchSoldComps(query)
      : {
          ...calculateCompStats([]),
          currency: "USD",
          items: [],
          source: "ebay_sold",
          sourceUrl: null,
          searchUrl: null,
          status: "not_searched",
          error: "Price estimate unavailable until the card identity is confirmed.",
        };

    const readoutSummary = identityTrusted
      ? buildReadoutSummary(scanResult, comps)
      : verification.status === "rejected"
      ? `Scan rejected: ${verification.rejected.join(" ")} Rescan the front and back straight-on in bright light.`
      : "Identification needs review. I could not reliably verify the player, set, or card number. Rescan the front and back in bright light with the nameplate and card number fully visible.";

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
      verification,
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
        status: comps.status,
        error: comps.error,
      },
      readoutSummary,
      alternates: identityTrusted ? alternates : [],
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
