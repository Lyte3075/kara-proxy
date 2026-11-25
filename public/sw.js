// Apply the same guard inside the service worker before Scramjet is loaded.
const NativeResponse = self.Response;
self.Response = new Proxy(NativeResponse, {
  construct(target, args, newTarget) {
    const init = args[1];
    if ([204, 205, 304].includes(init?.status ?? 200) && args[0] != null) {
      console.warn("[Kara] Normalized a body on HTTP", init.status, "response.");
      args[0] = null;
    }
    return Reflect.construct(target, args, newTarget);
  },
});

importScripts("./controller/controller.sw.js");

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // A malformed or browser-generated request must never crash the entire
  // fetch handler. In particular, Safari can occasionally surface a request
  // whose URL is empty or the literal string "null".
  const requestUrl = event.request && event.request.url;
  if (typeof requestUrl !== "string" || !requestUrl || requestUrl === "null") {
    return;
  }

  let shouldRoute = false;
  try {
    shouldRoute = $scramjetController.shouldRoute(event);
  } catch (error) {
    console.warn("[Kara] Ignored a request with an invalid service-worker URL:", error);
    return;
  }

  if (shouldRoute) {
    event.respondWith(
      Promise.resolve()
        .then(() => $scramjetController.route(event))
        .catch((error) => {
          console.error("[Kara] Scramjet request routing failed:", error);
          return new Response("Kara could not route this request: " + (error?.message || String(error)), {
            status: 502,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        })
    );
  }
});
