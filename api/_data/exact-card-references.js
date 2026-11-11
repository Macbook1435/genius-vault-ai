// Curated exact-card checklist entries. Add only independently corroborated cards.
// An entry confirms identity, NOT the photographed parallel or autograph.
export const EXACT_CARD_REFERENCES = [
  {
    year: 2025, brand: "Topps", product: "Resurgence", sport: "football",
    insert: "Rookie Signatures", player: "Tyler Shough",
    cardNumber: "163", team: "New Orleans Saints",
    autograph: true,
    // Identity reference only. Aqua Surge /250 is a documented candidate,
    // not an automatically confirmed parallel of a photographed card.
    sources: [
      "https://www.breakninja.com/footballcards/Tyler-Shough-Newest-Football-Cards-Checklist.php?page_no=4",
      "https://sportshobbybox.com/checklists/2025-topps-resurgence-football-cards-checklist?sport=Football"
    ]
  },
  {
    year: 2025, brand: "Panini", product: "Absolute", sport: "football",
    insert: "Rookie Force", player: "Kyle Williams",
    cardNumber: "RF-KWS", team: "New England Patriots",
    memorabilia: true,
    sources: [
      "https://www.tcdb.com/Checklist.cfm/sid/573723/2025-Panini-Absolute---Rookie-Force",
      "https://www.sportscardspro.com/game/football-cards-2025-panini-absolute-rookie-force/kyle-williams-rf-kws"
    ]
  }
];
const norm = v => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
export function findExactCardReference(card = {}) {
  return EXACT_CARD_REFERENCES.find(e =>
    Number(card.year) === e.year &&
    norm(card.player) === norm(e.player) &&
    norm(card.cardNumber) === norm(e.cardNumber) &&
    norm(card.brand) === norm(e.brand) &&
    norm(card.set).includes(norm(e.product))
  ) || null;
}
