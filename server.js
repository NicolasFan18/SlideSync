const http = require("http");
const url = require("url");
const fetch = require("node-fetch");

const SUPADATA_KEY = "sd_727ea7f3e1bfd0163146af61bb550c99";
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const parsed = url.parse(req.url, true);
  const path = parsed.pathname;

  if (req.method === "GET" && path === "/transcript") {
    const videoId = parsed.query.videoId;
    if (!videoId) { res.writeHead(400); res.end(JSON.stringify({ error: "Missing videoId" })); return; }
    try {
      const apiUrl = "https://api.supadata.ai/v1/youtube/transcript?url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + videoId) + "&text=true";
      const apiRes = await fetch(apiUrl, { headers: { "x-api-key": SUPADATA_KEY } });
      const data = await apiRes.json();
      if (!apiRes.ok) { res.writeHead(502); res.end(JSON.stringify({ error: data.message || "Supadata error" })); return; }
      const transcript = typeof data.content === "string" ? data.content : (data.content || []).map(c => c.text).join(" ");
      if (!transcript || transcript.length < 50) { res.writeHead(502); res.end(JSON.stringify({ error: "Transcript is empty." })); return; }
      res.writeHead(200); res.end(JSON.stringify({ transcript }));
    } catch (err) { res.writeHead(502); res.end(JSON.stringify({ error: err.message })); }
    return;
  }

  if (req.method === "POST" && path === "/slides") {
    try {
      const { transcript } = JSON.parse(await readBody(req));
      if (!transcript) { res.writeHead(400); res.end(JSON.stringify({ error: "Missing transcript" })); return; }
      const sys = "Convert video transcripts into slideshow JSON. Return ONLY a valid JSON array, no markdown fences, no explanation.\nEach slide object: {\"type\":\"title\"|\"overview\"|\"step\"|\"tip\"|\"summary\",\"heading\":\"max 8 words\",\"body\":\"string or string[]\",\"stepNumber\":N}\nRules: 1 title, 1 overview (3-5 bullets), 5-12 step slides, 1-3 tip slides, 1 summary. Concise and actionable.";
      const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 4000, system: sys, messages: [{ role: "user", content: "Transcript:\n\n" + transcript.slice(0, 10000) }] })
      });
      const data = await apiRes.json();
      if (data.error) { res.writeHead(502); res.end(JSON.stringify({ error: data.error.message })); return; }
      const raw = (data.content.find(b => b.type === "text") || {}).text || "";
      const slides = JSON.parse(raw.replace(/```json|```/g, "").trim());
      res.writeHead(200); res.end(JSON.stringify({ slides }));
    } catch (err) { res.writeHead(502); res.end(JSON.stringify({ error: err.message })); }
    return;
  }

  if (req.method === "POST" && path === "/chat") {
    try {
      const { message, transcript, currentSlide, history } = JSON.parse(await readBody(req));
      if (!message) { res.writeHead(400); res.end(JSON.stringify({ error: "Missing message" })); return; }

      const sys = "You are a helpful tutor assistant for a video tutorial. You have access to the full transcript of the video the user is watching.\n\nHelp the user understand the content, troubleshoot errors, and answer questions. Match the tone of the tutorial. Ground your answers in the transcript first — if the answer is not there, use your own knowledge and say so. Keep answers concise and practical.\n\nFull transcript:\n" + (transcript || "").slice(0, 8000) + "\n\nCurrent slide the user is on:\n" + (currentSlide || "Unknown");

      const messages = (history || []).map(m => ({ role: m.role, content: m.content }));
      messages.push({ role: "user", content: message });

      const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: sys, messages })
      });
      const data = await apiRes.json();
      if (data.error) { res.writeHead(502); res.end(JSON.stringify({ error: data.error.message })); return; }
      const reply = (data.content.find(b => b.type === "text") || {}).text || "";
      res.writeHead(200); res.end(JSON.stringify({ reply }));
    } catch (err) { res.writeHead(502); res.end(JSON.stringify({ error: err.message })); }
    return;
  }

  res.writeHead(200); res.end(JSON.stringify({ status: "ok" }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port " + PORT));
