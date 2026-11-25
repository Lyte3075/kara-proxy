import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Home, Globe, RefreshCw } from "lucide-react";
import type { Frame } from "@mercuryworkshop/scramjet-controller";
import SiteInspector from "@/proxy/SiteInspector";
import {
  createKaraFrame,
  getScramjetController,
  normalizeWispEndpoint,
  type KaraFilterConfig,
} from "@/proxy/scramjet";

interface ProxyViewProps {
  iframeUrl: string | null;
  relay: string;
  relayToken: string;
  blockTrackers: boolean;
  blockedDomains: string[];
  loading: boolean;
  error: string | null;
  hidden?: boolean;
  onLoad: () => void;
  onError: (message: string) => void;
  onHome: () => void;
  onRelayChange: (endpoint: string) => void;
  autofillPayload: { username: string; password: string; nonce: number } | null;
  inspectorOpen: boolean;
  onCloseInspector: () => void;
}

export default function ProxyView({
  iframeUrl,
  relay,
  relayToken,
  blockTrackers,
  blockedDomains,
  loading,
  error,
  hidden = false,
  onLoad,
  onError,
  onHome,
  onRelayChange,
  autofillPayload,
  inspectorOpen,
  onCloseInspector,
}: ProxyViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const frameRef = useRef<Frame | null>(null);
  const filterConfigRef = useRef<KaraFilterConfig>({
    enabled: blockTrackers,
    blockedDomains,
  });
  const latestUrlRef = useRef(iframeUrl);
  const [slowLoad, setSlowLoad] = useState(false);
  const [relayStatus, setRelayStatus] = useState("");

  filterConfigRef.current = { enabled: blockTrackers, blockedDomains };
  latestUrlRef.current = iframeUrl;

  useEffect(() => {
    let cancelled = false;
    const relayProbeAbort = new AbortController();

    const navigate = async () => {
      if (!iframeUrl || !iframeRef.current) return;

      let target: URL;
      try {
        target = new URL(iframeUrl);
      } catch {
        onError("That address is not a valid URL.");
        return;
      }

      if (target.origin === window.location.origin) {
        iframeRef.current.src = target.href;
        return;
      }

      try {
      const readSavedRelays = (): Array<{ name: string; url: string }> => {
        try {
          const stored = JSON.parse(localStorage.getItem("kara-saved-relays") || "[]");
          if (!Array.isArray(stored)) return [];
          return stored.filter((item) => item && typeof item.url === "string" && item.url.startsWith("wss://"));
        } catch { return []; }
      };

      // Probe the actual Wisp WebSocket endpoint. An HTTP /health request is
      // not a reliable readiness check: some valid Wisp hosts expose no HTTP
      // health route, and Safari may block cross-origin health responses.
      const wakeRelay = async (endpoint: string): Promise<void> => {
        if (cancelled || relayProbeAbort.signal.aborted) throw new Error("Relay check cancelled.");
        const socketUrl = normalizeWispEndpoint(endpoint, relayToken);
        setRelayStatus("Connecting to relay…");

        await new Promise<void>((resolve, reject) => {
          let settled = false;
          const socket = new WebSocket(socketUrl);
          const signal = relayProbeAbort.signal;
          const timeout = window.setTimeout(() => {
            finish(new Error("The relay WebSocket connection timed out."));
          }, 12000);

          const onAbort = () => finish(new Error("Relay check cancelled."));
          const finish = (error?: Error) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeout);
            signal.removeEventListener("abort", onAbort);
            socket.onopen = null;
            socket.onerror = null;
            socket.onclose = null;
            try { socket.close(); } catch {}
            if (error) reject(error);
            else resolve();
          };

          signal.addEventListener("abort", onAbort, { once: true });
          if (signal.aborted) {
            onAbort();
            return;
          }

          socket.onopen = () => finish();
          socket.onerror = () => finish(new Error("Could not connect to the relay WebSocket. Check the WSS address and relay availability."));
          socket.onclose = () => finish(new Error("The relay closed the WebSocket before connecting."));
        });

        if (cancelled || relayProbeAbort.signal.aborted) throw new Error("Relay check cancelled.");
      };

      const saved = readSavedRelays();
      const candidates = [{ name: "Current relay", url: relay.trim() }, ...saved].filter((item, index, all) =>
        item.url && all.findIndex((candidate) => candidate.url === item.url) === index
      );
      let connectedController: Awaited<ReturnType<typeof getScramjetController>> | null = null;
      let lastError: unknown;
      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        try {
          await wakeRelay(candidate.url);
          if (cancelled) return;
          setRelayStatus("Relay awake. Connecting…");
          connectedController = await getScramjetController(candidate.url, relayToken);
          if (index > 0) {
            setRelayStatus("Switched to backup: " + candidate.name);
            onRelayChange(candidate.url);
          }
          break;
        } catch (cause) {
          lastError = cause;
          if (index < candidates.length - 1) setRelayStatus(candidate.name + " unavailable. Trying next relay…");
        }
      }
      if (!connectedController) throw lastError instanceof Error
        ? new Error("No saved Wisp relay could be reached. Last error: " + lastError.message)
        : new Error("No reachable Wisp relay is saved. Add another WSS endpoint in Settings.");
      if (cancelled || !iframeRef.current) return;
      if (!frameRef.current) {
        frameRef.current = createKaraFrame(connectedController, iframeRef.current, () => filterConfigRef.current);
      }
      const latestUrl = latestUrlRef.current;
      if (!latestUrl) return;
      const latest = new URL(latestUrl);
      if (latest.origin === window.location.origin) iframeRef.current.src = latest.href;
      else frameRef.current.go(latest.href);
      setRelayStatus("");
      } catch (cause) {
        if (!cancelled) {
          setRelayStatus("");
          onError(cause instanceof Error ? cause.message : "Could not initialize Scramjet.");
        }
      }
    };

    void navigate();
    return () => {
      cancelled = true;
      relayProbeAbort.abort();
    };
  }, [iframeUrl, relay, relayToken, onError, onRelayChange]);

  useEffect(() => {
    setSlowLoad(false);
    if (!loading) return;
    const timer = window.setTimeout(() => setSlowLoad(true), 12000);
    return () => window.clearTimeout(timer);
  }, [loading, iframeUrl]);

  useEffect(() => {
    if (!autofillPayload || !iframeRef.current) return;
    const iframe = iframeRef.current;
    const send = () => {
      try {
        iframe.contentWindow?.postMessage(
          { type: "kara-autofill", ...autofillPayload },
          "*"
        );
      } catch {}
    };
    send();
    const timer = window.setTimeout(send, 800);
    return () => window.clearTimeout(timer);
  }, [autofillPayload]);

  return (
    <div className={`flex-1 relative bg-[var(--bg-base)] ${hidden ? "hidden" : ""}`}>
      {error ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-[var(--bg-base)]">
          <div className="max-w-md text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--accent-glow)", border: "1px solid var(--accent-soft)" }}>
              <AlertTriangle size={26} className="text-[var(--accent)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Couldn't load that page</h3>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-4">{error}</p>
            <button onClick={onHome} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition" style={{ background: "var(--bg-surface)", color: "var(--text-primary)" }}>
              <Home size={15} /> Start over
            </button>
          </div>
        </div>
      ) : !iframeUrl ? (
        <div className="absolute inset-0 flex items-center justify-center p-6 bg-[var(--bg-base)]">
          <div className="max-w-md text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--accent-glow)", border: "1px solid var(--accent-soft)", boxShadow: "0 0 16px var(--accent-glow)" }}>
              <Globe size={26} className="text-[var(--accent)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Browse the web privately</h3>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              Type a URL or search above. Pages load through your Wisp relay, hiding your IP from the site you visit.
            </p>
          </div>
        </div>
      ) : null}

      {loading && iframeUrl && !error && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none" style={{ background: "var(--bg-base)" }}>
          <div className="text-center">
            <Loader2 size={28} className="text-[var(--accent)] animate-spin mx-auto" />
            {relayStatus && <p className="mt-3 text-xs text-[var(--text-muted)] flex items-center justify-center gap-1.5"><RefreshCw size={12} className="animate-spin" />{relayStatus}</p>}
            {slowLoad && !relayStatus && <p className="mt-3 text-xs text-[var(--text-muted)]">Still loading. The site or relay may be slow.</p>}
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        onLoad={onLoad}
        title="Browsing session"
        className="w-full h-full bg-black"
        style={{ display: iframeUrl && !error ? "block" : "none" }}
        sandbox="allow-same-origin allow-forms allow-scripts allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-pointer-lock allow-presentation allow-storage-access-by-user-activation allow-top-navigation-by-user-activation allow-top-navigation-to-custom-protocols"
        allow="accelerometer; autoplay; clipboard-read; clipboard-write; encrypted-media; fullscreen; geolocation; microphone; camera; payment; picture-in-picture"
        referrerPolicy="no-referrer"
      />
      <SiteInspector iframeRef={iframeRef} open={inspectorOpen && Boolean(iframeUrl) && !error} onClose={onCloseInspector} />
    </div>
  );
}
