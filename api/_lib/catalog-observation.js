// Test-only, opt-in catalog observation capture. Never treats an AI guess as verified.
import { supabaseRequest } from "./subscriptions.js";
export async function captureCatalogObservation(card, verification, requestId) {
  if (process.env.GV_CATALOG_CAPTURE !== "1" || !requestId || !card) return;
  const evidence = {
    verificationStatus: verification?.status ?? "unknown",
    fieldVerification: verification?.fields ?? null,
    source: "scanner_ai_unverified"
  };
  await supabaseRequest("/rest/v1/rpc/gv_record_scan_observation", {
    method: "POST",
    admin: true,
    body: { p_request_id: requestId, p_card: card, p_evidence: evidence }
  });
}
