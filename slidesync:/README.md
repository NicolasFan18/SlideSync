# SlideSync — Deployment Guide

## What you have
- `index.html` — the frontend (hosts on GitHub Pages)
- `api/transcript.js` — the backend API (deploys to Vercel)
- `package.json` — dependencies
- `vercel.json` — Vercel routing config

---

## Step 1 — Deploy the backend to Vercel (free, ~2 minutes)

1. Go to https://github.com and create a **new repository** called `slidesync`
2. Upload ALL these files keeping the folder structure:
   ```
   index.html
   package.json
   vercel.json
   api/
     transcript.js
   ```
3. Go to https://vercel.com and sign up with your GitHub account
4. Click **Add New Project** → import your `slidesync` repo
5. Leave all settings as default and click **Deploy**
6. Once deployed, copy your Vercel URL — it'll look like:
   `https://slidesync-yourname.vercel.app`

## Step 2 — Update the frontend with your Vercel URL

Open `index.html` in a text editor, find this line near the top of the `<script>` section:

```js
const WORKER_URL = "https://slidesync.vercel.app"; // Update this after deploying to Vercel
```

Replace it with your actual Vercel URL:

```js
const WORKER_URL = "https://slidesync-yourname.vercel.app";
```

Save the file and push it back to GitHub.

## Step 3 — Enable GitHub Pages (hosts your frontend for free)

1. In your GitHub repo, go to **Settings → Pages**
2. Under **Source**, select **Deploy from a branch**
3. Select `main` branch → `/ (root)` → click **Save**
4. Your site will be live at:
   `https://yourusername.github.io/slidesync`

---

## How it works

```
Browser → Vercel API (/api/transcript?videoId=xxx) → YouTube → transcript text
Browser → Claude API → slides JSON
```

The Vercel function uses the `youtube-transcript` npm package which handles
YouTube's anti-bot measures properly, unlike raw HTTP requests.
