export default async function handler(req, res) {
  try {
    const query = req.query.q || "sports card";

    const searchUrl =
      `https://www.130point.com/sales/` +
      `?q=${encodeURIComponent(query)}`;

    return res.status(200).json({
      success: true,
      searchUrl,
      comps: [
        {
         title: `Open sold comps search for: ${query}`,
soldPrice: "Manual check required",
dateSold: "Latest"
        }
      ]
    });

  } catch (error) {
    return res.status(200).json({
      success: false,
      error: error.message
    });
  }
}
