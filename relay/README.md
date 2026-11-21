# Kara Wisp relay

Kara's relay is a portable Node.js 22 service using `@mercuryworkshop/wisp-js`. It accepts Scramjet Wisp WebSocket connections at `/wisp/`.

The frontend is static and can stay on GitHub Pages or Vercel. The relay is a separate service and can run on any host that supports a long-running Docker container and persistent WebSocket upgrades.

## Existing deployment files

These files are intentionally kept:

- **Render:** root `render.yaml` deploys the relay using `relay/Dockerfile`. Keep this file unchanged for the existing Render deployment.
- **Railway:** root `railway.json` also builds `relay/Dockerfile`.
- **Any Docker host:** use `relay/Dockerfile` directly.

Adding another provider does not require removing or replacing the Render Blueprint.

## Generic Docker deployment

When a provider asks for the build settings, use:

| Setting | Value |
| --- | --- |
| Repository | `Lyte3075/kara-proxy` |
| Dockerfile path | `relay/Dockerfile` |
| Docker build context | Repository root (`.`) |
| Runtime | Node.js 22 container |
| Port | Provider's `PORT` variable, fallback `8080` |
| Health check | `/health` |
| WebSocket path | `/wisp/` |

Environment variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | Provider-dependent | The port assigned by the host. Defaults to `8080`. |
| `ALLOWED_ORIGINS` | Recommended | Comma-separated exact Kara frontend origins, e.g. `https://your-kara-site.example`. No path or trailing slash. |
| `WISP_TOKEN` | No | Optional shared token. Kara's current no-token configuration leaves this unset. |

Do not hard-code a port if the provider supplies one. The included Dockerfile and server already read `PORT`.

The host must support:
- Persistent WebSocket connections and HTTP Upgrade requests.
- Forwarding WebSocket traffic without buffering or short idle timeouts.
- HTTPS/TLS, so Kara can connect with `wss://`.
- A provider-assigned `PORT` environment variable.

After deployment, take the provider's HTTPS hostname, change `https://` to `wss://`, and append `/wisp/`.

Example: `wss://your-service.example/wisp/`

Health check: `https://your-service.example/health`

## Hosting options

All of these use the same Dockerfile; they do not require a different Wisp implementation.

### Render

Use the existing root `render.yaml` Blueprint. This remains the default/easiest deployment for this repository.

### Northflank

Create a Service from the GitHub repository, choose a Dockerfile build, and set the Dockerfile path to `relay/Dockerfile`. Configure `ALLOWED_ORIGINS` and use the assigned public HTTPS domain. Northflank's Sandbox currently advertises up to $20/month of resources, with two services and no sleeping; usage beyond included resources can cost money.

### Koyeb

Create a Web Service from the GitHub repository and choose Dockerfile deployment. Point it to `relay/Dockerfile`, expose the assigned service port, and add `ALLOWED_ORIGINS`. Its free instance is limited (512 MB RAM, 0.1 vCPU) and scales to zero after one hour without traffic, so it is best for testing rather than dependable always-on use.

### Fly.io

Fly.io can run the Docker image, but it is usage-billed and does not offer a permanent free tier. Use it only if you are comfortable with potential charges.

### VPS, Coolify, or Dokploy

On a VPS with Docker, build from the repository root:

```sh
docker build -f relay/Dockerfile -t kara-wisp .
docker run --rm -p 8080:8080 \
  -e PORT=8080 \
  -e ALLOWED_ORIGINS="https://your-kara-site.example" \
  kara-wisp
```

Put Caddy or nginx in front for HTTPS and configure it to pass WebSocket Upgrade/Connection headers and allow long-lived connections. Coolify and Dokploy can deploy the same Dockerfile through their Git/Docker build interfaces.

### Railway

The root `railway.json` remains available and points to `relay/Dockerfile`. Railway's Free plan has a small monthly usage credit and can stop a service when the credit is exhausted; it is optional and not required for Kara.

## Security note

A public no-token relay can be abused by anyone who can reach it. `ALLOWED_ORIGINS` is useful browser-origin filtering, but the Origin header is not strong authentication because non-browser clients can forge it. Keep the relay private or add real authentication and rate limits before offering it as a public shared service.

The current relay blocks private, loopback, and direct-IP destinations, restricts destination ports to 80 and 443, and limits concurrent streams. Do not expose an unprotected relay as a public service for strangers.
