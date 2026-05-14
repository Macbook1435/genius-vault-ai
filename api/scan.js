export default async function handler(req, res) {
  try {
    res.status(200).json({
      result: `
Player: Jahmyr Gibbs
Year: 2023
Brand: Select
Parallel: Zebra Prizm
Condition: Raw / Near Mint
Numbered: No

Estimated Value: $250-$400
`
    });
  } catch (error) {
    res.status(500).json({
      result: "AI scan failed."
    });
  }
}
