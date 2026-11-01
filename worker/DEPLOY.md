# Deploying the proxy relay (free, no credit card)

Your proxy has two parts:

1. **The relay** (this `worker/` folder) — a Cloudflare Worker that fetches sites for you and adds CORS headers so your static site can load them. This is the piece that does the actual work.
2. **The front-end** (the Vite app in `/src`) — the page you browse. Host it anywhere static: GitHub Pages, Netlify Drop, Vercel, or even the same Cloudflare account as a Pages site.

## Step 1 — Deploy the Worker

1. Go to **https://dash.cloudflare.com** and sign up (free; no credit card).
2. On the left sidebar, choose **Workers & Pages → Create application → Create Worker**.
3. Give it a name (e.g. `proxy-relay`) and click **Deploy**.
4. After it deploys, click **Edit code**.
5. Open the file `worker/worker.js` from this project, copy its **entire contents**, and paste it into the Cloudflare editor, replacing whatever is there.
6. Click **Deploy**.

You'll get a URL like `https://proxy-relay.<your-subdomain>.workers.dev`. That's your relay URL — keep it handy.

## Step 2 — Point the front-end at your relay

In the deployed proxy page, open the **Settings** (gear icon) and paste your relay URL into the "Relay endpoint" field. It's saved in your browser, so you only do this once. The app ships with a demo relay already filled in so you can try it immediately, but that one is shared and rate-limited — swap in your own for reliable use.

## Step 3 — Host the front-end (optional, free)

- **GitHub Pages**: push the repo to GitHub, run `npm run build`, and put the contents of `dist/` on the `gh-pages` branch (or use the Pages "deploy from folder" action).
- **Netlify Drop**: drag the `dist/` folder onto https://app.netlify.com/drop after building.
- **Cloudflare Pages**: connect the repo, set build command `npm run build`, output dir `dist`.

## Notes & limits

- The free Cloudflare plan allows **100,000 requests/day** — plenty for personal browsing.
- Sites that require login or aggressively detect proxies (banking, some streaming) may not work.
- Only http/https targets are allowed. The relay drops your real IP from forwarded headers.
- **WebSocket support:** the relay proxies real-time WebSocket connections (ws:// and wss://) via the `/ws?url=<target>` endpoint. Proxied pages automatically have their WebSocket connections redirected through the relay so chat apps, live feeds, and streaming services can work. This works on the free Cloudflare plan.
- This tool is for reaching publicly available web content. Don't use it to bypass access controls put in place by a network owner or employer.
