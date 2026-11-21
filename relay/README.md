# Kara Wisp relay

This service is Kara's portable network backend. It runs the official
`@mercuryworkshop/wisp-js` server and accepts Wisp WebSocket connections at
`/wisp/`. It does not fetch and rewrite website HTML. Scramjet runs in the
visitor's browser and uses this relay as its network transport.

## Requirements

- Docker, or Node.js 22+
- A public HTTPS deployment that supports long-lived WebSocket connections
- A random relay token of at least 32 characters

Generate a token locally:

```sh
openssl rand -hex 32
```

Set these environment variables in the hosting provider:

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | HTTP port. Defaults to `8080`. |
| `WISP_TOKEN` | Yes | Shared access token for the Wisp WebSocket endpoint. |
| `ALLOWED_ORIGINS` | No | Comma-separated exact frontend origins. Leave unset to allow any origin; the token is still required. |

Do not commit the token to Git or put it in a public deployment file.

## Run with Docker

From the repository root:

```sh
docker build -f relay/Dockerfile -t kara-wisp .
docker run --rm -p 8080:8080 \
  -e WISP_TOKEN="replace-with-your-generated-token" \
  -e ALLOWED_ORIGINS="https://your-kara-site.example" \
  kara-wisp
```

Health check: `http://localhost:8080/health`

Wisp endpoint: `wss://your-relay-host.example/wisp/?token=YOUR_TOKEN`

## Run directly with Node

```sh
cd relay
npm install
WISP_TOKEN="replace-with-your-generated-token" npm start
```

## Deploy

The deployment descriptors live in the repository root so providers can
discover them without custom paths:

- **Railway:** use the root `railway.json`; it builds `relay/Dockerfile`.
- **Render:** create a Blueprint from the root `render.yaml`; enter `WISP_TOKEN` and optionally `ALLOWED_ORIGINS` when prompted.
- **Docker/VPS:** build with the Docker command above on any host that supports persistent Node containers and WebSockets.

The frontend can remain on GitHub Pages or another static host. Only this relay
needs a WebSocket-capable application host. Cloudflare Pages can still host the
static frontend; a Cloudflare Worker is not the portable Wisp server target.

## Security defaults

The server requires a token, rejects private and loopback IP destinations,
rejects direct-IP destinations, limits outbound streams to ports 80 and 443,
and applies per-connection stream limits. Keep the token private and rotate it
if it is exposed. This is a general-purpose web transport, so do not publish
the token in source code or share it publicly.

## Compatibility

The browser frontend must connect to the exact WebSocket endpoint shown above.
The Scramjet transport integration and local browser assets are added in the
frontend migration stage. Until that stage is complete, this relay is only the
new backend foundation and does not replace the legacy `/proxy` Worker.
