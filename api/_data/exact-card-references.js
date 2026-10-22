// Exact-card references supported by independently published checklists.
// This is deliberately NOT a product-wide parallel registry.
const ENTRIES = [
  {
    year: 2025, brand: "Panini", product: "Absolute",
    insert: "Rookie Force", player: "Kyle Williams",
    cardNumber: "RF-KWS", team: "New England Patriots",
    memorabilia: true,
    sources: [
      "https://www.tcdb.com/Checklist.cfm/sid/573723/2025-Panini-Absolute---Rookie-Force",
      "https://www.sportscardspro.com/game/football-cards-2025-panini-absolute-rookie-force/kyle-williams-rf-kws"
    ]
  }
];
const normalize = v => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
export function exactChecklistCard(card = {}) {
  return ENTRIES.find(e =>
    Number(card.year) === e.year &&
    normalize(card.player) === normalize(e.player) &&
    normalize(card.cardNumber) === normalize(e.cardNumber) &&
    normalize(card.brand) === normalize(e.brand) &&
    normalize(card.set).includes(normalize(e.product))
  ) || null;
}
