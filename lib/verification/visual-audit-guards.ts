/** Visual audit guardrails for staged Card Dealer Pro scans.
 * Never promote a card from a photo-based suggestion alone.
 */
export type ScanEvidence = {
  frontPlayer?: string | null;
  backPlayer?: string | null;
  frontNumber?: string | null;
  backNumber?: string | null;
  csvPlayer?: string | null;
  csvNumber?: string | null;
  csvVersion?: string | null;
  observedVersion?: string | null;
  checklistVerified?: boolean;
  physicalVersionVerified?: boolean;
};
export type ScanIssue = { code: string; message: string };
const norm = (s?: string | null) => (s ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const disagree = (a?: string | null, b?: string | null) => !!norm(a) && !!norm(b) && norm(a) !== norm(b);
export function evaluateVisualAudit(e: ScanEvidence): { issues: ScanIssue[]; approvalAllowed: boolean } {
  const issues: ScanIssue[] = [];
  if (disagree(e.frontPlayer,e.backPlayer)) issues.push({code:"front_back_player_conflict",message:"Front and back player identities disagree"});
  if (disagree(e.frontNumber,e.backNumber)) issues.push({code:"front_back_number_conflict",message:"Front and back card numbers disagree"});
  if (disagree(e.csvPlayer,e.frontPlayer) || disagree(e.csvPlayer,e.backPlayer)) issues.push({code:"source_player_conflict",message:"Source player differs from visible card evidence"});
  if (disagree(e.csvNumber,e.frontNumber) || disagree(e.csvNumber,e.backNumber)) issues.push({code:"source_number_conflict",message:"Source card number differs from visible card evidence"});
  if (disagree(e.csvVersion,e.observedVersion)) issues.push({code:"version_conflict",message:"Source version differs from visual candidate; manual verification required"});
  if (!e.frontPlayer || !e.backPlayer || !e.frontNumber || !e.backNumber) issues.push({code:"incomplete_visual_evidence",message:"Both sides must be readable before verification"});
  if (!e.checklistVerified) issues.push({code:"checklist_unverified",message:"Manufacturer checklist evidence is required"});
  if (!e.physicalVersionVerified) issues.push({code:"physical_version_unverified",message:"Physical version or parallel requires independent verification"});
  return { issues, approvalAllowed: issues.length === 0 };
}
