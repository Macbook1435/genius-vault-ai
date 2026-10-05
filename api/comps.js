import { cardsightConfigured, cardsightHealth, cardsightSoldComps } from "./cardsight.js";

// GET /api/comps?health=1            -> checks the server-side CardSight key works (never returns the key)
// GET /api/comps?cardId=...&parallelId=...&gradeId=...  -> completed auction sales for an exact catalog card
export default async function handler(req, res) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "Use GET only." }); }
  if (!cardsightConfigured()) return res.status(503).json({ ok: false, error: "CardSight is not configured on this deployment." });
  try {
    if (req.query.health) { await cardsightHealth(); return res.status(200).json({ ok: true, cardsight: "authenticated" }); }
    const cardId = String(req.query.cardId || "");
    if (!/^[0-9a-f-]{36}$/i.test(cardId)) return res.status(400).json({ ok: false, error: "A CardSight cardId is required." });
    const comps = await cardsightSoldComps(cardId, {
      parallelId: String(req.query.parallelId || "null"), gradeId: String(req.query.gradeId || "null") });
    return res.status(200).json({ ok: true, comps });
  } catch (err) {
    return res.status(err.status === 401 || err.status === 403 ? 502 : 500).json({ ok: false, error: err.message });
  }
}
