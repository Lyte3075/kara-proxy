// Cloudflare Worker: web proxy relay
// Deploys free on Cloudflare Workers (no credit card required on free plan).
// Forward /proxy?url=<encoded url> requests and stream back the response with permissive CORS headers.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin, User-Agent, Referer",
  "Access-Control-Expose-Headers": "Content-Type, Content-Length, Content-Disposition, Location, X-Kara-Bytes",
};

// Known tracker/ad domains to block.
const TRACKER_DOMAINS = [
  "doubleclick.net", "googlesyndication.com", "google-analytics.com", "googletagmanager.com",
  "facebook.net", "connect.facebook.net", "twitter.com/ads", "adservice.google.com",
  "amazon-adsystem.com", "criteo.com", "criteo.net", "adsrvr.org", "adnxs.com",
  "2mdn.net", "rubiconproject.com", "pubmatic.com", "openx.net", "moatads.com",
  "scorecardresearch.com", "quantserve.com", "adsymptotic.com", "bidswitch.net",
  "taboola.com", "outbrain.com", "adsystem.com", "clarity.ms", "hotjar.com",
  "segment.io", "segment.com", "mixpanel.com", "amplitude.com", "fullstory.com",
  "sentry.io", "bugsnag.com", "newrelic.com", "nr-data.net",
];

function isTracker(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    return TRACKER_DOMAINS.some((d) => host === d || host.endsWith("." + d));
  } catch {
    return false;
  }
}

function errorPage(title, message) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;background:#0a0306;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem}
.card{max-width:420px;text-align:center}.icon{width:56px;height:56px;border-radius:16px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;font-size:28px}
h1{font-size:1.25rem;font-weight:600;margin-bottom:.5rem}p{font-size:.875rem;color:#a1a1aa;line-height:1.6}
.retry{margin-top:1.5rem;padding:.5rem 1.25rem;border-radius:.5rem;background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);color:#f87171;font-size:.875rem;cursor:pointer}
.retry:hover{background:rgba(239,68,68,0.3)}
</style></head><body><div class="card"><div class="icon">⚠️</div><h1>${title}</h1><p>${message}</p><button class="retry" onclick="history.back()">Go back</button></div></body></html>`;
  return new Response(html, { status: 502, headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders } });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, service: "proxy-relay", websockets: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (url.pathname === "/speedtest") {
      const size = parseInt(url.searchParams.get("size") || "102400", 10);
      const buf = new Uint8Array(Math.min(size, 1048576));
      crypto.getRandomValues(buf);
      return new Response(buf, { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store", "X-Kara-Bytes": String(buf.length), ...corsHeaders } });
    }

    // WebSocket proxy endpoint: /ws?url=<ws|wss target>
    if (url.pathname === "/ws") {
      return handleWebSocketUpgrade(url);
    }

    if (url.pathname !== "/proxy") {
      return new Response(JSON.stringify({ error: "Not found. Use /proxy?url=<target> or /ws?url=<target>" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const target = url.searchParams.get("url");
    if (!target) {
      return errorPage("No URL provided", "The proxy needs a URL to fetch. Please go back and try again.");
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return errorPage("Invalid URL", "The URL you entered couldn't be parsed. Please check it and try again.");
    }

    if (!["http:", "https:"].includes(targetUrl.protocol)) {
      return errorPage("Unsupported protocol", "Only HTTP and HTTPS URLs are supported.");
    }

    const blockTrackers = url.searchParams.get("blockTrackers") === "1";
    if (blockTrackers && isTracker(targetUrl.toString())) {
      return new Response(JSON.stringify({ blocked: true, url: targetUrl.toString() }), {
        status: 451,
        headers: { "Content-Type": "application/json", "X-Kara-Blocked": "true", ...corsHeaders },
      });
    }

    const workerBase = `${url.protocol}//${url.host}/proxy?${blockTrackers ? "blockTrackers=1&" : ""}url=`;
    const forwardHeaders = new Headers();
    for (const [key, value] of request.headers.entries()) {
      const lower = key.toLowerCase();
      if (["host", "cf-connecting-ip", "cf-ipcountry", "cf-ray", "cf-visitor", "x-forwarded-for", "x-forwarded-proto"].includes(lower)) continue;
      if (["origin", "referer"].includes(lower)) continue;
      forwardHeaders.set(key, value);
    }
    forwardHeaders.set("Referer", targetUrl.origin + "/");
    if (!forwardHeaders.has("User-Agent")) {
      forwardHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    }

    const init = { method: request.method, headers: forwardHeaders, redirect: "follow" };
    if (!["GET", "HEAD"].includes(request.method)) {
      init.body = request.body;
    }

    try {
      const upstream = await fetch(targetUrl.toString(), init);

      const respHeaders = new Headers(upstream.headers);
      // Strip headers that prevent the response from being displayed in an iframe
      respHeaders.delete("X-Frame-Options");
      respHeaders.delete("Content-Security-Policy");
      respHeaders.delete("Content-Security-Policy-Report-Only");
      respHeaders.delete("Cross-Origin-Opener-Policy");
      respHeaders.delete("Cross-Origin-Embedder-Policy");
      respHeaders.delete("Cross-Origin-Resource-Policy");
      for (const [k, v] of Object.entries(corsHeaders)) respHeaders.set(k, v);

      // If upstream returned an error status, return a styled error page
      if (upstream.status >= 400 && (respHeaders.get("Content-Type") || "").includes("text/html")) {
        let html = await upstream.text();
        html = rewriteUrlsInHtml(html, targetUrl, workerBase);
        html = injectKaraScripts(html, 0, targetUrl, workerBase);
        respHeaders.delete("Content-Encoding");
        respHeaders.set("Content-Type", "text/html; charset=utf-8");
        return new Response(html, { status: upstream.status, headers: respHeaders });
      }

      const contentLength = parseInt(respHeaders.get("Content-Length") || "0", 10) || 0;
      respHeaders.set("X-Kara-Bytes", String(contentLength));

      const contentType = respHeaders.get("Content-Type") || "";
      if (contentType.includes("text/html")) {
        let html = await upstream.text();
        html = rewriteUrlsInHtml(html, targetUrl, workerBase);
        html = injectKaraScripts(html, contentLength, targetUrl, workerBase);
        respHeaders.delete("Content-Encoding");
        respHeaders.set("Content-Type", "text/html; charset=utf-8");
        return new Response(html, { status: upstream.status, headers: respHeaders });
      }

      if (contentType.includes("text/css")) {
        const css = rewriteCssUrls(await upstream.text(), targetUrl, workerBase);
        respHeaders.delete("Content-Encoding");
        respHeaders.set("Content-Type", "text/css; charset=utf-8");
        return new Response(css, { status: upstream.status, headers: respHeaders });
      }

      return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
    } catch (err) {
      const msg = String(err);
      if (msg.includes("fetch") || msg.includes("connect")) {
        return errorPage("Couldn't reach that site", "The relay couldn't connect to the requested site. It may be down, blocking the relay, or the URL might be wrong.");
      }
      return errorPage("Proxy error", "An unexpected error occurred while fetching this page. Try again or try a different URL.");
    }
  },
};

function rewriteUrlsInHtml(html, pageUrl, workerBase) {
  const abs = (u) => { try { return new URL(u, pageUrl).href; } catch { return u; } };
  const through = (u) => {
    const value = u.trim();
    if (value.startsWith("data:") || value.startsWith("javascript:") || value.startsWith("blob:") || value.startsWith("#")) return value;
    return workerBase + encodeURIComponent(abs(value));
  };

  html = html.replace(/<(a|link|script|img|iframe|source|video|audio|track|embed|object)\b([^>]*?)\s(href|src|poster|data)\s*=\s*(["'])(.*?)\4/gi,
    (m, tag, pre, attr, q, val) => {
      const v = val.trim();
      if (v.startsWith("data:") || v.startsWith("javascript:") || v.startsWith("blob:") || v.startsWith("#")) return m;
      return `<${tag}${pre} ${attr}=${q}${through(v)}${q}`;
    });

  html = html.replace(/(srcset)\s*=\s*(["'])(.*?)\2/gi,
    (m, attr, q, val) => `${attr}=${q}${val.split(",").map((candidate) => { const parts = candidate.trim().split(/\s+/); return `${through(parts[0])}${parts.slice(1).length ? ` ${parts.slice(1).join(" ")}` : ""}`; }).join(", ")}${q}`);

  html = html.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
    (m, q, val) => `url(${through(val)})`);

  html = html.replace(/<form\b([^>]*?)\baction\s*=\s*(["'])(.*?)\2/gi,
    (m, pre, q, val) => {
      if (val.trim().startsWith("javascript:")) return m;
      return `<form${pre} action=${q}${through(val)}${q}`;
    });

  html = html.replace(/<base\b([^>]*?)\bhref\s*=\s*(["'])(.*?)\2/gi,
    (m, pre, q, val) => `<base${pre} href=${q}${through(val)}${q}`);

  html = html.replace(/<meta\b[^>]*(?:http-equiv\s*=\s*["']?(?:content-security-policy|x-frame-options)["']?)[^>]*>/gi, "");

  return html;
}

function rewriteCssUrls(css, pageUrl, workerBase) {
  const through = (value) => {
    const trimmed = value.trim();
    if (trimmed.startsWith("data:") || trimmed.startsWith("#")) return trimmed;
    try { return workerBase + encodeURIComponent(new URL(trimmed, pageUrl).href); } catch { return trimmed; }
  };
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote, value) => `url(${quote}${through(value)}${quote})`);
}

function injectKaraScripts(html, contentLength, targetUrl, workerBase) {
  const targetBase = JSON.stringify(targetUrl.href);
  const proxyBase = JSON.stringify(workerBase);
  const script = `<script>(function(){
  var targetBase=${targetBase},proxyBase=${proxyBase},relayOrigin=location.origin;
  function proxyUrl(value){if(!value)return value;try{var u=new URL(String(value),targetBase);if(u.origin===relayOrigin&&u.pathname==='/proxy')return u.href;if(u.protocol!=='http:'&&u.protocol!=='https:')return value;return proxyBase+encodeURIComponent(u.href);}catch(e){return value;}}

  function setVal(el,v){var p=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
  function tryFill(d){var pw=Array.from(document.querySelectorAll('input[type="password"]')).filter(function(e){return e.offsetParent!==null;});if(!pw.length)return false;setVal(pw[0],d.password||'');var f=pw[0].closest('form')||document.body;var uf=Array.from(f.querySelectorAll('input[type="text"],input[type="email"],input:not([type])')).filter(function(e){return e.offsetParent!==null&&e!==pw[0];})[0];if(uf)setVal(uf,d.username||'');return true;}
  window.addEventListener('message',function(e){if(!e.data||e.data.type!=='kara-autofill')return;tryFill(e.data);setTimeout(function(){tryFill(e.data);},500);setTimeout(function(){tryFill(e.data);},1500);});
  try{window.parent.postMessage({type:'kara-stats',bytes:${contentLength}},'*');}catch(e){}
  if(window.fetch){var of=window.fetch;window.fetch=function(input,init){var raw=typeof input==='string'?input:input&&input.url;var next=proxyUrl(raw||input);return of.call(this,next,init).then(function(r){if(r.status===451){try{window.parent.postMessage({type:'kara-blocked'},'*');}catch(e){}}return r;});};}
  var oo=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url,async,user,password){var xhr=this;xhr.addEventListener('load',function(){if(xhr.status===451){try{window.parent.postMessage({type:'kara-blocked'},'*');}catch(e){}}});return oo.call(this,method,proxyUrl(url),async,user,password);};

  /* WebSocket relay interception */
  var wsRelayBase=location.origin+'/ws?url=';
  var NativeWebSocket=window.WebSocket;
  window.WebSocket=function(targetUrl,protocols){
    var u;try{u=new URL(targetUrl,targetBase);}catch(e){return new NativeWebSocket(targetUrl,protocols);}
    if(u.protocol!=='ws:'&&u.protocol!=='wss:'){return new NativeWebSocket(targetUrl,protocols);}
    var relayed=wsRelayBase+encodeURIComponent(u.href);
    return protocols!==undefined?new NativeWebSocket(relayed,protocols):new NativeWebSocket(relayed);
  };
  window.WebSocket.prototype=NativeWebSocket.prototype;
  window.WebSocket.CONNECTING=NativeWebSocket.CONNECTING;
  window.WebSocket.OPEN=NativeWebSocket.OPEN;
  window.WebSocket.CLOSING=NativeWebSocket.CLOSING;
  window.WebSocket.CLOSED=NativeWebSocket.CLOSED;
  /* YouTube link interception — notify parent instead of proxying */
  function extractYouTubeId(href){
    try{var u=new URL(href,targetBase);var host=u.hostname.replace(/^www\\./,'').toLowerCase();
    if(['youtube.com','m.youtube.com','youtu.be','music.youtube.com'].indexOf(host)===-1)return null;
    var vid=null;
    if(host==='youtu.be')vid=u.pathname.slice(1).split('/')[0];
    else if(u.pathname==='/watch')vid=u.searchParams.get('v');
    else if(u.pathname.indexOf('/embed/')===0)vid=u.pathname.split('/')[2];
    else if(u.pathname.indexOf('/shorts/')===0)vid=u.pathname.split('/')[2];
    else if(u.pathname.indexOf('/live/')===0)vid=u.pathname.split('/')[2];
    return (vid&&/^[a-zA-Z0-9_-]{11}$/.test(vid))?vid:null;}catch(e){return null;}
  }
  document.addEventListener('click',function(e){
    var a=e.target.closest('a');if(!a)return;var vid=extractYouTubeId(a.href);if(!vid)return;
    e.preventDefault();e.stopPropagation();
    try{window.parent.postMessage({type:'kara-youtube',videoId:vid,href:a.href},'*');}catch(err){}
  },true);
  /* Intercept YouTube iframe embeds — replace with nocookie embed */
  document.addEventListener('DOMContentLoaded',function(){
    document.querySelectorAll('iframe[src]').forEach(function(f){
      var vid=extractYouTubeId(f.src);if(!vid)return;
      var s='https://www.youtube-nocookie.com/embed/'+vid+'?autoplay=0&rel=0&modestbranding=1';
      try{var u=new URL(f.src,targetBase);if(u.searchParams.get('list'))s+='&list='+u.searchParams.get('list');if(u.searchParams.get('t')||u.searchParams.get('start'))s+='&start='+(u.searchParams.get('t')||u.searchParams.get('start'));}catch(e){}
      f.src=s;f.removeAttribute('sandbox');
    });
  });
})();<\/script>`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + script);
  return script + html;
}

function handleWebSocketUpgrade(url) {
  const target = url.searchParams.get("url");
  if (!target) {
    return new Response(JSON.stringify({ error: "Missing url parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid target URL" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  if (!["ws:", "wss:"].includes(targetUrl.protocol)) {
    return new Response(JSON.stringify({ error: "Only ws:// and wss:// targets are supported" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const blockTrackers = url.searchParams.get("blockTrackers") === "1";
  if (blockTrackers && isTracker(targetUrl.hostname)) {
    return new Response(JSON.stringify({ blocked: true }), {
      status: 451,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const upstreamUrl = targetUrl.toString();
  const [clientWs, serverWs] = new WebSocketPair();
  serverWs.accept();

  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    try { clientWs.close(); } catch {}
    try { serverWs.close(); } catch {}
  };

  let upstreamWs = null;

  // Browser -> relay (buffer until upstream is ready, then forward)
  serverWs.addEventListener("message", (event) => {
    if (upstreamWs) { try { upstreamWs.send(event.data); } catch {} }
  });
  serverWs.addEventListener("close", cleanup);
  serverWs.addEventListener("error", cleanup);

  // Connect to the real upstream WebSocket
  (async () => {
    try {
      const upstream = await fetch(upstreamUrl, {
        headers: {
          "Upgrade": "websocket",
          "Connection": "Upgrade",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (upstream.status !== 101 || !upstream.webSocket) {
        try { clientWs.send(JSON.stringify({ error: "upstream refused websocket", status: upstream.status })); } catch {}
        cleanup();
        return;
      }

      upstreamWs = upstream.webSocket;

      // Upstream -> browser
      upstreamWs.addEventListener("message", (event) => {
        try { clientWs.send(event.data); } catch {}
      });
      upstreamWs.addEventListener("close", cleanup);
      upstreamWs.addEventListener("error", cleanup);
    } catch (err) {
      try { clientWs.send(JSON.stringify({ error: "relay connect failed", detail: String(err) })); } catch {}
      cleanup();
    }
  })();

  return new Response(null, { status: 101, webSocket: clientWs, headers: corsHeaders });
}
