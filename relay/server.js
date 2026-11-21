import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";

const port = Number.parseInt(process.env.PORT || "8080", 10);
const token = process.env.WISP_TOKEN?.trim() || "";
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid TCP port.");
}

if (token.length < 32) {
  throw new Error("Set WISP_TOKEN to a random value at least 32 characters long.");
}

logging.set_level(logging.INFO);

// Keep the relay useful for normal web browsing while preventing it from
// becoming a tunnel into private networks or arbitrary server ports.
wisp.options.allow_private_ips = false;
wisp.options.allow_loopback_ips = false;
wisp.options.allow_direct_ip = false;
wisp.options.port_whitelist = [80, 443];
wisp.options.stream_limit_per_host = 8;
wisp.options.stream_limit_total = 128;

function sendJson(response, status, body, origin) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": origin || "null",
    "Vary": "Origin",
  });
  response.end(JSON.stringify(body));
}

function originAllowed(origin) {
  return allowedOrigins.length === 0 || (origin && allowedOrigins.includes(origin));
}

function tokenMatches(candidate) {
  if (typeof candidate !== "string") return false;
  const expected = Buffer.from(token);
  const supplied = Buffer.from(candidate);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", "http://localhost");
  const origin = request.headers.origin || "";

  if (requestUrl.pathname === "/health" || requestUrl.pathname === "/") {
    if (origin && !originAllowed(origin)) {
      sendJson(response, 403, { ok: false, error: "Origin not allowed" }, "null");
      return;
    }

    sendJson(response, 200, {
      ok: true,
      service: "kara-wisp-relay",
      protocol: "wisp",
      websocketPath: "/wisp/",
    }, origin || "*");
    return;
  }

  if (requestUrl.pathname === "/robots.txt") {
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("User-agent: *\nDisallow: /\n");
    return;
  }

  sendJson(response, 404, { ok: false, error: "Not found" }, origin || "*");
});

server.on("upgrade", (request, socket, head) => {
  let requestUrl;

  try {
    // Never use the untrusted Host header as the URL base.
    requestUrl = new URL(request.url || "/", "http://localhost");
  } catch {
    socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
    return;
  }

  if (requestUrl.pathname !== "/wisp/") {
    socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
    return;
  }

  if (!tokenMatches(requestUrl.searchParams.get("token"))) {
    socket.end("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    return;
  }

  const origin = request.headers.origin || "";
  if (origin && !originAllowed(origin)) {
    socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    return;
  }

  // Wisp handles the WebSocket handshake and multiplexed TCP streams.
  // Do not log request URLs because the query contains the relay token.
  try {
    wisp.routeRequest(request, socket, head);
  } catch (error) {
    console.error("Wisp upgrade failed:", error);
    socket.destroy();
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Kara Wisp relay listening on 0.0.0.0:${port}`);
  console.log("WebSocket endpoint: /wisp/");
  console.log(`Origin allowlist: ${allowedOrigins.length ? allowedOrigins.join(", ") : "not restricted"}`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
