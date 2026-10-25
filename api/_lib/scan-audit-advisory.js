/** Read-only audit advisory for scanner responses. No approval or persistence. */
const clean = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const conflict = (a, b) => Boolean(clean(a) && clean(b) && clean(a) !== clean(b));

export function scanAuditAdvisory({ scan, catalogIdentity } = {}) {
  const issues = [];
  const evidence = scan?.evidence ?? {};
  const visiblePlayer = evidence.playerNameText;
  const visibleNumber = evidence.cardNumberText;
  if (conflict(scan?.player, visiblePlayer)) {
    issues.push({ code: "player_evidence_conflict", message: "Recognized player differs from visible text" });
  }
  if (conflict(scan?.cardNumber, visibleNumber)) {
    issues.push({ code: "number_evidence_conflict", message: "Recognized card number differs from visible text" });
  }
  if (catalogIdentity?.status === "verified_reference_identity") {
    if (conflict(scan?.player, catalogIdentity.playerName)) {
      issues.push({ code: "catalog_player_conflict", message: "Reference player differs from scan" });
    }
    if (conflict(scan?.cardNumber, catalogIdentity.cardNumber)) {
      issues.push({ code: "catalog_number_conflict", message: "Reference card number differs from scan" });
    }
  }
  if (!visiblePlayer || !visibleNumber) {
    issues.push({ code: "incomplete_visible_evidence", message: "Readable name and card number evidence required" });
  }
  // This endpoint does not provide independently verified physical parallel evidence.
  issues.push({ code: "physical_parallel_unverified", message: "Parallel requires independent verification" });
  return {
    status: "unverified",
    approvalAllowed: false,
    autoApproved: false,
    requiresHumanReview: true,
    issues,
  };
}
