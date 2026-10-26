import { evaluateVisualAudit, type ScanEvidence } from "./visual-audit-guards";

/** Non-mutating adapter. Call only after OCR and checklist evidence are available.
 * This does not mark any catalog record verified or write to a database.
 */
export function reviewScanCandidate(candidate: ScanEvidence) {
  const evaluation = evaluateVisualAudit(candidate);
  return {
    verificationStatus: evaluation.approvalAllowed ? "eligible_for_manual_review" as const : "unverified" as const,
    requiresHumanApproval: true as const,
    auditIssues: evaluation.issues,
    // Deliberately never auto-approve or promote, even if all checks pass.
    autoApproved: false as const,
  };
}
