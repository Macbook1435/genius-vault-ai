// One row per scan in Supabase (gv_scan_log), plus the user's version/parallel correction.
// Server-only (service role). Never blocks or fails a scan: errors are logged and ignored.
// Turn off with GV_SCAN_LOG=0.
import { supabaseRequest } from "./subscriptions.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const enabled = () => process.env.GV_SCAN_LOG !== "0"
  && Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("scan log timeout")), ms))]);

export async function writeScanLog(row) {
  if (!enabled()) return null;
  try {
    const out = await withTimeout(supabaseRequest("/rest/v1/gv_scan_log?select=id", {
      method: "POST", admin: true, prefer: "return=representation", body: row }), 2000);
    return Array.isArray(out) && UUID.test(String(out[0]?.id || "")) ? out[0].id : null;
  } catch (e) {
    console.warn("scan log write failed:", e?.message);
    return null;
  }
}

export async function recordScanCorrection(id, correction) {
  if (!enabled() || !UUID.test(String(id || ""))) return;
  try {
    await withTimeout(supabaseRequest(`/rest/v1/gv_scan_log?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH", admin: true, prefer: "return=minimal",
      body: { correction, corrected_at: new Date().toISOString() } }), 2000);
  } catch (e) {
    console.warn("scan log correction failed:", e?.message);
  }
}
