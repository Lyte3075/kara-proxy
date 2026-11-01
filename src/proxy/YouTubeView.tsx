import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, ExternalLink, Loader2, Play } from "lucide-react";
import type { YouTubeTarget } from "@/proxy/utils";

interface YouTubeViewProps {
  target: YouTubeTarget;
  onBack: () => void;
}

export default function YouTubeView({ target, onBack }: YouTubeViewProps) {
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("YouTube");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const fetchTitle = useCallback(async (videoId: string) => {
    try {
      const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.title) setTitle(data.title);
      }
    } catch {
      // Title fetch is best-effort — not critical for playback
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setTitle("YouTube");
    fetchTitle(target.videoId);
  }, [target.videoId, fetchTitle]);

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-base)] min-h-0">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b shrink-0" style={{ borderColor: "var(--border-primary)" }}>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--btn-hover)] transition"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" style={{ boxShadow: "0 0 6px rgba(239,68,68,0.5)" }} />
          <span className="text-sm font-medium text-[var(--text-primary)] truncate">{title}</span>
        </div>
        <a
          href={target.watchUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--accent-bright)] transition shrink-0"
        >
          Open on YouTube <ExternalLink size={13} />
        </a>
      </div>

      {/* Video player */}
      <div className="flex-1 flex items-center justify-center min-h-0 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-base)] z-10">
            <Loader2 size={28} className="text-[var(--accent)] animate-spin" />
          </div>
        )}
        <div className="w-full max-w-4xl aspect-video mx-auto">
          <iframe
            ref={iframeRef}
            src={target.embedUrl}
            onLoad={() => setLoading(false)}
            title={title}
            className="w-full h-full rounded-xl shadow-2xl"
            style={{ border: "1px solid var(--border-subtle)" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      </div>

      {/* Info bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t shrink-0" style={{ borderColor: "var(--border-primary)" }}>
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
          <Play size={11} className="text-[var(--accent)]" /> YouTube embed
        </span>
        <span className="text-[11px] text-[var(--text-faint)] font-mono">ID: {target.videoId}</span>
      </div>
    </div>
  );
}
