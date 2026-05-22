export default async function handler(req, res) {
  try {
    res.status(200).json({
      success: true,
      message: "AI scanner connected successfully.",
      detectedCard: {
        player: "Card detected",
        year: "Scanning...",
        brand: "Scanning...",
        parallel: "Scanning...",
        condition: "Scanning...",
        numbered: "Scanning..."
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "AI scan failed."
    });
  }
}
