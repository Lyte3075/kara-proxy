const MAX_BYTES = 1024 * 1024;

function isPublicWebUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(":")) return false;
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const target = typeof req.query.url === "string" ? req.query.url : "";
  if (!isPublicWebUrl(target)) return res.status(400).json({ error: "A public HTTP(S) image URL is required." });

  try {
    const upstream = await fetch(target, {
      headers: { Accept: "image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5" },
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) return res.status(502).json({ error: "The icon host did not return an image." });

    const contentType = (upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!contentType.startsWith("image/")) return res.status(415).json({ error: "The selected URL is not an image." });

    const declaredLength = Number(upstream.headers.get("content-length") || 0);
    if (declaredLength > MAX_BYTES) return res.status(413).json({ error: "The icon is too large." });

    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_BYTES) return res.status(413).json({ error: "The icon is empty or too large." });

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(bytes.length));
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300, stale-while-revalidate=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(bytes);
  } catch {
    return res.status(502).json({ error: "Kara could not retrieve that favicon." });
  }
}
