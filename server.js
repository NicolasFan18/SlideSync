const http = require("http");
const url = require("url");
const fetch = require("node-fetch");

const SUPADATA_KEY = "sd_727ea7f3e1bfd0163146af61bb550c99";
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;;

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsed = url.parse(req.url, true);
  const path = parsed.pathname;

  // GET /transcript?videoId=xxx
  if (req.method === "GET" && path === "/transcript") {
    const videoId = parsed.query.videoId;
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
    return;
  }

  // POST /slides
  if (req.method === "POST" && path === "/slides") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const { transcript } = JSON.parse(body);
        if (!transcript) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "Missing transcript" }));
          return;
        }

        const sys = `Convert video transcripts into slideshow JSON. Return ONLY a valid JSON array, no markdown fences, no explanation.
Each slide object: {"type":"title"|"overview"|"step"|"tip"|"summary","heading":"max 8 words","body":"string or string[]","stepNumber":N}
Rules: 1 title, 1 overview (3-5 bullets), 5-12 step slides, 1-3 tip slides, 1 summary. Concise and actionable.`;

        const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_KEY,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1000,
            system: sys,
            messages: [{ role: "user", content: "Transcript:\n\n" + transcript.slice(0, 10000) }]
          })
        });

        const data = await apiRes.json();
        if (data.error) {
          res.writeHead(502);
          res.end(JSON.stringify({ error: data.error.message }));
          return;
        }

        const raw = (data.content.find(b => b.type === "text") || {}).text || "";
        const slides = JSON.parse(raw.replace(/```json|```/g, "").trim());

        res.writeHead(200);
        res.end(JSON.stringify({ slides }));
      } catch (err) {
        res.writeHead(502);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Health check
  if (path === "/" || path === "") {
    res.writeHead(200);
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port " + PORT));
