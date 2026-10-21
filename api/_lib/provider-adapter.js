// Genius Vault AI provider-neutral checklist adapter (evaluation only).
// No API keys, network calls, subscriptions, or production data writes.
// A provider record is candidate catalog evidence, not photo confirmation.
const text = (v) => typeof v === "string" && v.trim() ? v.trim() : null;
const id = (v) => typeof v === "string" && v.trim() ? v.trim() : null;
const year = (v) => Number.isInteger(v) && v >= 1900 && v <= 2100 ? v : null;
const printRun = (v) => Number.isInteger(v) && v > 0 ? v : null;
const color = (v) => text(v)?.toLowerCase() || null;
const pattern = (v) => text(v)?.toLowerCase().replace(/[ -]+/g, "_") || null;

export function normalizeProviderCard(raw, providerId) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new TypeError("Provider card must be an object");
  const provider = id(providerId);
  if (!provider) throw new TypeError("Provider ID is required");
  const productId = id(raw.productId);
  const cardNumber = text(raw.cardNumber);
  const subsetId = id(raw.subsetId);
  if (!productId || !cardNumber || !subsetId) throw new TypeError("Product ID, subset ID and card number are required");
  const variants = Array.isArray(raw.variants) ? raw.variants : [];
  return {
    provider,
    providerCardId: id(raw.id),
    product: { id: productId, year: year(raw.year), sport: text(raw.sport), manufacturer: text(raw.manufacturer), name: text(raw.productName) },
    subset: { id: subsetId, name: text(raw.subsetName) },
    card: { number: cardNumber, player: text(raw.player), autograph: typeof raw.autograph === "boolean" ? raw.autograph : null },
    variants: variants.map((v) => ({
      providerVariantId: id(v?.id),
      name: text(v?.name),
      color: color(v?.color),
      pattern: pattern(v?.pattern),
      numberedTo: printRun(v?.numberedTo),
      // Never use null print runs as evidence of a confirmed unnumbered card.
      numberingVerified: v?.numberingVerified === true,
    })),
    provenance: { provider, retrievedAt: text(raw.retrievedAt), sourceUrl: text(raw.sourceUrl), licenseVerified: raw.licenseVerified === true },
    status: "candidate_unverified",
  };
}

export function evaluateProviderCard(candidate, expected) {
  if (!candidate || !expected) throw new TypeError("Candidate and expected card required");
  const issues = [];
  const fields = [
    ["product.id", candidate.product?.id, expected.productId],
    ["subset.id", candidate.subset?.id, expected.subsetId],
    ["card.number", candidate.card?.number, expected.cardNumber],
  ];
  for (const [field, actual, wanted] of fields) if (wanted != null && actual !== wanted) issues.push(field + " mismatch");
  if (expected.year != null && candidate.product?.year !== expected.year) issues.push("product year mismatch");
  if (expected.player && candidate.card?.player?.toLowerCase() !== expected.player.toLowerCase()) issues.push("player mismatch");
  if (expected.parallel) {
    const variant = candidate.variants?.find(v => v.name?.toLowerCase() === expected.parallel.toLowerCase());
    if (!variant) issues.push("parallel missing");
    else if (expected.numberedTo != null && variant.numberedTo !== expected.numberedTo) issues.push("parallel print run mismatch");
  }
  if (candidate.provenance?.licenseVerified !== true) issues.push("commercial license not verified");
  return { accepted: issues.length === 0, issues };
}
