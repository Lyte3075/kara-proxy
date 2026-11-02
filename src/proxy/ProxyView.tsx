import { useEffect, useRef } from "react";
import { AlertTriangle, Loader2, Home, Globe } from "lucide-react";

interface ProxyViewProps {
  iframeUrl: string | null;
  loading: boolean;
  error: string | null;
  onLoad: () => void;
  onHome: () => void;
  autofillPayload: { username: string; password: string; nonce: number } | null;
}

export default function ProxyView({ iframeUrl, loading, error, onLoad, onHome, autofillPayload }: ProxyViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [slowLoad, setSlowLoad] = useState(false);

  useEffect(() => { if (iframeUrl) iframeRef.current?.focus?.(); }, [iframeUrl]);

  useEffect(() => {
    setSlowLoad(false);
    if (!loading) return;
    const t = setTimeout(() => setSlowLoad(true), 12000);
    return () => clearTimeout(t);
  }, [loading, iframeUrl]);

  useEffect(() => {
    if (!autofillPayload || !iframeRef.current) return;
    const iframe = iframeRef.current;
    const send = () => { try { iframe.contentWindow?.postMessage({ type: "kara-autofill", ...autofillPayload }, "*"); } catch {} };
    send();
    const t = setTimeout(send, 800);
    return () => clearTimeout(t);
  }, [autofillPayload]);

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-[var(--bg-base)]">
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
    );
  }

  if (!iframeUrl) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-[var(--bg-base)]">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--accent-glow)", border: "1px solid var(--accent-soft)", boxShadow: "0 0 16px var(--accent-glow)" }}>
            <Globe size={26} className="text-[var(--accent)]" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Browse the web privately</h3>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            Type a URL or search above. Pages load through your relay, hiding your IP from the site you visit.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative bg-[var(--bg-base)]">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none" style={{ background: "var(--bg-base)" }}>
          <div className="text-center">
            <Loader2 size={28} className="text-[var(--accent)] animate-spin mx-auto" />
            {slowLoad && <p className="mt-3 text-xs text-[var(--text-muted)]">Still loading — the site may be slow or blocking the relay.</p>}
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={iframeUrl}
        onLoad={onLoad}
        title="Browsing session"
        className="w-full h-full bg-white"
        sandbox="allow-same-origin allow-forms allow-scripts allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-pointer-lock allow-presentation allow-top-navigation-by-user-activation"
        allow="accelerometer; autoplay; clipboard-read; clipboard-write; fullscreen; geolocation; microphone; camera; payment; picture-in-picture"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
