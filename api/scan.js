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

eBay Search:
2023 Select Jahmyr Gibbs Zebra Prizm RC

Suggested Search:
Jahmyr Gibbs Zebra Select Rookie

Pricing Engine:
REAL SOLD COMPS:
https://130point.com/sales/

Search:
2023 Select Jahmyr Gibbs Zebra Prizm RC

    });
  } catch (error) {
    res.status(500).json({
      result: "AI scan failed."
    });
  }
}
