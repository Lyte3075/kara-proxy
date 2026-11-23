const MAX_BYTES = 1024 * 1024;

function isPublicWebUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
    if (/^(\\d{1,3}\\.){3}\\d{1,3}$/.test(host) || host.includes(":")) return false;
    return true;
  } catch {
    return false;
  }
}

function getCandidates(target) {
  const original = new URL(target);
  const candidates = [original.href];

  // Only expand standard site favicon requests. Custom image URLs remain exact.
  if (/^\\/favicon\\.ico$/i.test(original.pathname)) {
    const origin = original.origin;
    candidates.push(
      `${origin}/favicon.png`,
      `${origin}/favicon.svg`,
      `${origin}/apple-touch-icon.png`,
      `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(origin)}&sz=64`,
      `https://favicon.im/${original.hostname}`,
      `https://icon.horse/icon/${original.hostname}`
    );
  }

  return [...new Set(candidates)];
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const target = typeof req.query.url === "string" ? req.query.url : "";
  if (!isPublicWebUrl(target)) return res.status(400).json({ error: "A public HTTP(S) image URL is required." });

  for (const candidate of getCandidates(target)) {
    try {
      const upstream = await fetch(candidate, {
        headers: { Accept: "image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5" },
        redirect: "follow",
        signal: AbortSignal.timeout(5000),
      });
      if (!upstream.ok) continue;

      const contentType = (upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!contentType.startsWith("image/")) continue;

      const declaredLength = Number(upstream.headers.get("content-length") || 0);
      if (declaredLength > MAX_BYTES) continue;

      const bytes = Buffer.from(await upstream.arrayBuffer());
      if (!bytes.length || bytes.length > MAX_BYTES) continue;

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", String(bytes.length));
      res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300, stale-while-revalidate=3600");
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.status(200).send(bytes);
    } catch {
      // Try the next favicon location or provider.
    }
  }

  return res.status(502).json({ error: "No favicon could be retrieved from the site's available icon sources." });
}
