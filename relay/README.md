# Kara Wisp relay

Kara's relay is a provider-independent Node.js 22 service using `@mercuryworkshop/wisp-js`. It accepts Scramjet Wisp WebSocket connections at `/wisp/`.

The frontend is static and can stay on GitHub Pages or Vercel. The relay is a separate service and can run on any host that supports Docker (recommended) or Node.js 22, persistent WebSocket upgrades, and HTTPS.

## Universal deployment

The repository root now contains a standard `Dockerfile`. Most container-based hosting platforms can detect it automatically when connected to this repository. No provider-specific adapter or Wisp implementation is required.

Use these settings if the host asks for them:

| Setting | Value |
| --- | --- |
| Repository | `Lyte3075/kara-proxy` |
| Dockerfile | `Dockerfile` (repository root) |
| Build context | Repository root (`.`) |
| Runtime | Node.js 22 container |
| Port | Provider's `PORT` variable, fallback `8080` |
| Health check | `/health` |
| WebSocket path | `/wisp/` |

Environment variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | Provider-dependent | Port assigned by the host. Defaults to `8080`. |
| `ALLOWED_ORIGINS` | Recommended | Comma-separated exact Kara frontend origins, e.g. `https://your-kara-site.example`. No path or trailing slash. |
| `WISP_TOKEN` | No | Optional shared token. Kara's current no-token configuration leaves this unset. |

The host must:
- Support persistent WebSocket connections and HTTP Upgrade requests.
- Forward WebSocket traffic without buffering or short idle timeouts.
- Provide HTTPS/TLS, so Kara can connect with `wss://`.
- Pass its assigned port through `PORT`.

After deployment, take the provider's HTTPS hostname, change `https://` to `wss://`, and append `/wisp/`.

Example: `wss://your-service.example/wisp/`

Health check: `https://your-service.example/health`

## Node.js deployment without Docker

If a host supports a native Node.js service, configure:

- Runtime: Node.js 22
- Root / working directory: `relay`
- Install command: `npm install --omit=dev`
- Start command: `npm start`
- Environment: `PORT` (provided by host) and `ALLOWED_ORIGINS`

The relay listens on `0.0.0.0` and uses the assigned `PORT`.

## Existing provider configurations

These existing files are intentionally retained:

- **Render:** root `render.yaml` continues to deploy using `relay/Dockerfile`. No change to the existing Render service is required.
- **Railway:** root `railway.json` continues to use `relay/Dockerfile`.
- **Portable Docker image:** root `Dockerfile` is the universal default for other platforms.
- **Explicit relay image:** `relay/Dockerfile` remains available for providers where you want to specify the path.

The two Dockerfiles package the same relay application. The root one exists for providers that automatically look for `Dockerfile` at the repository root.

## Security note

A public no-token relay can be abused by anyone who can reach it. `ALLOWED_ORIGINS` is useful browser-origin filtering, but the Origin header is not strong authentication because non-browser clients can forge it. Keep the relay private or add real authentication and rate limits before offering it as a public shared service.

The current relay blocks private, loopback, and direct-IP destinations, restricts destination ports to 80 and 443, and limits concurrent streams. Do not expose an unprotected relay as a public service for strangers.
