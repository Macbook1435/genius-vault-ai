import { authenticatedUser, reserveScan, subscriptionsEnabled } from "./_lib/subscriptions.js";
import formidable from "formidable";
import fs from "fs";
import OpenAI from "openai";
import { cardsightConfigured, cardsightIdentify, resolveParallel, cardsightSoldComps, cardsightFindByDetails,
  cardsightCardInfo, pickParallel, parallelCompsPlan, baseLookalikes, parallelOptions, suggestOptionIds,
  isAutoCard, isRelicCard } from "./cardsight.js";
import { buildFieldVerification, buildMarket, integrationStatus } from "./_lib/verification.js";
import { promptExamples } from "./_lib/prompt-examples.js";
import { runPipelineV2, pipelineV2Mode, v2Extras } from "./_lib/pipeline-v2.js";
import { readSerialFromPhotos, serialValue } from "./_lib/serial-photo.js";
import { readCopyrightCloseup } from "./_lib/copyright-closeup.js";
import { ebayConfigured, ebaySearch } from "./ebay-browse.js";
import { PARALLEL_CHECKLISTS } from "./_data/parallel-checklists.js";

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
    // Avoid duplicate "Topps Topps Resurgence" in sold searches.
    cleanPart(card.set).toLowerCase().startsWith(cleanPart(card.brand).toLowerCase() + " ")
      ? cleanPart(card.set)
      : [cleanPart(card.brand), cleanPart(card.set)].filter(Boolean).join(" "),
    cleanPart(card.player),
    card.cardNumber
      ? `#${cleanPart(card.cardNumber).replace(/^#/, "")}`
      : "",
    // Parallel names are often omitted in actual eBay titles; the exact
    // print run and autograph are more reliable search terms.
    card.numberedTo ? `/${card.numberedTo}` : cleanPart(card.parallel),
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

    // eBay displays the original asking price for accepted best offers.
    // Exclude these listings rather than reporting an unverified sale amount.
    if (/best\s+offer\s+accepted/i.test(decodeHtml(block))) continue;

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

async function fetchSoldComps(query, card = null) {
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
    const response = await fetchWithTimeout(sourceUrl, 4500);

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
    const items = parseEbaySoldItems(html).filter((item) => {
      if (!card) return true;
      const title = item.title.toLowerCase();
      const player = cleanPart(card.player).toLowerCase();
      const number = cleanPart(card.cardNumber).replace(/^#/, "");
      const run = Number(card.numberedTo);
      // Never value a numbered autograph using a different player's,
      // different print-run, or non-autograph sold listing.
      if (player && !title.includes(player)) return false;
      if (number && !new RegExp(`(?:#|\\b)${number}\\b`, "i").test(title)) return false;
      if (run && !new RegExp(`/\\s*${run}\\b`).test(title)) return false;
      if (card.autograph && !/\\b(auto|autograph|signed|signature)\\b/i.test(title)) return false;
      // Reject listings explicitly labeled as another parallel. A matching /print
      // run is necessary but not sufficient: different parallels can share it.
      // If the listing omits the parallel entirely, exclude it from the median
      // rather than guessing which version sold.
      const expectedParallel = cleanPart(card.parallel).toLowerCase();
      if (expectedParallel && !/^(unknown|unconfirmed|base|none)$/.test(expectedParallel)) {
        const normalizeParallel = (v) => v.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
        const expected = normalizeParallel(expectedParallel);
        const listing = normalizeParallel(title);
        const aliases = expected === "black and white" ? ["black and white", "black white", "b w"] : [expected];
        if (!aliases.some((alias) => (" " + listing + " ").includes(" " + alias + " "))) return false;
      }
      return true;
    });

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
      // e.g. scanner said "B-7" but the card says "AB-7" -> partial read, reject.
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

  return { status, warnings, rejected, cleared, strongIdentifiers: strong, identity: { playerOk, yearOk, numberOk, setOk } };
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

  // Remove a parallel name that leaked into the brand, e.g. "Topps Gold Refractor".
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

// Decide the final card number from the earlier reads and the strong read.
function resolveCardNumber(earlier, strongText) {
  const strip = (v) => normalizeCode(v).replace(LABEL_PREFIX, "");
  const strong = strip(strongText);
  const reads = [...new Set(earlier.map(strip).filter(Boolean))];

  if (!strong) {
    return { value: null, warning: "Card number removed: the stronger check could not read it." };
  }
  const lookAlike = (v) => v.replace(/5/g, "S").replace(/0/g, "O").replace(/[1L]/g, "I").replace(/8/g, "B").replace(/2/g, "Z");
  // Tie between look-alike spellings (e.g. "AB-XYS" vs "AB-XY5"): prefer the one whose
  // dash-separated parts are all letters or all digits, which is how card codes are printed.
  const raw = [...earlier.map(cleanPart).filter(Boolean), cleanPart(strongText)];
  const lookGroup = raw.filter((v) => lookAlike(strip(v)) === lookAlike(strong));
  const clean = (v) => v.replace(/^#/, "").split("-").every((seg) => /^[A-Z]+$/i.test(seg) || /^[0-9]+$/.test(seg));
  if (lookGroup.length >= 2 && new Set(lookGroup.map(strip)).size > 1) {
    const tidy = [...new Set(lookGroup.filter(clean).map((v) => v.replace(/^#/, "")))];
    if (tidy.length === 1) {
      return {
        value: tidy[0],
        warning: `Card number ${tidy[0]} chosen; other reads saw look-alike characters (${lookGroup.filter((v) => !clean(v)).join(", ")}).`,
      };
    }
  }
  if (reads.includes(strong)) {
    return { value: cleanPart(strongText).replace(/^#/, ""), warning: null };
  }
  // Reads differ only by look-alike characters (5/S, 0/O, 1/I/L, 8/B, 2/Z):
  // take the majority spelling across all three reads.
  const all = [...earlier.map(strip).filter(Boolean), strong];
  if (all.length >= 3 && all.every((v) => lookAlike(v) === lookAlike(strong))) {
    const counts = all.reduce((a, v) => ((a[v] = (a[v] || 0) + 1), a), {});
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (ranked[0][1] >= 2 && (!ranked[1] || ranked[1][1] < ranked[0][1])) {
      const winner = earlier.find((e) => strip(e) === ranked[0][0]) || cleanPart(strongText);
      return {
        value: cleanPart(winner).replace(/^#/, ""),
        warning: `Card number ${cleanPart(winner)} chosen by majority; one read saw look-alike characters ("${cleanPart(strongText)}").`,
      };
    }
  }
  // Earlier reads dropped a prefix (e.g. "B-7" vs "AB-7"): trust the fuller strong read.
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

// ---- Shared OpenAI vision call with one retry on rate limits ----
async function askVision({ model, prompt, name, schema, frontImage, backImage, maxTokens, extraImages }) {
  const content = [
    { type: "text", text: prompt },
    { type: "image_url", image_url: { url: frontImage, detail: "high" } },
  ];
  if (backImage) {
    content.push({ type: "image_url", image_url: { url: backImage, detail: "high" } });
  }
  for (const url of extraImages || []) content.push({ type: "image_url", image_url: { url, detail: "high" } });

  const call = () =>
    openai.chat.completions.create({
      model,
      messages: [{ role: "user", content }],
      response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
      max_tokens: maxTokens,
    });

  let completion;
  try {
    completion = await call();
  } catch (e) {
    if (e?.status !== 429) throw e;
    // Rate limited: wait briefly and try again (up to 2 more times).
    let last = e;
    for (let i = 0; i < 2; i++) {
      const wait = Math.min(Number(last?.headers?.["retry-after"]) * 1000 || 2000 * (i + 1), 8000);
      await new Promise((r) => setTimeout(r, wait));
      try { completion = await call(); last = null; break; } catch (e2) { if (e2?.status !== 429) throw e2; last = e2; }
    }
    if (last) throw last;
  }

  const text = completion.choices[0]?.message?.content;
  return text ? JSON.parse(text) : null;
}

const SERIAL_PROMPT = `SERIAL NUMBER:
List every piece of text containing a slash ("/") exactly as printed in slashTexts, with where it is and its kind:
- "stamped_serial": a standalone serial number such as "07/25" or "112/199", usually foil-stamped or printed alone in a small area.
- "date": any date such as "9/14/25" or "09/14/2025", including dates under labels like "Rookie Debut".
- "other": anything else.
Set stampedSerial to the exact stamped serial text, or null if there is none.
Never build a serial from parts of a date or from other numbers such as gate, seat, row, flight, or jersey numbers. Most cards have NO serial number; null is the expected answer unless you can clearly see one.
If you report a stamped serial, set stampedSerialSide to "front" or "back" and describe it in stampedSerialAppearance (for example "gold foil, bottom right corner"). Otherwise set both to null.`;

const cardNumberPrompt = (ex) => `CARD NUMBER:
The card number is usually on the back, often in a corner box, sometimes after a label like "ID#", "#", "No.", or "Card".
Zoom in and read every character, especially any letters before a dash (for example ${ex.cardNumberLetters}).
Return ONLY the number itself without the label text. Null if you cannot read it with certainty.
A JERSEY/UNIFORM number is NOT a card number. Numbers shown next to the player's name or position (for example ${ex.jerseyExample}) or on the uniform are jersey numbers. If the only number you see is a jersey number, return null.
Also report the jersey number in jerseyNumberText (digits only, e.g. "32"), or null if none is printed.`;

// Check A (cheaper model): card number, set, parallel, rookie mark, and serial — one call.
const COMBINED_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    ...DETAIL_SCHEMA.properties,
    ...SERIAL_SCHEMA.properties,
    jerseyNumberText: { type: ["string", "null"] },
    brandNameText: { type: ["string", "null"] },
    playerNameText: { type: ["string", "null"] },
    sponsorNames: { type: "array", items: { type: "string" } },
    eventYears: { type: "array", items: { type: "string" } },
    parallelColor: { type: ["string", "null"] },
    parallelFinish: { type: "string", enum: ["plain_refractor", "wave", "lava", "geometric", "football_leather", "prizm", "xfractor", "pulsar", "raywave", "shimmer", "mojo", "cracked_ice", "no_shine", "other", "unknown"] },
  },
  required: [
    ...DETAIL_SCHEMA.required,
    ...SERIAL_SCHEMA.required,
    "jerseyNumberText",
    "playerNameText",
    "brandNameText",
    "sponsorNames",
    "eventYears",
    "parallelColor",
    "parallelFinish",
  ],
};

function runCombinedCheck(frontImage, backImage, ex = promptExamples(false), v2 = false) {
  return askVision({
    model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
    name: "combined_check",
    schema: v2 ? {
      ...COMBINED_SCHEMA,
      properties: { ...COMBINED_SCHEMA.properties, ...v2Extras("combined").properties },
      required: [...COMBINED_SCHEMA.required, ...v2Extras("combined").required],
    } : COMBINED_SCHEMA,
    maxTokens: 800,
    frontImage,
    backImage,
    prompt: `Read these details from this sports card exactly as printed. Do not guess.

${cardNumberPrompt(ex)}
Put it in cardNumberText and its location in cardNumberLocation.

SET AND PARALLEL:
- productName: the product/set name from the main logo (for example ${ex.productName}). Not the parallel.
- parallelName: the parallel or insert name printed separately from the main logo, often in a thin strip along an edge or in small text (for example ${ex.parallelName}). Must be different from productName. Null if none is printed. Give its location in parallelLocation.

PLAYER NAME:
- playerNameText: the player's full name exactly as printed on the nameplate, letter by letter (stylized capitals like ${ex.stylizedName} are one word). Null if not readable.

BRAND AND SPONSORS:
- brandNameText: the card MANUFACTURER name exactly as printed anywhere on the card or in the copyright line (for example "Topps", "Panini", "Bowman", "Upper Deck", "Fleer", "Donruss", "Leaf"). Null if no manufacturer name is printed. Never guess from the card's design or era.
- sponsorNames: names of sponsors, advertisers, or organizations shown on the card that are NOT the card manufacturer or set name (for example ${ex.sponsorList}). Empty list if none.

PARALLEL APPEARANCE (describe what you SEE, do not name the parallel):
- parallelColor: the main color of the card's colored border/background tint that marks the parallel, as one simple word (pink, blue, gold, green, purple, orange, red, black, aqua, teal, yellow, white, silver). Null if the card is the plain base color.
- parallelFinish: the surface pattern. "plain_refractor" = smooth rainbow shine with no pattern; "wave" = wavy lines; "lava" = bubbly lava-lamp blobs; "geometric" = repeating shapes; "football_leather" = pebbled leather texture; "prizm" = cracked-glass/prizm lines; "xfractor" = grid of small squares; "pulsar" = dots; "raywave" = rays; "shimmer"; "mojo"; "cracked_ice"; "no_shine" = paper/matte; "other"; or "unknown".

EVENT YEARS:
- eventYears: every 4-digit year printed in the bio, draft line, stats, or write-up describing things that already happened (for example ${ex.draftLine}). Exclude birth dates and the copyright line. Empty list if none.

ROOKIE:
- rookieMarkText: if the card shows an official rookie mark, copy it exactly: the "RC" rookie logo (often a small shield/badge), "Rookie Card", "Rookie", or "Rated Rookie". Do not count text that only mentions a rookie year or season in a paragraph. Null if none.

${SERIAL_PROMPT}${v2 ? v2Extras("combined").prompt : ""}`,
  });
}

// Check B (stronger model): independent card-number read + second serial read — one call.
// It never sees earlier answers, so it cannot just agree with a shared misread.
const STRONG_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    cardNumberText: { type: ["string", "null"] },
    location: { type: ["string", "null"] },
    jerseyNumberText: { type: ["string", "null"] },
    copyrightYearText: { type: ["string", "null"] },
    playerNameText: { type: ["string", "null"] },
    ...SERIAL_SCHEMA.properties,
  },
  required: ["cardNumberText", "location", "jerseyNumberText", "copyrightYearText", "playerNameText", ...SERIAL_SCHEMA.required],
};

function runStrongCheck(frontImage, backImage, ex = promptExamples(false), v2 = false) {
  return askVision({
    model: process.env.OPENAI_TIEBREAK_MODEL || "gpt-4o",
    name: "strong_check",
    schema: v2 ? {
      ...STRONG_SCHEMA,
      properties: { ...STRONG_SCHEMA.properties, ...v2Extras("strong").properties },
      required: [...STRONG_SCHEMA.required, ...v2Extras("strong").required],
    } : STRONG_SCHEMA,
    maxTokens: 500,
    frontImage,
    backImage,
    prompt: `Read two things from this sports card exactly as printed. Do not guess.

${cardNumberPrompt(ex)}
Put it in cardNumberText and its location in location.

PLAYER NAME:
Copy the player's full name exactly as printed on the nameplate, letter by letter, into playerNameText (stylized capitals like ${ex.stylizedName} are one word). Null if not readable.

COPYRIGHT YEAR:
Find the copyright line (starts with "©", usually tiny text at the bottom of the back). Zoom in and copy ONLY its 4-digit year into copyrightYearText (for example "2025"). Read each digit carefully; do not use birth dates, draft years, or stats. Null if not readable.

${SERIAL_PROMPT}${v2 ? v2Extras("strong").prompt : ""}`,
  });
}

// Real trading-card manufacturers. A "brand" outside this list (a sponsor,
// a printer, a team) is never used as the brand.
const KNOWN_BRANDS = [
  "Topps", "Bowman", "Panini", "Donruss", "Upper Deck", "Fleer", "Score", "Leaf",
  "Pinnacle", "Pacific", "SkyBox", "Playoff", "Press Pass", "Sage", "Wild Card",
  "Classic", "Pro Set", "Hoops", "O-Pee-Chee", "Futera", "Collector's Edge",
  "Action Packed", "Star", "Goudey", "Philadelphia", "Parkhurst", "Onyx", "Tristar",
  "Leaf Trading Cards", "Select", "Stadium Club",
];
const knownBrand = (v) => {
  const x = normWords(v);
  return x ? KNOWN_BRANDS.find((b) => x === normWords(b) || x.startsWith(normWords(b))) || null : null;
};

// Jersey numbers, sponsor names, and guessed brands never reach the listing.
function applyPrintedTextRules(card, combined, strong, warnings) {
  // 1. Card number must not be the player's jersey number.
  const digits = (v) => cleanPart(v).replace(/[^0-9]/g, "");
  const jerseys = [combined?.jerseyNumberText, strong?.jerseyNumberText].map(digits).filter(Boolean);
  const num = normalizeCode(card.cardNumber);
  if (num && /^[0-9]+$/.test(num) && jerseys.includes(String(Number(num)))) {
    warnings.push(`Card number removed: #${card.cardNumber} is the player's jersey number, not a card number.`);
    card.cardNumber = null;
    if (card.evidence) card.evidence.cardNumberText = null;
  }

  if (!combined) return;

  // 2. Sponsor names are not the brand or set.
  const sponsors = (combined.sponsorNames || []).map(cleanPart).filter(Boolean);
  const isSponsor = (v) => cleanPart(v) && sponsors.some((sp) => sameText(sp, v));
  if (isSponsor(card.brand)) {
    warnings.push(`Brand "${card.brand}" removed: it is a sponsor, not the card maker.`);
    card.brand = null;
  }
  if (isSponsor(card.set)) {
    warnings.push(`Set "${card.set}" removed: it is a sponsor, not the set name.`);
    card.set = null;
  }

  // Junk set names: a single letter/logo, or the brand repeated.
  if (cleanPart(card.set) && (normWords(card.set).length < 2 || normWords(card.set) === normWords(card.brand))) {
    warnings.push(`Set "${card.set}" removed: it is not a real set name.`);
    card.set = null;
  }

  // 3. Brand must be printed on the card (logo text or copyright line), never guessed.
  const printedBrand = knownBrand(combined.brandNameText);
  const copyright = cleanPart(card.evidence?.copyrightLineText);
  if (cleanPart(card.brand) && !knownBrand(card.brand)) {
    warnings.push(`Brand "${card.brand}" removed: it is not a trading-card manufacturer.`);
    card.brand = null;
  }
  if (cleanPart(card.brand)) {
    const supported =
      (printedBrand && sameText(printedBrand, card.brand)) ||
      (copyright && copyright.toLowerCase().includes(cleanPart(card.brand).toLowerCase()));
    if (!supported) {
      warnings.push(
        printedBrand
          ? `Brand changed from "${card.brand}" to "${printedBrand}", the name printed on the card.`
          : `Brand "${card.brand}" removed: no manufacturer name is printed on the card.`,
      );
      card.brand = printedBrand && !isSponsor(printedBrand) ? printedBrand : null;
    }
  } else if (printedBrand && !isSponsor(printedBrand)) {
    card.brand = printedBrand;
  }
}

// Reads the serial from the optional close-up photo, twice with two models.
const CLOSEUP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    stampedSerial: { type: ["string", "null"] },
    isDate: { type: "boolean" },
  },
  required: ["stampedSerial", "isDate"],
};

function readSerialCloseup(serialImage, model, ex = promptExamples(false)) {
  return askVision({
    model,
    name: "serial_closeup",
    schema: CLOSEUP_SCHEMA,
    maxTokens: 100,
    frontImage: serialImage,
    backImage: null,
    prompt: `This is a close-up photo of part of a sports card, taken to show its stamped serial number (for example ${ex.closeupSerial}).
Read every digit carefully and copy the serial exactly as printed into stampedSerial. Keep leading zeros.
If the text is a date (for example "9/14/25") set isDate to true. If there is no serial number, or you cannot read every digit with certainty, set stampedSerial to null. Do not guess digits.`,
  });
}

// ---- Outside matches: CardSight catalog + eBay Browse active listings ----
// Outside data only fills in or corrects year/set/parallel when it clearly matches
// the details we already verified from the card (player + card number).
function applyCatalogMatch(card, cs, warnings) {
  const out = { configured: cardsightConfigured(), status: "not_checked", match: null };
  if (!out.configured) { out.status = "not_configured"; return out; }
  if (!cs || cs.error) { out.status = "error"; out.error = cs?.error || "no response"; return out; }
  const c = cs.detection?.card;
  if (!c?.name) { out.status = "no_match"; return out; }
  out.match = { id: c.id || null, name: c.name, year: c.year, manufacturer: c.manufacturer, release: c.releaseName, set: c.setName, number: c.number, numberedTo: c.numberedTo || null, attributes: c.attributes || [] };

  const last = cleanPart(card.player).split(/\s+/).pop()?.toLowerCase();
  const playerOk = last && c.name.toLowerCase().includes(last);
  const numberOk = card.cardNumber && normalizeCode(c.number) === normalizeCode(card.cardNumber);
  if (!playerOk || !numberOk) {
    out.status = "rejected";
    out.reason = !playerOk ? "catalog player does not match the card" : "catalog card number does not match the card";
    warnings.push(`Catalog match "${c.name} #${c.number || "?"}" ignored: ${out.reason}.`);
    return out;
  }

  out.status = "accepted";
  const year = Number(c.year) || null;
  if (year && year !== card.year) {
    warnings.push(card.year ? `Year changed from ${card.year} to ${year} (catalog match).` : `Year ${year} filled from catalog match.`);
    card.year = year;
  }
  const set = [c.releaseName, c.setName && !/^base( set)?$/i.test(c.setName) ? c.setName : null].filter(Boolean).join(" ");
  if (set && !sameText(set, card.set)) {
    warnings.push(`Set set to "${set}" from catalog match${card.set ? ` (scan said "${card.set}")` : ""}.`);
    card.set = set;
  }
  if (knownBrand(c.manufacturer)) card.brand = knownBrand(c.manufacturer);

  // Parallel: CardSight's photo guesses are suggestions only (they have been wrong, e.g. a blue jersey read as "Blue").
  // A guess can only be used when it is the only one numbered to the card's serial print run.
  const pr = resolveParallel(c);
  let parallel = null;
  if (card.numberedTo) {
    const fits = (c.parallelSuggestions || []).filter((p) => Number(p.numberedTo) === Number(card.numberedTo));
    if (fits.length === 1) parallel = fits[0];
  }
  out.rawParallels = c.parallelSuggestions || [];
  if (parallel?.name) {
    warnings.push(`Parallel "${parallel.name}" from catalog match.`);
    card.parallel = parallel.name;
    out.parallelConfirmed = true;
  } else if (pr.candidates?.length) {
    out.parallelCandidates = pr.candidates;
  }
  return out;
}

async function ebayOutsideMatches(card) {
  const out = { configured: ebayConfigured(), status: "not_checked", listings: [] };
  if (!out.configured) { out.status = "not_configured"; return out; }
  if (!cleanPart(card.player)) { out.status = "skipped"; return out; }
  const q = [card.player, card.cardNumber ? `#${card.cardNumber}` : "", card.numberedTo ? `/${card.numberedTo}` : "", card.autograph ? "auto" : ""]
    .filter(Boolean).join(" ");
  try {
    const items = await ebaySearch(q);
    const last = cleanPart(card.player).split(/\s+/).pop().toLowerCase();
    const num = card.cardNumber ? normalizeCode(card.cardNumber) : null;
    const matches = items.filter((i) => {
      const t = i.title.toLowerCase();
      const tn = i.title.toUpperCase().replace(/[^A-Z0-9#/ ]/g, " ");
      return t.includes(last) && (!num || new RegExp(`(#|NO\\.?\\s*)${num}\\b`).test(tn)) &&
        (!card.numberedTo || t.includes(`/${card.numberedTo}`));
    });
    out.query = q;
    out.status = matches.length ? "matches_found" : "no_matches";
    out.listings = matches.slice(0, 8);
    const years = matches.map((m) => Number((m.title.match(/\b(20\d\d)\b/) || [])[1])).filter(Boolean);
    const counts = years.reduce((a, y) => ((a[y] = (a[y] || 0) + 1), a), {});
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (top) out.yearVotes = counts;
    out.topYear = top && top[1] >= 3 && top[1] / years.length >= 0.75 ? Number(top[0]) : null;
  } catch (e) {
    out.status = "error";
    out.error = e.message;
  }
  return out;
}

// ---- Generic parallel identification ----
// "Autograph Variation", "Rookie", "Base" etc. describe the card type, not a parallel.
const NOT_PARALLEL_WORDS = new Set(["autograph", "autographs", "auto", "autos", "variation", "variations", "rookie", "rookies", "rc", "base", "card", "cards", "version", "signed", "signature", "signatures", "insert", "parallel"]);
function isCardTypeNotParallel(name) {
  const words = cleanPart(name).toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  return words.length > 0 && words.every((w) => NOT_PARALLEL_WORDS.has(w));
}

const FINISH_WORDS = {
  plain_refractor: [], wave: ["wave"], lava: ["lava"], geometric: ["geometric"],
  football_leather: ["leather"], prizm: ["prizm"], xfractor: ["x-fractor", "xfractor"],
  pulsar: ["pulsar"], raywave: ["raywave"], prism: ["prism"], shimmer: ["shimmer"], mojo: ["mojo"], cracked_ice: ["cracked ice"],
};
const ALL_FINISH_WORDS = [...Object.values(FINISH_WORDS).flat(), "neon pulse", "molten", "frozenfractor", "superfractor", "tie-dye"];
// Colors that look alike under different light / phone cameras.
const COLOR_FAMILIES = [
  ["pink", "magenta", "purple", "fuchsia"],
  ["blue", "aqua", "teal", "sky"],
  ["gold", "yellow", "orange"],
  ["red", "orange"],
  ["silver", "white"],
];
const COLOR_WORDS = ["pink", "blue", "gold", "green", "purple", "orange", "red", "black", "aqua", "teal", "yellow", "white", "silver", "bronze", "magenta", "sky"];

function findChecklist(card) {
  const text = `${cleanPart(card.brand)} ${cleanPart(card.set)}`.toLowerCase();
  return PARALLEL_CHECKLISTS.find((c) =>
    (!c.year || c.year === card.year) &&
    c.include.every((w) => text.includes(w)) &&
    !c.exclude.some((w) => text.includes(w)),
  ) || null;
}

// Narrow a candidate list by print run, then color, then finish. Only one survivor counts.
function resolveParallelFromCandidates(candidates, { numberedTo, color, finish }) {
  // Unnumbered, no parallel color, no special finish: a base card, not a parallel.
  if (!numberedTo && !cleanPart(color) && (!finish || ["no_shine", "unknown", "other"].includes(finish))) {
    return { parallel: null, candidates: [], steps: [], base: true };
  }
  let list = candidates.slice();
  const steps = [];
  if (numberedTo === "any") {
    steps.push("print run unknown");
  } else if (numberedTo) {
    list = list.filter((p) => Number(p.numberedTo) === Number(numberedTo));
    steps.push(`/${numberedTo}`);
  } else {
    // Unnumbered card: only unnumbered parallels are possible.
    list = list.filter((p) => !p.numberedTo);
  }
  // Color and finish must AGREE with a candidate; a conflict means no confirmation.
  const words = (p) => p.name.toLowerCase().split(/[\s,-]+/);
  const col = cleanPart(color).toLowerCase();
  let colorConflict = false;
  if (col) {
    const exact = list.filter((p) => words(p).includes(col));
    const family = (COLOR_FAMILIES.find((f) => f.includes(col)) || [col]);
    const near = list.filter((p) => family.some((c) => words(p).includes(c)));
    if (exact.length) { list = exact; steps.push(col); }
    else if (near.length) { list = near; steps.push(`${col} (close to ${family.join("/")})`); }
    else { colorConflict = true; } // keep the print-run candidates; a closer look decides
  } else {
    list = list.filter((p) => !COLOR_WORDS.some((c) => words(p).includes(c)));
    steps.push("no color");
  }
  if (finish && finish !== "unknown" && finish !== "other") {
    const fw = FINISH_WORDS[finish];
    list = fw?.length
      ? list.filter((p) => fw.some((w) => p.name.toLowerCase().includes(w)))
      : list.filter((p) => !ALL_FINISH_WORDS.some((w) => p.name.toLowerCase().includes(w))); // plain refractor
    steps.push(finish.replace(/_/g, " "));
  }
  if (colorConflict) return { parallel: null, candidates: list.slice(0, 6), steps, colorConflict: true };
  return { parallel: list.length === 1 ? list[0] : null, candidates: list.slice(0, 6), steps };
}

function applyParallelIdentification(card, combined, catalogCandidates, warnings, printRunHint = null) {
  const out = { source: null, status: "not_checked", candidates: [] };
  const scanned = cleanPart(card.parallel);
  if (scanned && isCardTypeNotParallel(scanned)) {
    warnings.push(`Parallel "${scanned}" removed: that describes the card type, not a parallel.`);
    card.parallel = null;
  }

  const evidence = { numberedTo: card.numberedTo, color: combined?.parallelColor, finish: combined?.parallelFinish };
  // No confirmed serial, but both checks saw one: use the print run they agree on
  // ("/250") for narrowing, or skip print-run narrowing if they don't agree.
  let printRunUncertain = false;
  if (!card.numberedTo && printRunHint?.seen) {
    if (printRunHint.numberedTo) evidence.numberedTo = printRunHint.numberedTo;
    else evidence.numberedTo = "any";
    printRunUncertain = true;
    evidence.printRunFrom = printRunHint.numberedTo ? "both checks agree on the print run" : "print run unreadable";
  }
  const checklist = findChecklist(card);
  // The checklist always wins. CardSight's photo guesses are only a fallback and can never confirm a parallel alone.
  const guessOnly = !checklist?.parallels && !!catalogCandidates?.length;
  const candidates = checklist?.parallels || (guessOnly ? catalogCandidates : null);
  out.source = checklist ? checklist.id : guessOnly ? "catalog_suggestions" : null;
  out.guessOnly = guessOnly;
  out.evidence = evidence;

  if (!candidates) {
    out.status = "no_checklist";
    if (card.parallel) warnings.push(`Parallel "${card.parallel}" is unconfirmed: no checklist for this product yet.`);
    return out;
  }

  const r = resolveParallelFromCandidates(candidates, evidence);
  out.candidates = r.candidates.map((p) => `${p.name}${p.numberedTo ? ` /${p.numberedTo}` : ""}`);
  out.candidateObjects = r.candidates;
  out.printRunUncertain = printRunUncertain;
  if (r.base) {
    out.status = "base";
    if (card.parallel) warnings.push(`Parallel "${card.parallel}" removed: the card looks like a base card (no serial, color, or special finish).`);
    card.parallel = null;
    return out;
  }
  if (r.parallel && guessOnly) {
    out.status = "probable";
    out.probable = r.parallel.name;
    warnings.push(`Parallel possibly "${r.parallel.name}" (CardSight photo guess, no checklist to confirm it).`);
    return out;
  }
  if (r.parallel && printRunUncertain) {
    // Serial not confirmed: report it as probable, never write it to the card.
    out.status = "probable";
    out.probable = r.parallel.name;
    warnings.push(`Parallel probably "${r.parallel.name}" (checklist), but the serial was not confirmed. Add a serial close-up to confirm.`);
    return out;
  }
  if (r.parallel) {
    out.status = "confirmed";
    if (!sameText(r.parallel.name, card.parallel)) {
      warnings.push(`Parallel set to "${r.parallel.name}" from the checklist (matched ${r.steps.join(" + ")})${card.parallel ? `; scan said "${card.parallel}"` : ""}.`);
    }
    card.parallel = r.parallel.name;
  } else {
    out.status = r.candidates.length ? "ambiguous" : "no_match";
    warnings.push(
      r.candidates.length
        ? `Parallel unclear: could be ${out.candidates.join(", ")}. Confirm on the card.`
        : `No parallel in the checklist matches${card.numberedTo ? ` /${card.numberedTo}` : ""}${evidence.color ? ` ${evidence.color}` : ""}; parallel left blank.`,
    );
    card.parallel = null;
  }
  return out;
}

// Player name: majority of three independent reads (main scan + two checks).
function resolvePlayerName(card, combined, strong, warnings) {
  const norm = (v) => cleanPart(v).toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, "");
  const reads = [card.player, combined?.playerNameText, strong?.playerNameText].map(cleanPart).filter(Boolean);
  if (reads.length < 2) return;
  const counts = reads.reduce((a, v) => ((a[norm(v)] = (a[norm(v)] || 0) + 1), a), {});
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 1) {
    // Same letters, different punctuation (e.g. "DE'MARCO" vs "DEMARCO"): use the spelling most reads gave.
    const spell = reads.reduce((a, v) => ((a[v.toUpperCase()] = (a[v.toUpperCase()] || 0) + 1), a), {});
    const best = Object.entries(spell).sort((x, y) => y[1] - x[1])[0];
    if (best[1] >= 2 && best[0] !== cleanPart(card.player).toUpperCase()) {
      card.player = reads.find((r) => r.toUpperCase() === best[0]);
    }
    return;
  }
  if (ranked[0][1] >= 2) {
    const winner = reads.find((r) => norm(r) === ranked[0][0]);
    if (norm(winner) !== norm(card.player)) {
      warnings.push(`Player name corrected from "${card.player}" to "${winner}" (2 of 3 reads agree).`);
      card.player = winner;
      if (card.evidence) card.evidence.playerNameText = winner;
    }
  } else {
    warnings.push(`Player name unclear: reads were ${reads.map((r) => `"${r}"`).join(", ")}.`);
    card.player = null;
  }
}

// When the checklist leaves 2+ candidates, ask the stronger model to pick one, from the list only.
async function parallelTiebreak(frontImage, candidates, model = process.env.OPENAI_TIEBREAK_MODEL || "gpt-4o") {
  const options = candidates.map((c) => c.name);
  const r = await askVision({
    model,
    name: "parallel_tiebreak",
    maxTokens: 150,
    frontImage,
    backImage: null,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: { answer: { type: "string", enum: [...options, "unsure"] }, reason: { type: "string" } },
      required: ["answer", "reason"],
    },
    prompt: `This sports card is one of these parallels: ${options.map((o) => `"${o}"`).join(", ")}.
Pattern guide: plain "Refractor" = smooth rainbow shine with NO repeating pattern; "Wave" = clear wavy lines across the card; "Lava" = bubbly blobs; "Geometric" = repeating shapes; "Football Leather" = pebbled texture.
Look only at the card's background/border surface. Answer with the matching name, or "unsure" if you cannot tell.`,
  });
  return r && options.includes(r.answer) ? r : null;
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
    if (comps.status === "parallel_not_confirmed" && comps.error) {
      return `${cardText}${traitText}. ${comps.error} Open the sold-comps search link to check manually.`;
    }
    return `${cardText}${traitText}. No reliable sold prices were auto-loaded; open the sold-comps search link to verify manually.`;
  }

  return `${cardText}${traitText}. Based on ${comps.count} sold ${
    comps.count === 1 ? "listing" : "listings"
  }, prices range from ${formatMoney(comps.min)} to ${formatMoney(
    comps.max,
  )}, with a median of ${formatMoney(comps.median)}.${
    comps.parallelName ? ` Sales are for the ${comps.parallelName} parallel only.` : ""
  }${
    card.grade && comps.source === "cardsight_completed_auctions"
      ? " These are raw (ungraded) sales; graded prices can differ."
      : ""
  }`;
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

    if (subscriptionsEnabled()) {
      const user = await authenticatedUser(req);
      if (!user) return res.status(401).json({error:"Sign in to scan cards."});
      const requestId = crypto.randomUUID();
      const allowed = await reserveScan(user.id, requestId);
      if (!allowed) return res.status(402).json({error:"No scans available on your current plan."});
    }

    const { files, fields: formFields } = await parseForm(req);
    // Pipeline v2: "off" (default, today's scanner), "shadow" (test only: runs v2 next to
    // v1 and returns it under "v2"), or "primary" (only when GV_PIPELINE=v2 is set).
    const v2Mode = pipelineV2Mode(formFields);
    const ex = promptExamples(v2Mode !== "off");

    const frontFile =
      getFile(files, "front") ||
      getFile(files, "image") ||
      getFile(files, "card");

    const backFile = getFile(files, "back");

    const frontImage = fileToDataUrl(frontFile);
    const backImage = fileToDataUrl(backFile);
    // Optional close-up photo of the serial number.
    const serialImage = fileToDataUrl(getFile(files, "serial"));

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
- "cardNumber" must be copied character-for-character from the printed card number, including letter prefixes (for example ${ex.mainCardNumber}).
- "serialNumber" is ONLY a stamped serial like "07/25" or "12/99". Dates such as "9/14/25" (often printed under "Rookie Debut" or similar) are NOT serial numbers. Copy a real serial into evidence.serialNumberText; otherwise use null for serialNumber, numberedTo, and serialNumberText.
- "parallel" is the NAME of the parallel or insert printed on the card (for example ${ex.mainParallel}). Never put a number or serial in "parallel". Copy the printed parallel/insert text into evidence.parallelText, or null.
- Only list real, existing products as alternates.
- A jersey/uniform number (for example "#32" next to the player's name or position) is NOT the card number.
- Sponsor or advertiser names (for example ${ex.mainSponsor}) are NOT the brand or set.
- "brand" must be a manufacturer name printed on the card or in the copyright line. If none is printed, use null; never guess from the design or era.`,
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

    // All three reads run at the same time and do not depend on each other.
    const safe = (label, promise) =>
      promise.catch((e) => {
        console.error(`${label} failed:`, e);
        return null;
      });

    const mainScan = askVision({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
      name: "sports_card_identification",
      schema: v2Mode !== "off" ? {
        ...CARD_SCHEMA,
        properties: { ...CARD_SCHEMA.properties, ...v2Extras("main").properties },
        required: [...CARD_SCHEMA.required, ...v2Extras("main").required],
      } : CARD_SCHEMA,
      maxTokens: 1200,
      frontImage,
      backImage,
      prompt: content[0].text + (v2Mode !== "off" ? v2Extras("main").prompt : ""),
    });

    const catalogPromise = cardsightConfigured()
      ? cardsightIdentify(fs.readFileSync(frontFile.filepath), frontFile.mimetype).catch((e) => ({ error: e.message }))
      : Promise.resolve(null);

    const [scanResult, combinedCheck, strongCheck] = await Promise.all([
      mainScan,
      safe("combined check", runCombinedCheck(frontImage, backImage, ex, v2Mode !== "off")),
      safe("strong check", runStrongCheck(frontImage, backImage, ex, v2Mode !== "off")),
    ]);

    if (!scanResult) {
      throw new Error("OpenAI returned an empty identification.");
    }
    // Raw reads, before any rule touches them (v2 works from these; also kept for test replay).
    const rawReads = v2Mode !== "off" ? structuredClone({ main: scanResult, combined: combinedCheck, strong: strongCheck }) : null;

    for (const [k, v] of Object.entries(scanResult)) {
      if (typeof v === "string" && !cleanPart(v)) scanResult[k] = null;
    }

    const alternates = Array.isArray(scanResult.alternates)
      ? scanResult.alternates.slice(0, 5)
      : [];

    delete scanResult.alternates;

    const detailWarnings = [];
    const firstCardNumber = cleanPart(scanResult.cardNumber).replace(/^#/, "");
    applyDetailCheck(scanResult, combinedCheck, detailWarnings);

    // Card number: strong read decides, checked against the two cheaper reads.
    const secondCardNumber = cleanPart(combinedCheck?.cardNumberText).replace(/^#/, "");
    if (strongCheck) {
      const resolved = resolveCardNumber([firstCardNumber, secondCardNumber], strongCheck.cardNumberText);
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

    applyPrintedTextRules(scanResult, combinedCheck, strongCheck, detailWarnings);
    resolvePlayerName(scanResult, combinedCheck, strongCheck, detailWarnings);

    const eventYears = (combinedCheck?.eventYears || [])
      .map((y) => Number((String(y).match(/\b(19|20)\d\d\b/) || [])[0]))
      .filter((y) => y && y <= new Date().getFullYear() + 1);
    const latestEvent = eventYears.length ? Math.max(...eventYears) : null;

    // Year: the stronger model reads the copyright year independently.
    const strongYear = Number((cleanPart(strongCheck?.copyrightYearText).match(/\b(19|20)\d\d\b/) || [])[0]);
    const tooEarly = (y) => latestEvent && y < latestEvent;
    if (strongYear && scanResult.year && strongYear !== scanResult.year && tooEarly(strongYear) && !tooEarly(scanResult.year)) {
      // Strong read is impossible (before a printed draft/bio year): keep the main read.
    } else if (strongYear && scanResult.year && strongYear !== scanResult.year && tooEarly(scanResult.year) && !tooEarly(strongYear)) {
      detailWarnings.push(`Year corrected from ${scanResult.year} to ${strongYear}: ${scanResult.year} is before ${latestEvent}, a year printed on the card.`);
      scanResult.year = strongYear;
      if (scanResult.evidence) {
        scanResult.evidence.yearText = String(strongYear);
        scanResult.evidence.copyrightLineText = `© ${strongYear}`;
      }
    } else if (strongYear && scanResult.year && strongYear !== scanResult.year) {
      detailWarnings.push(
        `Year removed: the reads disagree on the copyright year (${scanResult.year} vs ${strongYear}).`,
      );
      scanResult.year = null;
      if (scanResult.evidence) {
        scanResult.evidence.yearText = null;
        scanResult.evidence.copyrightLineText = null;
      }
    } else if (strongYear && !scanResult.year) {
      scanResult.year = strongYear;
    }

    if (scanResult.year && latestEvent && scanResult.year < latestEvent) {
      detailWarnings.push(
        `Year removed: ${scanResult.year} is before ${latestEvent}, a year printed on the card (draft/bio). Check the copyright line.`,
      );
      scanResult.year = null;
      if (scanResult.evidence) {
        scanResult.evidence.yearText = null;
        scanResult.evidence.copyrightLineText = null;
      }
    }

    // Automatically enlarge both original photos when the full-card readers missed or disagree on a stamp.
    // Two independent reads must agree; catalog print runs are never used as photo evidence.
    let serialPhotoRetry = null;
    const mainSerial = serialValue(scanResult.serialNumber);
    const checkA = serialValue(combinedCheck?.stampedSerial);
    const checkB = serialValue(strongCheck?.stampedSerial);
    const sameSerial = (a, b) => a && b && a.num === b.num && a.den === b.den;
    if (!serialImage && (!mainSerial || !sameSerial(mainSerial, checkA) || !sameSerial(mainSerial, checkB))) {
      serialPhotoRetry = await readSerialFromPhotos(frontImage, backImage, askVision, {
        fast: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
        strong: process.env.OPENAI_TIEBREAK_MODEL || "gpt-4o",
      });
      if (serialPhotoRetry.serial) {
        const stamp = serialPhotoRetry.serial;
        scanResult.serialNumber = stamp.text;
        scanResult.numberedTo = stamp.den;
        if (scanResult.evidence) scanResult.evidence.serialNumberText = stamp.text;
        // Preserve original full-card observations. Overwriting them would
        // manufacture agreement and hide digit transpositions such as 037/375.
        detailWarnings.push("Physical serial recovered automatically from enlarged photos by two independent reads.");
      }
    }

    // Close-up serial photo: if both reads agree on a valid, non-date serial, use it.
    let closeupSerial = null;
    let verification_closeup = null;
    if (serialImage) {
      const [c1, c2] = await Promise.all([
        safe("serial close-up read 1", readSerialCloseup(serialImage, process.env.OPENAI_VISION_MODEL || "gpt-4o-mini", ex)),
        safe("serial close-up read 2", readSerialCloseup(serialImage, process.env.OPENAI_TIEBREAK_MODEL || "gpt-4o", ex)),
      ]);
      let p1 = c1 && !c1.isDate ? parseSerial(c1.stampedSerial) : null;
      const p2 = c2 && !c2.isDate ? parseSerial(c2.stampedSerial) : null;
      let shown = `"${c1?.stampedSerial ?? "none"}" / "${c2?.stampedSerial ?? "none"}"`;
      // The smaller model missed the serial (no conflicting value): take one more independent
      // read with the stronger model; the two stronger reads must still agree exactly.
      if (!p1 && p2 && !cleanPart(c1?.stampedSerial)) {
        const c3 = await safe("serial close-up read 3", readSerialCloseup(serialImage, process.env.OPENAI_TIEBREAK_MODEL || "gpt-4o", ex));
        const p3 = c3 && !c3.isDate ? parseSerial(c3.stampedSerial) : null;
        shown += ` / "${c3?.stampedSerial ?? "none"}"`;
        if (p3) p1 = p3;
      }
      if (p1 && p2 && p1.num === p2.num && p1.den === p2.den) {
        closeupSerial = { text: cleanPart(c2.stampedSerial), ...p1 };
        detailWarnings.push(`Serial ${closeupSerial.text} confirmed from the close-up photo by two separate reads.`);
      } else {
        detailWarnings.push(`Serial close-up could not be confirmed (reads: ${shown}). Retake it closer, with less glare.`);
      }
      verification_closeup = { reads: [c1, c2] };
    }
    // Close-up result replaces whatever the full-card scan said about the serial.
    if (serialImage) {
      scanResult.serialNumber = closeupSerial ? closeupSerial.text : null;
      scanResult.numberedTo = closeupSerial ? closeupSerial.den : null;
      if (scanResult.evidence) scanResult.evidence.serialNumberText = scanResult.serialNumber;
    }

    // Outside matches (only used when they agree with the verified player + card number).
    const catalog = applyCatalogMatch(scanResult, await catalogPromise, detailWarnings);
    const catalogParallels = catalog.status === "accepted" && !catalog.parallelConfirmed
      ? (catalog.rawParallels || []).map((p) => ({ name: p.name, numberedTo: p.numberedTo || null }))
      : null;
    const ebayMatches = await ebayOutsideMatches(scanResult);
    // Active listings are not catalog data: a year they agree on is only a suggestion.
    if (ebayMatches.topYear && !scanResult.year) {
      ebayMatches.suggestedYear = ebayMatches.topYear;
      detailWarnings.push(`Year not read from the card; matching eBay listings suggest ${ebayMatches.topYear} (unconfirmed).`);
    }
    if (catalog.status === "accepted" && scanResult.evidence && scanResult.year) {
      scanResult.evidence.yearText = String(scanResult.year);
      scanResult.evidence.copyrightLineText = `© ${scanResult.year}`;
    }

    const verification = verifyIdentity(scanResult);
    verification.outside = { catalog, ebay: ebayMatches };

    verification.warnings.push(...detailWarnings);
    verification.detailCheck = combinedCheck;

    if (serialImage) verification.serialCloseup = verification_closeup;
    if (serialPhotoRetry) verification.serialPhotoRetry = serialPhotoRetry;

    // Serial: the two checks above double as the two independent serial reads.
    // (Skipped when a close-up photo already confirmed or ruled out the serial.)
    if (!serialImage && (cleanPart(scanResult.serialNumber) || scanResult.numberedTo)) {
      const serialChecks = serialPhotoRetry?.serial ? serialPhotoRetry.reads : [combinedCheck, strongCheck];
      applySerialCheck(scanResult, serialChecks, verification.warnings);
      verification.serialCheck = serialChecks.map((c) =>
        c ? { stampedSerial: c.stampedSerial, side: c.stampedSerialSide, slashTexts: c.slashTexts } : null,
      );
    }
    // Parallel is resolved AFTER the serial checks, so an invented serial can never pick a parallel.
    verification.parallelId = catalog.parallelConfirmed
      ? { source: "catalog", status: "confirmed" }
      : applyParallelIdentification(scanResult, combinedCheck, catalogParallels, verification.warnings, (() => {
          const a = parseSerial(combinedCheck?.stampedSerial);
          const b = parseSerial(strongCheck?.stampedSerial);
          if (!a || !b) return null;
          return { seen: true, numberedTo: a.den === b.den ? a.den : null };
        })());

    if (verification.parallelId.status === "ambiguous" && verification.parallelId.candidateObjects?.length <= 4) {
      const tb = await parallelTiebreak(frontImage, verification.parallelId.candidateObjects).catch(() => null);
      if (tb && verification.parallelId.guessOnly) {
        verification.parallelId.status = "probable";
        verification.parallelId.probable = tb.answer;
        verification.warnings.push(`Parallel possibly "${tb.answer}" (closer look among CardSight photo guesses; no checklist to confirm it).`);
      } else if (tb && verification.parallelId.printRunUncertain) {
        verification.parallelId.status = "probable";
        verification.parallelId.probable = tb.answer;
        verification.warnings.push(`Parallel probably "${tb.answer}" (closer look), but the serial was not confirmed. Add a serial close-up to confirm.`);
      } else if (tb) {
        scanResult.parallel = tb.answer;
        verification.parallelId.status = "confirmed_by_tiebreak";
        const i = verification.warnings.findIndex((w) => w.startsWith("Parallel unclear"));
        if (i >= 0) verification.warnings.splice(i, 1);
        verification.warnings.push(`Parallel "${tb.answer}" picked from the checklist candidates by a closer look (${tb.reason}).`);
      }
    }

    // Avoid "Topps Topps Chrome": drop a repeated brand from the start of the set name.
    if (cleanPart(scanResult.brand) && cleanPart(scanResult.set)) {
      const b = cleanPart(scanResult.brand);
      const setText = cleanPart(scanResult.set);
      if (setText.toLowerCase().startsWith(b.toLowerCase() + " ")) scanResult.set = setText.slice(b.length + 1);
    }

    // ---- Pipeline v2 (the live scanner; GV_PIPELINE=v1 switches back to v1) ----
    let v2 = null;
    if (v2Mode !== "off") {
      try {
        v2 = await runPipelineV2({
          scan: scanResult,
          raw: rawReads,
          verification,
          serialImage: Boolean(serialImage),
          // v2 only, and only when the full-photo reads do not settle the copyright year:
          // a zoomed-in copyright crop read twice.
          copyrightCloseup: () => readCopyrightCloseup(backImage, askVision, {
            fast: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
            strong: process.env.OPENAI_TIEBREAK_MODEL || "gpt-4o",
          }).catch((e) => ({ reads: [], status: "error", error: e.message })),
          // v2: two independent closer looks (strong + fast model); both must agree to confirm.
          tiebreak: async (candidates) => {
            const [a, b] = await Promise.all([
              parallelTiebreak(frontImage, candidates).catch(() => null),
              parallelTiebreak(frontImage, candidates, process.env.OPENAI_VISION_MODEL || "gpt-4o-mini").catch(() => null),
            ]);
            if (!a) return null;
            return { ...a, agreed: Boolean(b && b.answer === a.answer), second: b?.answer || null };
          },
        });
        if (v2Mode === "primary" && v2?.scan) {
          for (const k of ["player", "cardNumber", "parallel"]) scanResult[k] = v2.scan[k];
          if (scanResult.evidence) scanResult.evidence.cardNumberText = v2.scan.cardNumber;
          // Year and set from the checklist only when v2 confirmed them; otherwise keep the read.
          const vf = v2.pipeline?.fields || {};
          if (vf.year?.status === "confirmed" && vf.year.value) scanResult.year = vf.year.value;
          if (vf.set?.status === "confirmed" && vf.set.value) {
            const brand = String(scanResult.brand || "").trim();
            let setName = String(vf.set.value).replace(/^\d{4}(-\d{2})?\s+/, "");
            if (brand && setName.toLowerCase().startsWith(brand.toLowerCase() + " ")) setName = setName.slice(brand.length + 1);
            scanResult.set = setName.replace(/\s+—\s+/g, " "); // plain words for titles/searches
          }
        }
      } catch (e) {
        console.error("pipeline v2 error:", e);
        v2 = { error: e.message };
      }
    }

    const confidence = getConfidence(verification);
    const identityTrusted =
      verification.status === "verified" || verification.status === "likely";

    // Unverified identities never reach pricing or listing titles.
    const query = identityTrusted ? buildSoldCompQuery(scanResult) : "";
    const comps = identityTrusted
      ? await fetchSoldComps(query, scanResult)
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

    // Field-level verification + market data (additive; a failure here never breaks the scan).
    let pipeline = null;
    let market = null;
    let parallelPicker = null;
    try {
      pipeline = buildFieldVerification(scanResult, verification, {
        checklist: findChecklist(scanResult),
        serialImage: Boolean(serialImage),
        identity: verification.identity,
        strongCheck,
      });
    } catch (e) {
      console.error("pipeline error:", e);
    }
    try {
      let catalogSold = null;
      parallelPicker = null;
      let pricingCardId = catalog.status === "accepted" ? catalog.match?.id : null;
      // Same number, different version: e.g. #163 base rookie vs. #163 Rookie Signatures auto.
      // If the photo match disagrees with the scan on autograph / relic, price the version the scan saw instead.
      if (pricingCardId) {
        const m = { setName: `${catalog.match.release || ""} ${catalog.match.set || ""}`, attributes: catalog.match.attributes || [] };
        const autoClash = typeof scanResult.autograph === "boolean" && isAutoCard(m) !== scanResult.autograph;
        const relicClash = typeof scanResult.memorabilia === "boolean" && isRelicCard(m) !== scanResult.memorabilia;
        if (autoClash || relicClash) {
          catalog.versionClash = autoClash
            ? `Photo match was the ${isAutoCard(m) ? "autograph" : "non-autograph"} version, but the scan saw ${scanResult.autograph ? "an autograph" : "no autograph"}; looked up the matching version instead.`
            : `Photo match was the ${isRelicCard(m) ? "relic/patch" : "non-relic"} version, but the scan saw ${scanResult.memorabilia ? "a relic/patch" : "no relic/patch"}; looked up the matching version instead.`;
          verification.warnings.push(catalog.versionClash);
          pricingCardId = null;
        }
      }
      // Photo match was a different card: look the verified card up by player + number + year instead.
      if (identityTrusted && !pricingCardId && catalog.configured && scanResult.player && scanResult.cardNumber) {
        const found = await cardsightFindByDetails({ player: scanResult.player, number: scanResult.cardNumber,
          year: scanResult.year, set: scanResult.set, brand: scanResult.brand,
          autograph: typeof scanResult.autograph === "boolean" ? scanResult.autograph : undefined,
          memorabilia: typeof scanResult.memorabilia === "boolean" ? scanResult.memorabilia : undefined }).catch((e) => ({ status: "error", error: e.message }));
        catalog.detailsLookup = { status: found.status, count: found.count ?? null, error: found.error || null, candidates: found.candidates || [],
          match: found.card ? { id: found.card.id, name: found.card.name, number: found.card.number, release: found.card.releaseName, set: found.card.setName, year: found.card.releaseYear } : null };
        if (found.status === "matched") pricingCardId = found.card.id;
      }
      // Retry a details lookup without the vision-guessed year/set when the
      // initial lookup fails. Accept only a unique matching autograph card.
      if (identityTrusted && !pricingCardId && catalog.configured && scanResult.player && scanResult.cardNumber) {
        const retry = await cardsightFindByDetails({ player: scanResult.player,
          number: scanResult.cardNumber, autograph: scanResult.autograph === true,
          memorabilia: scanResult.memorabilia === true }).catch((e) => ({status:"error",error:e.message}));
        if (retry.status === "matched" && retry.card?.id) {
          pricingCardId = retry.card.id;
          catalog.detailsLookup = {status:"matched",count:retry.count ?? 1,
            match:{id:retry.card.id,name:retry.card.name,number:retry.card.number,
              release:retry.card.releaseName,set:retry.card.setName,year:retry.card.releaseYear},
            from:"unique identity lookup without guessed year/set"};
        }
      }
      if (identityTrusted && pricingCardId) {
        // Comps must be for the same parallel as the card: base, one confirmed parallel, or none at all.
        const effective = v2Mode === "primary" && v2?.pipeline ? v2.pipeline : pipeline;
        const plan = parallelCompsPlan({
          parallel: scanResult.parallel,
          fieldStatus: effective?.fields?.parallel?.status,
          pidStatuses: [verification.parallelId?.status, v2Mode === "primary" ? v2?.parallel?.status : null],
        });
        let parallelId = "null";
        catalog.parallelComps = { mode: plan.mode, name: plan.name || null, reason: plan.reason || null };
        const info = await cardsightCardInfo(pricingCardId).catch((e) => ({ error: e.message }));
        const list = info?.error ? info : info.parallels;
        // A confirmed serial print run (e.g. 13/250) rules out base: use the one parallel with that print run.
        const serialOk = scanResult.numberedTo && (effective?.fields?.serial?.status === "confirmed" || effective?.fields?.serial?.printRunConfirmed === true || Boolean(serialPhotoRetry?.serial && serialValue(scanResult.serialNumber)?.den === serialPhotoRetry.serial.den) || Boolean(closeupSerial && serialValue(scanResult.serialNumber)?.den === closeupSerial.den));
        if (serialOk && plan.mode !== "parallel" && Array.isArray(list)) {
          const runFits = list.filter((p) => p && Number(p.numberedTo) === Number(scanResult.numberedTo)
            && (!p.isPartial || !Array.isArray(p.cards) || p.cards.includes(pricingCardId)));
          if (runFits.length === 1) {
            plan.mode = "parallel"; plan.name = runFits[0].name; delete plan.reason;
            catalog.parallelComps = { mode: "parallel", name: plan.name, reason: null, from: `only /${scanResult.numberedTo} parallel for this card` };
            if (!scanResult.parallel) scanResult.parallel = plan.name;
            verification.warnings.push(`Parallel "${plan.name}" set from the confirmed serial: it is the only /${scanResult.numberedTo} parallel for this card.`);
          } else if (runFits.length > 1) {
            // Use *independent* visual evidence to disambiguate parallels sharing a print run.
            // Do not select from color alone: the player's uniform can fool the color reader.
            const photoColor = String(combinedCheck?.parallelColor || "").trim().toLowerCase();
            const printedEvidence = String(scanResult.evidence?.parallelText || "").toLowerCase();
            const colorCorroborated = photoColor && printedEvidence.split(/[^a-z0-9]+/).includes(photoColor);
            const colorFits = colorCorroborated ? runFits.filter((p) =>
              String(p.name || "").toLowerCase().split(/[^a-z0-9]+/).includes(photoColor)) : [];
            if (colorFits.length === 1) {
              plan.mode = "parallel";
              plan.name = colorFits[0].name;
              delete plan.reason;
              catalog.parallelComps = { mode: "parallel", name: plan.name, reason: null,
                from: `/${scanResult.numberedTo} serial + two agreeing color reads` };
              if (!scanResult.parallel) scanResult.parallel = plan.name;
            } else {
              plan.mode = "blocked";
              catalog.parallelComps = { mode: "blocked", name: null,
                reason: `Multiple /${scanResult.numberedTo} parallels match (${runFits.map((p) => p.name).join(", ")}); independent color evidence did not identify exactly one.` };
            }
          }
        }
        // Shiny base vs. Holo/Refractor cannot be told apart reliably from photos: the user picks.
        const shinyLookalikes = Array.isArray(list) ? baseLookalikes(list) : [];
        const lookalikes = plan.mode === "base" ? shinyLookalikes : [];
        if (lookalikes.length) {
          plan.mode = "blocked";
          catalog.parallelComps.mode = "blocked";
          catalog.parallelComps.reason = `Base and ${lookalikes.join(" / ")} look almost the same in photos. Pick the parallel below to load sold prices.`;
        }
        if (Array.isArray(list)) {
          const options = parallelOptions(list, pricingCardId);
          const unnumberedCard = !scanResult.numberedTo && effective?.fields?.serial?.status === "confirmed";
          // "Most likely" = the scanner's shortlist, then Base + Holo/Refractor on shiny cards, then CardSight's photo guesses.
          const shortlist = [plan.name, ...(v2?.parallel?.candidates || []), ...(verification.parallelId?.candidates || []).map((c) => String(c).replace(/\s*\/\d+$/, "")),
            ...(shinyLookalikes.length ? ["Base", ...shinyLookalikes] : []), ...(catalog.rawParallels || []).map((p) => p.name)].filter(Boolean);
          parallelPicker = { cardId: pricingCardId, options, selectedId: null, needsPick: false,
            suggestedIds: suggestOptionIds(options, shortlist, { unnumbered: unnumberedCard }) };
        }
        if (plan.mode === "parallel") {
          const pick = Array.isArray(list)
            ? pickParallel(list, { name: plan.name, numberedTo: scanResult.numberedTo, cardId: pricingCardId,
                unnumbered: !scanResult.numberedTo && effective?.fields?.serial?.status === "confirmed" })
            : { status: "error", error: list?.error };
          Object.assign(catalog.parallelComps, { status: pick.status, catalogParallel: pick.parallel ? { id: pick.parallel.id, name: pick.parallel.name, numberedTo: pick.parallel.numberedTo || null } : null,
            candidates: pick.candidates || [], error: pick.error || null });
          if (pick.status === "matched") parallelId = pick.parallel.id;
          else {
            plan.mode = "blocked";
            catalog.parallelComps.reason = pick.status === "error"
              ? "The catalog's parallel list could not be loaded, so sold prices are not shown. Try again shortly."
              : pick.status === "ambiguous"
              ? `More than one catalog parallel could be "${plan.name}" (${pick.candidates.join(", ")}), so sold prices are not shown.`
              : `"${plan.name}" was not found in the catalog for this card, so sold prices are not shown.`;
          }
        }
        if (parallelPicker) {
          parallelPicker.needsPick = plan.mode === "blocked";
          parallelPicker.selectedId = plan.mode === "blocked" ? null : parallelId;
          parallelPicker.reason = plan.mode === "blocked" ? catalog.parallelComps.reason : null;
        }
        if (plan.mode === "blocked") {
          Object.assign(comps, { ...calculateCompStats([]), items: [], status: "parallel_not_confirmed", error: catalog.parallelComps.reason });
        } else {
          catalogSold = await cardsightSoldComps(pricingCardId, { parallelId, parallels: Array.isArray(list) ? list : null,
            cardIsAuto: info && !info.error ? info.isAuto : null }).catch((e) => ({ error: e.message, count: 0 }));
          if (catalogSold && parallelId !== "null") catalogSold.parallelName = catalog.parallelComps.catalogParallel?.name || plan.name;
          catalog.soldLookup = { cardId: pricingCardId, parallelId, count: catalogSold?.count || 0, error: catalogSold?.error || null };
        }
      }
      // When independent magnified-photo reads agree, preserve that evidence in the
      // displayed verification status (a stale earlier pipeline may say unconfirmed).
      if ((serialPhotoRetry?.serial || closeupSerial) && serialValue(scanResult.serialNumber)) {
        const verifiedStamp = serialPhotoRetry?.serial || closeupSerial;
        // A conflicting full-card reading is a warning, not proof that two
        // matching magnified AI reads are correct. Never show green confirmation.
        const serialConflict = [mainSerial, checkA, checkB].some((read) =>
          read && (read.num !== verifiedStamp.num || read.den !== verifiedStamp.den));
        const parsedStamp = serialValue(scanResult.serialNumber);
        if (parsedStamp.num === verifiedStamp.num && parsedStamp.den === verifiedStamp.den) {
          for (const fields of [pipeline?.fields, v2?.pipeline?.fields]) {
            if (fields?.serial) fields.serial = { ...fields.serial, value: scanResult.serialNumber,
              status: serialConflict ? "unconfirmed" : "confirmed", printRunConfirmed: !serialConflict,
              basis: serialConflict ? "Conflicting full-card and magnified serial reads; inspect digits." : "Two independent reads of enlarged card photo." };
          }
        }
      }
      // A normal two-reader serial agreement is also valid confirmation.
      // The earlier verification pipeline can remain stale even when both
      // independent full-card readers agree with the final printed stamp.
      const finalStamp = serialValue(scanResult.serialNumber);
      const fullA = serialValue(combinedCheck?.stampedSerial);
      const fullB = serialValue(strongCheck?.stampedSerial);
      // Two distinct full-card readers may corroborate a stamp even when
      // the third reader returns no serial. A conflicting valid read always
      // blocks confirmation; the catalog print run never counts as a read.
      const fullReads = [mainSerial, fullA, fullB].filter(Boolean);
      const matchingFullReads = finalStamp && fullReads.filter((read) =>
        read.num === finalStamp.num && read.den === finalStamp.den).length;
      const conflictingFullRead = finalStamp && fullReads.some((read) =>
        read.num !== finalStamp.num || read.den !== finalStamp.den);
      const fullAgree = Boolean(finalStamp && matchingFullReads >= 2 && !conflictingFullRead);
      const noConflictingMain = !mainSerial ||
        (mainSerial.num === finalStamp?.num && mainSerial.den === finalStamp?.den);
      const noConflictingCloseup = (!serialPhotoRetry?.serial ||
        (serialPhotoRetry.serial.num === finalStamp?.num && serialPhotoRetry.serial.den === finalStamp?.den)) &&
        (!closeupSerial || (closeupSerial.num === finalStamp?.num && closeupSerial.den === finalStamp?.den));
      if (fullAgree && noConflictingMain && noConflictingCloseup) {
        for (const fields of [pipeline?.fields, v2?.pipeline?.fields]) {
          if (fields?.serial) fields.serial = { ...fields.serial,
            value: scanResult.serialNumber, status: "confirmed", printRunConfirmed: true,
            basis: "Two independent full-card serial reads agree with the final stamp." };
        }
      }
      // A unique catalog card and matched parallel provide stronger identity evidence
      // than the generic vision label ("Topps"). Only promote fields when the
      // catalog lookup is unambiguous and the selected parallel actually matches.
      if (identityTrusted && pricingCardId && catalog.detailsLookup?.status === "matched"
          && catalog.detailsLookup.match && catalog.parallelComps?.status === "matched"
          && Number(catalog.parallelComps.catalogParallel?.numberedTo) === Number(scanResult.numberedTo)) {
        const m = catalog.detailsLookup.match;
        // A unique catalog card also verifies its printed checklist number.
        // Do not promote an OCR guess unless the catalog number matches it.
        const catalogNumber = String(m.number || "").trim();
        if (catalogNumber && normalizeCode(catalogNumber) === normalizeCode(scanResult.cardNumber)) {
          for (const fields of [pipeline?.fields, v2?.pipeline?.fields]) {
            if (fields?.cardNumber) fields.cardNumber = { value: scanResult.cardNumber,
              status: "confirmed", basis: "Unique catalog card with matching checklist number." };
            if (fields?.number) fields.number = { value: scanResult.cardNumber,
              status: "confirmed", basis: "Unique catalog card with matching checklist number." };
          }
        }
        const year = Number(m.year);
        if (year >= 1880 && year <= new Date().getFullYear() + 1) {
          scanResult.year = year;
          if (pipeline?.fields?.year) pipeline.fields.year = { value: year, status: "confirmed", basis: "Unique catalog card match." };
          if (v2?.pipeline?.fields?.year) v2.pipeline.fields.year = { value: year, status: "confirmed", basis: "Unique catalog card match." };
        }
        const release = String(m.release || "").trim().replace(/^(topps\s+){2,}/i, "Topps ");
        if (release && /[a-z]/i.test(release)) {
          scanResult.set = release.replace(/^topps\s+/i, "");
          if (pipeline?.fields?.set) pipeline.fields.set = { value: release, status: "confirmed", basis: "Unique catalog card match." };
          if (v2?.pipeline?.fields?.set) v2.pipeline.fields.set = { value: release, status: "confirmed", basis: "Unique catalog card match." };
        }
        const pname = catalog.parallelComps.catalogParallel?.name;
        if (pname) {
          scanResult.parallel = pname;
          for (const f of [pipeline?.fields, v2?.pipeline?.fields]) if (f?.parallel)
            f.parallel = { value: pname, status: "confirmed", basis: "Matched catalog parallel and serial print run." };
        }
      }
      // Recompute verification summaries after catalog promotions. The pipeline
      // was built earlier, so its original unconfirmed list is otherwise stale.
      for (const result of [pipeline, v2?.pipeline]) {
        if (!result?.fields) continue;
        const keys = ["player","year","set","cardNumber","parallel","serial"];
        result.unconfirmed = keys.filter((key) => result.fields[key]?.status !== "confirmed");
        result.allConfirmed = result.unconfirmed.length === 0;
      }
      // Completed catalog auctions take precedence over blocked or incomplete
      // eBay scraping. Update comps BEFORE computing the market summary.
      if (catalogSold?.count && Array.isArray(catalogSold.items) && catalogSold.items.length) {
        Object.assign(comps, { min: catalogSold.min, max: catalogSold.max, median: catalogSold.median, count: catalogSold.count,
          mean: catalogSold.mean, coverageNote: catalogSold.coverageNote, warnings: catalogSold.warnings, fetchedAt: catalogSold.fetchedAt, latestSaleDate: catalogSold.latestSaleDate,
          items: catalogSold.items, source: catalogSold.source, status: "comps_found", error: null, parallelName: catalogSold.parallelName || null });
      }
      // Trust rule: NEVER value any serial-numbered card from a broad
      // sample unless the serial evidence AND the exact print-run parallel match.
      // This applies to non-autographs as well as autographs.
      const serialField = (v2Mode === "primary" ? v2?.pipeline?.fields?.serial : pipeline?.fields?.serial);
      const parallelMatch = catalog.parallelComps?.status === "matched" &&
        Number.isInteger(Number(scanResult.numberedTo)) &&
        Number(catalog.parallelComps?.catalogParallel?.numberedTo) === Number(scanResult.numberedTo);
      if (scanResult.numberedTo &&
          (serialField?.status !== "confirmed" || !parallelMatch)) {
        Object.assign(comps, { ...calculateCompStats([]), items: [], count: 0,
          status: "exact_match_unverified",
          error: "Numbered card: stamped serial and exact parallel must both be verified before showing sold-price statistics." });
        catalogSold = null;
      }
      market = buildMarket(comps, ebayMatches, catalogSold);
    } catch (e) {
      console.error("market error:", e);
    }

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
        mean: comps.mean, coverageNote: comps.coverageNote, warnings: comps.warnings, fetchedAt: comps.fetchedAt, latestSaleDate: comps.latestSaleDate,
        count: comps.count,
        currency: comps.currency,
        items: comps.items,
        source: comps.source,
        url: comps.sourceUrl,
        searchUrl: comps.searchUrl,
        status: comps.status,
        error: comps.error,
      },
      pipeline: v2Mode === "primary" && v2?.pipeline ? v2.pipeline : pipeline,
      ...(v2Mode !== "off" ? { v2: { mode: v2Mode, ...v2, pipelineV1: pipeline, ...(v2Mode === "shadow" ? { debug: { raw: rawReads } } : {}) } } : {}),
      market,
      parallelPicker,
      integrations: integrationStatus({ cardsight: cardsightConfigured(), ebay: ebayConfigured() }),
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
