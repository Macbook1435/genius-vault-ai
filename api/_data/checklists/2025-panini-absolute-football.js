// Limited product/subset reference. Parallel rainbow NOT verified yet.
// RF- prefix describes a card-number format, not proof of player identity.
// No parallel is marked verified without two independent matching sources.
const product = {
  id: "2025-panini-absolute-football",
  label: "2025 Panini Absolute Football",
  year: 2025,
  sport: "football",
  brand: "Panini",
  brandAliases: ["Absolute"],
  product: "Absolute",
  match: { include: ["absolute"], exclude: [] },
  copyrightYears: [2025, 2026],
  sources: [],
  subsets: [{
    id: "rookie_force",
    label: "Rookie Force",
    rookie: true,
    auto: false,
    numberFormats: [{ regex: "^RF-[A-Z0-9]+$" }],
    parallels: [],
    sourceCount: 0
  }]
};
export default product;
