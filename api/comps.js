export default async function handler(req, res) {
  res.status(200).json({
    success: true,
    message: "Real comps route connected",
    comps: [
      {
        title: "2024 Panini Prizm Jahmyr Gibbs Silver PSA 10",
        soldPrice: "$86",
        dateSold: "2026-05-28"
      },
      {
        title: "2024 Mosaic Jahmyr Gibbs Genesis",
        soldPrice: "$142",
        dateSold: "2026-05-26"
      }
    ]
  });
}
