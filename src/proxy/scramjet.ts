import LibcurlClient from "@mercuryworkshop/libcurl-transport";
import { BareResponse } from "@mercuryworkshop/proxy-transports";
import { defaultConfig } from "@mercuryworkshop/scramjet";
import {
  Controller,
  ManagedPlugin,
  type Frame,
} from "@mercuryworkshop/scramjet-controller";

// Some transports return a body stream for statuses that the Fetch standard
// requires to be bodyless. Normalize those responses at the constructor
// boundary so every Scramjet code path is protected, not just the relay adapter.
function installSafeResponseGuard(scope: typeof globalThis): void {
  const guardKey = Symbol.for("kara.safe-response-guard");
  const target = scope as typeof globalThis & { [key: symbol]: unknown };
  if (target[guardKey]) return;

  const NativeResponse = scope.Response;
  const SafeResponse = new Proxy(NativeResponse, {
    construct(responseConstructor, args, newTarget) {
      const body = args[0];
      const init = args[1] as ResponseInit | undefined;
      if ([204, 205, 304].includes(init?.status ?? 200) && body != null) {
        console.warn("[Kara] Normalized a body on HTTP", init?.status, "response.");
        args[0] = null;
      }
      return Reflect.construct(responseConstructor, args, newTarget);
    },
  });

  Object.defineProperty(scope, "Response", {
    configurable: true,
    writable: true,
    value: SafeResponse,
  });
  Object.defineProperty(target, guardKey, { value: true });
}

installSafeResponseGuard(window);

export interface KaraFilterConfig {
  enabled: boolean;
  blockedDomains: string[];
}

class KaraFilterPlugin extends ManagedPlugin {
  constructor(private readonly getConfig: () => KaraFilterConfig) {
    super("kara-filter", []);
  }

  override install(frame: Frame): void {
    super.install(frame);

    this.tap(frame.hooks.fetch.request, (context, props) => {
      const config = this.getConfig();
      if (!config.enabled) return;

      const hostname = context.parsed.url.hostname.toLowerCase();
      const blocked = config.blockedDomains.some((domain) =>
        hostname === domain || hostname.endsWith(`.${domain}`)
      );

      if (blocked) {
        props.earlyResponse = BareResponse.fromNativeResponse(
          new Response(null, { status: 204, statusText: "No Content" })
        );
        window.parent.postMessage({ type: "kara-blocked" }, "*");
      }
    });

    this.tap(frame.hooks.fetch.response, (_context, props) => {
      const length = Number(props.response.headers.get("content-length")) || 0;
      window.parent.postMessage({ type: "kara-stats", bytes: length }, "*");
    });
  }
}

export function createKaraFilterPlugin(
  getConfig: () => KaraFilterConfig
): ManagedPlugin {
  return new KaraFilterPlugin(getConfig);
}

/**
 * libcurl-transport can return a stream body for HTTP statuses that Fetch
 * requires to be bodyless. Scramjet reconstructs these as native Responses,
 * which throws unless the body is null.
 */
function createSafeTransport(wispUrl: string): LibcurlClient {
  const client = new LibcurlClient({ wisp: wispUrl });

  return new Proxy(client, {
    get(target, property, receiver) {
      if (property === "request") {
        return async (...args: Parameters<LibcurlClient["request"]>) => {
          const response = await target.request(...args);
          if ([204, 205, 304].includes(response.status)) {
            return { ...response, body: null } as unknown as Awaited<
              ReturnType<LibcurlClient["request"]>
            >;
          }
          return response;
        };
      }

      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export function normalizeWispEndpoint(endpoint: string, token: string): string {
  const value = endpoint.trim();
  if (!value) throw new Error("Set your Wisp WebSocket endpoint in Settings first.");

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value)
    ? value
    : `wss://${value}`;

  const url = new URL(withScheme);
  if (url.protocol === "https:") url.protocol = "wss:";
  if (url.protocol === "http:") url.protocol = "ws:";
  if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new Error("The relay endpoint must use ws:// or wss://.");
  }
  if (window.location.protocol === "https:" && url.protocol !== "wss:") {
    throw new Error("Secure Kara pages require a wss:// relay endpoint.");
  }

  if (url.pathname === "/" || !url.pathname) {
    url.pathname = "/wisp/";
  } else if (!url.pathname.endsWith("/")) {
    url.pathname += "/";
  }

  const accessToken = token.trim();
  if (accessToken) url.searchParams.set("token", accessToken);
  else url.searchParams.delete("token");
  return url.toString();
}

let controllerPromise: Promise<Controller> | null = null;
let activeWispUrl = "";
let serviceWorkerKeepalive: number | null = null;

async function initializeController(wispUrl: string): Promise<Controller> {
  // Fail early with actionable messages instead of a generic blank loading screen.
  if (!window.isSecureContext) {
    throw new Error("Kara needs a secure HTTPS context for its browsing engine. Open the HTTPS version of Kara.");
  }
  if (!("serviceWorker" in navigator)) {
    throw new Error("This browser or its current privacy settings disable service workers. Allow service workers for Kara, then reload.");
  }
  if (typeof WebSocket === "undefined" || typeof WebAssembly === "undefined" || typeof fetch === "undefined") {
    throw new Error("This browser is missing a required WebSocket, WebAssembly, or Fetch feature. Update the browser or use a supported browser.");
  }

  const base = new URL(import.meta.env.BASE_URL || "/", window.location.origin);
  if (!base.pathname.endsWith("/")) base.pathname += "/";

  const swUrl = new URL("sw.js", base);
  let registration: ServiceWorkerRegistration;
  try {
    registration = await navigator.serviceWorker.register(swUrl, {
      scope: base.pathname,
      updateViaCache: "none",
    });
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : "Unknown registration error";
    throw new Error("Kara could not register its browsing service worker. Check whether this site's browser permissions or content settings block service workers. " + detail);
  }

  // The active worker is not necessarily controlling this document yet.
  // Scramjet routes proxied iframe requests only after this page is controlled.
  const readyRegistration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => window.setTimeout(
      () => reject(new Error("Kara's service worker is taking too long to start. Check browser site settings, then reload Kara.")),
      15000
    )),
  ]);

  const serviceworker = await new Promise<ServiceWorker>((resolve, reject) => {
    const current = navigator.serviceWorker.controller;
    if (current) {
      resolve(current);
      return;
    }

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Kara's service worker activated but did not take control of this page. Reload Kara and try again."));
    }, 15000);

    const checkController = () => {
      const worker = navigator.serviceWorker.controller;
      if (!worker) return;
      cleanup();
      resolve(worker);
    };

    const cleanup = () => {
      window.clearTimeout(timeout);
      navigator.serviceWorker.removeEventListener("controllerchange", checkController);
    };

    navigator.serviceWorker.addEventListener("controllerchange", checkController);
    // Check again after subscribing so a controllerchange between the first
    // read and listener registration cannot leave initialization waiting.
    checkController();
  });

  if (serviceworker.state !== "activated") {
    throw new Error("Kara's browsing service worker did not activate. The browser may be blocking background workers for this site. Allow them for Kara and reload.");
  }

  const controller = new Controller({
    serviceworker,
    transport: createSafeTransport(wispUrl),
    config: {
      prefix: `${base.pathname}~/sj/`,
      scramjetPath: new URL("scramjet/scramjet.js", base).pathname,
      injectPath: new URL("controller/controller.inject.js", base).pathname,
      wasmPath: new URL("scramjet/scramjet.wasm", base).pathname,
    },
    scramjetConfig: defaultConfig,
  });

  await controller.wait();

  // Scramjet currently keeps its frame-routing table in service-worker memory.
  // Some browsers terminate an idle worker and lose that table, so keep the
  // worker that owns this controller awake while Kara remains open.
  if (serviceWorkerKeepalive !== null) {
    window.clearInterval(serviceWorkerKeepalive);
  }
  serviceWorkerKeepalive = window.setInterval(() => {
    try {
      (navigator.serviceWorker.controller ?? serviceworker).postMessage("keepalive");
    } catch (error) {
      console.warn("[Kara] Could not send the Scramjet service-worker keepalive.", error);
    }
  }, 15000);

  return controller;
}

export async function getScramjetController(
  endpoint: string,
  token: string
): Promise<Controller> {
  const wispUrl = normalizeWispEndpoint(endpoint, token);

  if (!controllerPromise) {
    const pending = initializeController(wispUrl);
    const wrapped = pending.catch((error) => {
      if (controllerPromise === wrapped) controllerPromise = null;
      throw error;
    });
    controllerPromise = wrapped;
    activeWispUrl = wispUrl;
  }

  const controller = await controllerPromise;
  if (activeWispUrl !== wispUrl) {
    controller.setTransport(createSafeTransport(wispUrl));
    activeWispUrl = wispUrl;
  }
  return controller;
}

export function createKaraFrame(
  controller: Controller,
  iframe: HTMLIFrameElement,
  getFilterConfig: () => KaraFilterConfig
): Frame {
  return controller.createFrame(iframe, {
    plugins: [createKaraFilterPlugin(getFilterConfig)],
  });
}
