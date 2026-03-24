const { YoutubeTranscript } = require("youtube-transcript");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  const { videoId } = req.query;
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: "Invalid videoId" });
  }

  try {
    const items = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });
    const transcript = items.map((i) => i.text).join(" ").replace(/\s+/g, " ").trim();
    if (!transcript || transcript.length < 50) {
      return res.status(502).json({ error: "Transcript is empty." });
    }
    return res.status(200).json({ transcript });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
};
