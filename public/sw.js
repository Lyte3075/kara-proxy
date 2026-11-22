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
  if ($scramjetController.shouldRoute(event)) {
    event.respondWith($scramjetController.route(event));
  }
});
