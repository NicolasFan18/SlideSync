const http = require("http");
const url = require("url");

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const { query } = url.parse(req.url, true);
  const videoId = query.videoId;

  if (!videoId) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: "Missing videoId" }));
    return;
  }

  try {
    const { YoutubeTranscript } = require("youtube-transcript");
    const items = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });
    const transcript = items.map((i) => i.text).join(" ").replace(/\s+/g, " ").trim();
    res.writeHead(200);
    res.end(JSON.stringify({ transcript }));
  } catch (err) {
    res.writeHead(502);
    res.end(JSON.stringify({ error: err.message }));
  }
});

const PORT = process.env.PORT;
server.listen(PORT, () => console.log("Server running on port " + PORT));
