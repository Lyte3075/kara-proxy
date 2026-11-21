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
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Deploy a portable Wisp relay</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <ol className="space-y-3 text-sm text-[var(--text-secondary)] leading-relaxed list-decimal list-inside">
          <li>Deploy the repository using its root <code className="text-[var(--accent-bright)]">railway.json</code> or <code className="text-[var(--accent-bright)]">render.yaml</code>, or build <code className="text-[var(--accent-bright)]">relay/Dockerfile</code> on a Docker host.</li>
          <li>Set <code className="text-[var(--accent-bright)]">WISP_TOKEN</code> to a random secret at least 32 characters long.</li>
          <li>Set <code className="text-[var(--accent-bright)]">ALLOWED_ORIGINS</code> to the exact origin where Kara is hosted.</li>
          <li>Copy the deployed HTTPS hostname and use <code className="text-[var(--accent-bright)]">wss://hostname/wisp/</code> as the endpoint.</li>
          <li>Open Settings, paste the Wisp endpoint and WISP_TOKEN, then save.</li>
        </ol>
        <p className="text-xs text-[var(--text-muted)] mt-4 leading-relaxed">
          The frontend can stay on GitHub Pages or any static host. Only the Wisp relay needs a persistent WebSocket-capable host, so you can move it without rebuilding Kara's interface.
        </p>
        <a href="https://github.com/Lyte3075/kara-proxy/tree/scramjet-migration/relay" target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-sm text-[var(--accent-bright)] mt-4 hover:opacity-80">
          Relay deployment files <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
}
