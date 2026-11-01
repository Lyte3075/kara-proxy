import { X, ExternalLink } from "lucide-react";

export function DeployHelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-2xl border p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
        style={{ borderColor: "var(--border-primary)", background: "var(--bg-elev)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Deploy your own relay — free, no card</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <ol className="space-y-3 text-sm text-[var(--text-secondary)] leading-relaxed list-decimal list-inside">
          <li>Go to <a href="https://dash.cloudflare.com" target="_blank" rel="noreferrer noopener" className="text-[var(--accent-bright)] hover:opacity-80 inline-flex items-center gap-0.5">dash.cloudflare.com <ExternalLink size={12} /></a> and sign up (free, no credit card).</li>
          <li>Sidebar: <span className="text-[var(--text-primary)]">Workers &amp; Pages → Create Worker</span>.</li>
          <li>Name it (e.g. <code className="text-[var(--accent-bright)]">proxy-relay</code>) and click <span className="text-[var(--text-primary)]">Deploy</span>.</li>
          <li>Click <span className="text-[var(--text-primary)]">Edit code</span>, then paste the contents of <code className="text-[var(--accent-bright)]">worker/worker.js</code> from this project.</li>
          <li>Click <span className="text-[var(--text-primary)]">Deploy</span>. Copy the <code className="text-[var(--accent-bright)]">*.workers.dev</code> URL.</li>
          <li>Open Settings (gear icon) and paste that URL into the Relay endpoint field.</li>
        </ol>
        <p className="text-xs text-[var(--text-muted)] mt-4 leading-relaxed">
          The free plan allows 100,000 requests/day. Your own relay won't be on shared blocklists.
        </p>
      </div>
    </div>
  );
}
