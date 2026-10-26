import { describe, expect, it } from "vitest";
import { reviewScanCandidate } from "./review-scan-candidate";

const candidate = {
  frontPlayer: "Trevor Etienne", backPlayer: "Trevor Etienne",
  frontNumber: "179", backNumber: "179",
  csvPlayer: "Trevor Etienne", csvNumber: "179",
  csvVersion: "Blue & Yellow", observedVersion: "Blue & Yellow",
  checklistVerified: true, physicalVersionVerified: true,
};

describe("scan candidate review adapter", () => {
  it("never automatically approves even fully verified evidence", () => {
    const result = reviewScanCandidate(candidate);
    expect(result.verificationStatus).toBe("eligible_for_manual_review");
    expect(result.requiresHumanApproval).toBe(true);
    expect(result.autoApproved).toBe(false);
  });
  it("keeps mismatched CDP records unverified", () => {
    const result = reviewScanCandidate({ ...candidate, csvPlayer: "Raheim Sanders", csvNumber: "189" });
    expect(result.verificationStatus).toBe("unverified");
    expect(result.auditIssues.map(i => i.code)).toEqual(expect.arrayContaining(["source_player_conflict","source_number_conflict"]));
    expect(result.autoApproved).toBe(false);
  });
  it("keeps uncertain parallels unverified", () => {
    const result = reviewScanCandidate({ ...candidate, physicalVersionVerified: false });
    expect(result.verificationStatus).toBe("unverified");
    expect(result.autoApproved).toBe(false);
  });
});
