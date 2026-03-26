const http = require("http");
const url = require("url");
const fetch = require("node-fetch");

const SUPADATA_KEY = "sd_727ea7f3e1bfd0163146af61bb550c99";

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
    const apiUrl = "https://api.supadata.ai/v1/youtube/transcript?url=" +
      encodeURIComponent("https://www.youtube.com/watch?v=" + videoId) + "&text=true";

    const apiRes = await fetch(apiUrl, {
      headers: { "x-api-key": SUPADATA_KEY }
    });

    const data = await apiRes.json();

    if (!apiRes.ok) {
      res.writeHead(502);
      res.end(JSON.stringify({ error: data.message || "Supadata error" }));
      return;
    }

    const transcript = typeof data.content === "string"
      ? data.content
      : (data.content || []).map(c => c.text).join(" ");

    if (!transcript || transcript.length < 50) {
      res.writeHead(502);
      res.end(JSON.stringify({ error: "Transcript is empty." }));
      return;
    }

    res.writeHead(200);
    res.end(JSON.stringify({ transcript }));
  } catch (err) {
    res.writeHead(502);
    res.end(JSON.stringify({ error: err.message }));
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port " + PORT));
