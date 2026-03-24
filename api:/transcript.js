const https = require("https");

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      }
    }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error("HTTP " + res.statusCode));
      }
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

function eventsToText(events) {
  return events
    .filter((e) => e.segs)
    .map((e) => e.segs.map((s) => (s.utf8 || "").split("\n").join(" ")).join(""))
    .join(" ")
    .replace(/  +/g, " ")
    .trim();
}

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
    // Fetch YouTube watch page
    const html = await get("https://www.youtube.com/watch?v=" + videoId + "&hl=en");

    // Extract caption tracks
    const match = html.match(/"captionTracks":\s*(\[.*?\])\s*,\s*"audioTracks"/);
    if (!match) {
      return res.status(502).json({ error: "No captions found for this video." });
    }

    const tracks = JSON.parse(match[1]);
    if (!tracks.length) {
      return res.status(502).json({ error: "No caption tracks available." });
    }

    const track =
      tracks.find((t) => t.languageCode === "en" && t.kind !== "asr") ||
      tracks.find((t) => t.languageCode === "en") ||
      tracks.find((t) => (t.languageCode || "").startsWith("en")) ||
      tracks[0];

    if (!track || !track.baseUrl) {
      return res.status(502).json({ error: "No usable caption track found." });
    }

    // Fetch caption JSON
    const captionBody = await get(track.baseUrl + "&fmt=json3");
    const captionData = JSON.parse(captionBody);
    const transcript = eventsToText(captionData.events || []);

    if (transcript.length < 50) {
      return res.status(502).json({ error: "Transcript too short or empty." });
    }

    return res.status(200).json({ transcript });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
};
