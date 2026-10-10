// Genius Vault verification pipeline (field level).
//
// Runs AFTER the existing scanner checks and never changes the scan itself — it only
// labels each identity field as Confirmed or Unconfirmed and explains why.
//
//   Confirmed   = the value agrees with catalog data (CardSight) or with a product
//                 checklist, on top of agreeing reads from the card photo.
//   Unconfirmed = anything else: missing, conflicting, only read from the photo with
//                 nothing to check it against, or only suggested by eBay listings.
//
// No individual cards are hard-coded here; checklists live in api/_data and are per product.

const FIELDS = ["year", "set", "cardNumber", "parallel", "serial"];
// The exact serial (e.g. 157 of /250) only needs a close-up when it matters to the seller.

function present(v) {
  return v !== null && v !== undefined && String(v).trim() !== "";
}

function field(value, status, basis) {
  return { value: present(value) ? value : null, status, basis };
}

/**
 * @param {object} card          final scanResult
 * @param {object} v             verification object built by scan.js
 * @param {object} ctx           { checklist, serialImage:boolean, identity:{yearOk,numberOk,setOk} }
 */
export function buildFieldVerification(card, v, ctx = {}) {
  const catalog = v?.outside?.catalog || {};
  const catalogOk = catalog.status === "accepted";
  const ebay = v?.outside?.ebay || {};
  const checklist = ctx.checklist || null;
  const idn = ctx.identity || {};
  const pid = v?.parallelId || {};
  const fields = {};

  // --- Year ---
  if (!present(card.year)) {
    fields.year = field(null, "unconfirmed",
      ebay.suggestedYear ? `Not read from the card. eBay listings suggest ${ebay.suggestedYear} (not proof).` : "Not readable on the card.");
  } else if (catalogOk && Number(catalog.match?.year) === Number(card.year)) {
    fields.year = field(card.year, "confirmed", "Matches the catalog (CardSight).");
  } else if (checklist && checklist.year === Number(card.year) && idn.yearOk) {
    fields.year = field(card.year, "confirmed", `Copyright line agrees and matches the ${checklist.label || checklist.id} checklist.`);
  } else {
    fields.year = field(card.year, "unconfirmed",
      idn.yearOk ? "Read from the copyright line; no catalog/checklist to check it against." : "Copyright line not confirmed.");
  }

  // --- Set ---
  const setText = [card.brand, card.set].filter(present).join(" ");
  if (!present(card.set)) {
    fields.set = field(setText || null, "unconfirmed", "Set name not identified.");
  } else if (catalogOk) {
    fields.set = field(setText, "confirmed", "Matches the catalog (CardSight).");
  } else if (checklist) {
    fields.set = field(setText, "confirmed", `Matches the ${checklist.label || checklist.id} checklist.`);
  } else {
    fields.set = field(setText, "unconfirmed", "Read from the card; no catalog/checklist for this product yet.");
  }

  // --- Card number ---
  const num = present(card.cardNumber) ? String(card.cardNumber).replace(/^#/, "") : null;
  const patterns = (checklist?.cardNumberPatterns || []).map((p) => new RegExp(p, "i"));
  if (!num) {
    fields.cardNumber = field(null, "unconfirmed", "Card number not readable or reads disagreed.");
  } else if (catalogOk && catalog.match?.number) {
    fields.cardNumber = field(num, "confirmed", "Matches the catalog (CardSight).");
  } else if (patterns.length && patterns.some((re) => re.test(num))) {
    fields.cardNumber = field(num, "confirmed", "Fits the checklist's card-number format and the card reads agree.");
  } else if (patterns.length) {
    fields.cardNumber = field(num, "unconfirmed", "Does not fit this product's card-number format.");
  } else {
    fields.cardNumber = field(num, "unconfirmed", "Reads from the card agree; no catalog to check it against.");
  }

  // --- Parallel ---
  if (pid.source === "catalog" && pid.status === "confirmed") {
    fields.parallel = field(card.parallel, "confirmed", "Matches the catalog (CardSight).");
  } else if (pid.status === "confirmed" || pid.status === "confirmed_by_tiebreak") {
    fields.parallel = field(card.parallel, "confirmed",
      `Only checklist parallel that fits ${[pid.evidence?.numberedTo ? `/${pid.evidence.numberedTo}` : null, pid.evidence?.color, pid.evidence?.finish ? String(pid.evidence.finish).replace(/_/g, " ") : null].filter(present).join(" + ") || "the card"}${pid.status === "confirmed_by_tiebreak" ? " (closer look picked it)" : ""}.`);
  } else if (pid.status === "probable") {
    fields.parallel = field(null, "unconfirmed", pid.guessOnly
      ? `Possibly ${pid.probable} (CardSight photo guess); no checklist to confirm it.`
      : `Probably ${pid.probable} (checklist), but the serial/print run was not confirmed.`);
  } else if (pid.status === "base") {
    fields.parallel = field("Base", "confirmed", "No serial, parallel color, or special finish: base card.");
  } else if (pid.status === "ambiguous") {
    fields.parallel = field(null, "unconfirmed", `Could be: ${(pid.candidates || []).join(", ")}.`);
  } else if (pid.status === "no_match") {
    fields.parallel = field(null, "unconfirmed", "Nothing in the checklist matches what the card shows.");
  } else {
    fields.parallel = field(card.parallel, "unconfirmed",
      present(card.parallel) ? "Read from the card; no checklist for this product yet." : "Not identified; no checklist for this product yet.");
  }

  // --- Serial ---
  if (!present(card.serialNumber) && !card.numberedTo) {
    fields.serial = field(null, ctx.serialImage ? "unconfirmed" : "confirmed",
      ctx.serialImage ? "Close-up could not be confirmed." : "No serial number found (not numbered).");
  } else if (ctx.serialImage) {
    fields.serial = field(card.serialNumber || `/${card.numberedTo}`, "confirmed", "Two separate reads of the close-up agree.");
  } else {
    // Full-card photo: the print run is reliable when reads agree, but a glare-hidden
    // digit can make every read agree on the wrong number (e.g. "15/99" for 151/99).
    fields.serial = field(card.serialNumber || `/${card.numberedTo}`, "unconfirmed",
      `Read from the full photo; the exact number is not close-up verified. Print run /${card.numberedTo} is confirmed.`);
    fields.serial.printRun = card.numberedTo;
    fields.serial.printRunConfirmed = true;
  }
  // "No serial" is only a safe call when nothing hinted at one.
  if (!present(card.serialNumber) && !ctx.serialImage && serialHinted(v, ctx.strongCheck)) {
    fields.serial = field(null, "unconfirmed", "Something like a serial was seen but could not be confirmed.");
  }

  const unconfirmed = FIELDS.filter((f) => fields[f].status !== "confirmed");
  const closeup = serialCloseupAdvice(card, v, ctx, fields);

  return {
    version: 1,
    fields,
    unconfirmed,
    allConfirmed: unconfirmed.length === 0,
    serialCloseup: closeup,
  };
}

// Both independent checks must have seen a stamped serial for it to count as a hint.
function serialHinted(v, strongCheck) {
  return present(v?.detailCheck?.stampedSerial) || present(strongCheck?.stampedSerial)
    || (v?.serialPhotoRetry?.reads || []).some(r => present(r?.stampedSerial));
}

// Ask for a serial close-up only when it would actually settle something.
function serialCloseupAdvice(card, v, ctx, fields) {
  if (ctx.serialImage) {
    return { needed: false, reason: fields.serial.status === "confirmed" ? "Close-up used." : "Close-up was unreadable; retake it closer with less glare." };
  }
  if (fields.serial.printRunConfirmed) {
    return { needed: false, optional: true, reason: "Optional: only to confirm the exact serial number. The print run and parallel did not need it." };
  }
  if (fields.serial.status !== "confirmed") {
    return { needed: true, reason: "A serial number may be on the card but could not be read reliably." };
  }
  const pid = v?.parallelId || {};
  if (pid.status === "ambiguous" && !card.numberedTo) {
    const runs = new Set((pid.candidateObjects || []).map((c) => c.numberedTo || 0));
    if (runs.size > 1) return { needed: true, reason: "The parallel depends on the print run; a close-up of the serial would settle it." };
  }
  return { needed: false, reason: "Not needed: one normal photo was enough." };
}

// Keep SOLD prices and ACTIVE asking prices completely separate.
// Only sold data may feed an estimated value.
export function buildMarket(soldComps, ebayActive, catalogSold) {
  const prices = (ebayActive?.listings || []).map((l) => l.price).filter((p) => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
  const mid = prices.length ? (prices.length % 2 ? prices[(prices.length - 1) / 2] : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2) : null;
  const soldFromCatalog = catalogSold && catalogSold.count ? catalogSold : null;
  const sold = soldFromCatalog
    ? { source: "cardsight_completed_auctions", count: catalogSold.count, min: catalogSold.min, median: catalogSold.median, max: catalogSold.max, items: catalogSold.items }
    : { source: soldComps?.source || "ebay_sold", count: soldComps?.count || 0, min: soldComps?.min ?? null, median: soldComps?.median ?? null, max: soldComps?.max ?? null, items: soldComps?.items || [], status: soldComps?.status, error: soldComps?.error };
  return {
    sold: { ...sold, kind: "sold", note: "Completed sales. The only data used for an estimated value." },
    active: {
      kind: "active_asking",
      source: "ebay_browse_active",
      configured: Boolean(ebayActive?.configured),
      status: ebayActive?.status || "not_checked",
      count: prices.length,
      low: prices[0] ?? null,
      median: mid !== null ? Math.round(mid * 100) / 100 : null,
      high: prices.length ? prices[prices.length - 1] : null,
      listings: (ebayActive?.listings || []).slice(0, 8),
      note: "Current asking prices on eBay. Not sales; never used for the estimated value.",
    },
  };
}

// Which outside services are ready (no secrets are ever returned).
export function integrationStatus({ cardsight, ebay }) {
  return {
    cardsight: cardsight ? "configured" : "waiting_for_CARDSIGHT_API_KEY",
    ebayBrowse: ebay ? "configured" : "waiting_for_EBAY_CLIENT_ID_and_EBAY_CLIENT_SECRET",
  };
}
