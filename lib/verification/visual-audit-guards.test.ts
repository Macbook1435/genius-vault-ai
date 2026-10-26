import { describe, expect, it } from "vitest";
import { evaluateVisualAudit } from "./visual-audit-guards";

const verified = {
  frontPlayer: "Trevor Etienne",
  backPlayer: "Trevor Etienne",
  frontNumber: "179",
  backNumber: "179",
  csvPlayer: "Trevor Etienne",
  csvNumber: "179",
  csvVersion: "Blue & Yellow",
  observedVersion: "Blue & Yellow",
  checklistVerified: true,
  physicalVersionVerified: true,
};

describe("visual audit guardrails", () => {
  it("allows complete consistent evidence", () => {
    const result = evaluateVisualAudit(verified);
    expect(result.approvalAllowed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
  it("flags CDP player and number mismatches, including the Raheim Sanders case", () => {
    const result = evaluateVisualAudit({ ...verified, csvPlayer: "Raheim Sanders", csvNumber: "189" });
    expect(result.approvalAllowed).toBe(false);
    expect(result.issues.map(i => i.code)).toContain("source_player_conflict");
    expect(result.issues.map(i => i.code)).toContain("source_number_conflict");
  });
  it("flags wrong Chrome versus Paper evidence", () => {
    const result = evaluateVisualAudit({ ...verified, csvVersion: "Chrome", observedVersion: "Blue & Yellow Paper" });
    expect(result.issues.map(i => i.code)).toContain("version_conflict");
    expect(result.approvalAllowed).toBe(false);
  });
  it("rejects unreadable sides even with checklist evidence", () => {
    const result = evaluateVisualAudit({ ...verified, backPlayer: null });
    expect(result.issues.map(i => i.code)).toContain("incomplete_visual_evidence");
    expect(result.approvalAllowed).toBe(false);
  });
  it("rejects missing checklist or parallel verification", () => {
    const result = evaluateVisualAudit({ ...verified, checklistVerified: false, physicalVersionVerified: false });
    expect(result.issues.map(i => i.code)).toEqual(expect.arrayContaining(["checklist_unverified","physical_version_unverified"]));
    expect(result.approvalAllowed).toBe(false);
  });
});
