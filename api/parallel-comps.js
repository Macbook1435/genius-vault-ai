// Sold comps for one CardSight card + one parallel the user picked ("null" = base).
// GET /api/parallel-comps?cardId=<uuid>&parallelId=<uuid|null>
import { cardsightConfigured, cardsightSoldComps, cardsightCardInfo } from "./cardsight.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Use GET." });
    if (!cardsightConfigured()) return res.status(503).json({ error: "Sold-price source is not connected." });
    const cardId = String(req.query.cardId || "");
    const parallelId = String(req.query.parallelId || "null");
    if (!UUID.test(cardId) || !(parallelId === "null" || UUID.test(parallelId))) {
      return res.status(400).json({ error: "Invalid card or parallel." });
    }
    // The parallel must belong to this card (never price a parallel from another card).
    let parallelName = "Base";
    const info = await cardsightCardInfo(cardId);
    const list = info.parallels;
    if (parallelId !== "null") {
      const p = list.find((x) => x && x.id === parallelId);
      if (!p) return res.status(400).json({ error: "That parallel is not listed for this card." });
      parallelName = p.name;
    }
    const sold = await cardsightSoldComps(cardId, { parallelId, parallels: list, cardIsAuto: info.isAuto });
    return res.status(200).json({ cardId, parallelId, parallelName, count: sold.count, min: sold.min, median: sold.median,
      max: sold.max, items: sold.items, source: sold.source, considered: sold.considered, period: sold.period, cardIsAuto: info.isAuto });
  } catch (e) {
    console.error("parallel-comps error:", e);
    return res.status(502).json({ error: "Could not load sold prices right now. Try again shortly." });
  }
}
