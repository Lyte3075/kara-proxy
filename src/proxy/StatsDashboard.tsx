import { useState, useCallback } from "react";
import {
  Activity, Download, ShieldX, Zap, X, TrendingUp, Gauge,
  Trash2, Plus, FileJson, FileSpreadsheet, Wifi,
} from "lucide-react";
import type { ProxyStats, SpeedTestResult, HistoryEntry } from "@/proxy/types";
import { TRACKER_DOMAINS } from "@/proxy/types";
import { formatBytes, formatSpeed, exportStatsJson, exportStatsCsv, exportHistoryJson, exportHistoryCsv } from "@/proxy/utils";

interface StatsDashboardProps {
  stats: ProxyStats;
  history: HistoryEntry[];
  relay: string;
  speedTests: SpeedTestResult[];
  onSpeedTest: (result: SpeedTestResult) => void;
  onAddBlockedDomain: (domain: string) => void;
  onRemoveBlockedDomain: (domain: string) => void;
  onAllowDomain: (domain: string) => void;
  onRemoveAllowed: (domain: string) => void;
  onClose: () => void;
}

export default function StatsDashboard({
  stats, history, relay, speedTests, onSpeedTest,
  onAddBlockedDomain, onRemoveBlockedDomain, onAllowDomain, onRemoveAllowed, onClose,
}: StatsDashboardProps) {
  const [newDomain, setNewDomain] = useState("");
  const [testing, setTesting] = useState(false);
  const [testPhase, setTestPhase] = useState("");
  const [lastResult, setLastResult] = useState<SpeedTestResult | null>(speedTests.length > 0 ? speedTests[speedTests.length - 1] : null);

  const sessionSecs = Math.max(1, Math.floor((Date.now() - stats.sessionStart) / 1000));
  const avgSpeed = stats.requestsMade > 0 ? Math.round(stats.bytesDownloaded / sessionSecs) : 0;
  const lastSpeed = stats.speedSamples.length > 0 ? stats.speedSamples[stats.speedSamples.length - 1] : 0;
  const maxSample = Math.max(1, ...stats.speedSamples);

  // Default trackers minus user-allowed + user-added
  const effectiveBlocklist = [...TRACKER_DOMAINS.filter((d) => !stats.allowedDomains.includes(d)), ...stats.customBlocklist];

  const runSpeedTest = useCallback(async () => {
    setTesting(true);
    setTestPhase("Measuring latency...");
    try {
      const base = relay.replace(/\/+$/, "");
      // Latency test
      const t0 = performance.now();
      await fetch(`${base}/health`, { cache: "no-store" });
      const latency = Math.round(performance.now() - t0);

      setTestPhase("Downloading test data...");
      // Download test: fetch 512KB from relay's speedtest endpoint
      const dt0 = performance.now();
      const resp = await fetch(`${base}/speedtest?size=524288`, { cache: "no-store" });
      const buf = await resp.arrayBuffer();
      const downloadMs = Math.max(1, performance.now() - dt0);
      const downloadSpeed = Math.round((buf.byteLength / downloadMs) * 1000);

      setTestPhase("Uploading test data...");
      // Upload test: send data back to relay
      const uploadData = new Uint8Array(262144);
      crypto.getRandomValues(uploadData);
      const ut0 = performance.now();
      await fetch(`${base}/speedtest?size=1`, {
        method: "POST",
        body: uploadData,
        headers: { "Content-Type": "application/octet-stream" },
      });
      const uploadMs = Math.max(1, performance.now() - ut0);
      const uploadSpeed = Math.round((uploadData.length / uploadMs) * 1000);

      const result: SpeedTestResult = { downloadSpeed, uploadSpeed, latency, timestamp: Date.now() };
      setLastResult(result);
      onSpeedTest(result);
    } catch {
      setLastResult(null);
    } finally {
      setTesting(false);
      setTestPhase("");
    }
  }, [relay, onSpeedTest]);

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-base)]">
      <div className="max-w-3xl mx-auto px-6 pt-10 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, var(--accent-grad-from), var(--accent-grad-to))", boxShadow: "0 0 16px var(--accent-glow)" }}>
              <Activity size={18} className="text-[var(--text-on-accent)]" />
            </span>
            Stats Dashboard
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--btn-hover)] transition" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Big stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <StatCard icon={<Download size={18} />} label="Data Usage" value={formatBytes(stats.bytesDownloaded)} sub={`${stats.requestsMade} requests`} />
          <StatCard icon={<Zap size={18} />} label="Current Speed" value={formatSpeed(lastSpeed)} sub={`avg ${formatSpeed(avgSpeed)}`} />
          <StatCard icon={<ShieldX size={18} />} label="Blocked Requests" value={stats.blockedRequests.toString()} sub="trackers & ads avoided" highlight />
        </div>

        {/* Speed sparkline */}
        <div className="rounded-2xl border p-5 mb-6" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={15} className="text-[var(--accent)]" />
            <h3 className="text-sm font-medium text-[var(--text-primary)]">Connection Speed</h3>
            <span className="text-xs text-[var(--text-muted)] ml-auto">last {stats.speedSamples.length} requests</span>
          </div>
          {stats.speedSamples.length === 0 ? (
            <div className="h-24 flex items-center justify-center"><p className="text-xs text-[var(--text-muted)]">No data yet. Browse a page to see speed metrics.</p></div>
          ) : (
            <div className="flex items-end gap-1 h-24">
              {stats.speedSamples.map((s, i) => (
                <div key={i} className="flex-1 rounded-t transition-all duration-300" style={{ height: `${Math.max(4, (s / maxSample) * 100)}%`, background: "linear-gradient(to top, var(--accent-grad-to), var(--accent-bright))", opacity: 0.4 + (i / stats.speedSamples.length) * 0.6 }} title={formatSpeed(s)} />
              ))}
            </div>
          )}
        </div>

        {/* Speed Test */}
        <div className="rounded-2xl border p-5 mb-6" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Gauge size={15} className="text-[var(--accent)]" />
            <h3 className="text-sm font-medium text-[var(--text-primary)]">Network Speed Test</h3>
          </div>
          {testing ? (
            <div className="flex flex-col items-center py-6 gap-3">
              <Wifi size={32} className="text-[var(--accent)] animate-pulse" />
              <p className="text-sm text-[var(--text-secondary)]">{testPhase}</p>
            </div>
          ) : (
            <>
              {lastResult && (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <ResultCard label="Download" value={formatSpeed(lastResult.downloadSpeed)} />
                  <ResultCard label="Upload" value={formatSpeed(lastResult.uploadSpeed)} />
                  <ResultCard label="Latency" value={`${lastResult.latency} ms`} />
                </div>
              )}
              <button onClick={runSpeedTest} disabled={testing} className="btn-primary w-full">
                <Gauge size={16} /> {lastResult ? "Run again" : "Start speed test"}
              </button>
              {speedTests.length > 1 && (
                <p className="text-xs text-[var(--text-faint)] text-center mt-2">{speedTests.length} tests saved</p>
              )}
            </>
          )}
        </div>

        {/* Blocked requests timeline */}
        <div className="rounded-2xl border p-5 mb-6" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <div className="flex items-center gap-2 mb-4">
            <ShieldX size={15} className="text-[var(--accent)]" />
            <h3 className="text-sm font-medium text-[var(--text-primary)]">Blocked Requests Timeline</h3>
            <span className="text-xs text-[var(--text-muted)] ml-auto">{stats.blockedRequests} total</span>
          </div>
          {stats.recentBlocks.length === 0 ? (
            <div className="h-16 flex items-center justify-center"><p className="text-xs text-[var(--text-muted)]">No blocked requests yet.</p></div>
          ) : (
            <div className="flex items-end gap-0.5 h-16">
              {Array.from({ length: 20 }, (_, i) => {
                const ts = stats.recentBlocks[stats.recentBlocks.length - 20 + i];
                return <div key={i} className="flex-1 rounded-t-sm transition-all" style={{ height: ts ? "100%" : "4px", background: ts ? "var(--accent)" : "var(--border-faint)", opacity: ts ? 0.8 : 0.3 }} />;
              })}
            </div>
          )}
        </div>

        {/* Blocklist Management */}
        <div className="rounded-2xl border p-5 mb-6" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <div className="flex items-center gap-2 mb-4">
            <ShieldX size={15} className="text-[var(--accent)]" />
            <h3 className="text-sm font-medium text-[var(--text-primary)]">Blocklist Management</h3>
            <span className="text-xs text-[var(--text-muted)] ml-auto">{effectiveBlocklist.length} domains</span>
          </div>
          {/* Add domain */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="e.g. tracking.example.com"
              className="input flex-1"
              onKeyDown={(e) => { if (e.key === "Enter" && newDomain.trim()) { onAddBlockedDomain(newDomain.trim().toLowerCase()); setNewDomain(""); } }}
            />
            <button
              onClick={() => { if (newDomain.trim()) { onAddBlockedDomain(newDomain.trim().toLowerCase()); setNewDomain(""); } }}
              disabled={!newDomain.trim()}
              className="btn-primary"
            >
              <Plus size={15} /> Block
            </button>
          </div>
          {/* Custom blocked domains */}
          {stats.customBlocklist.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">Your custom blocks</p>
              <div className="flex flex-wrap gap-2">
                {stats.customBlocklist.map((d) => (
                  <DomainChip key={d} domain={d} onRemove={() => onRemoveBlockedDomain(d)} />
                ))}
              </div>
            </div>
          )}
          {/* Allowed (unblocked) domains */}
          {stats.allowedDomains.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">Allowed (removed from defaults)</p>
              <div className="flex flex-wrap gap-2">
                {stats.allowedDomains.map((d) => (
                  <DomainChip key={d} domain={d} variant="allow" onRemove={() => onRemoveAllowed(d)} />
                ))}
              </div>
            </div>
          )}
          {/* Default blocklist */}
          <div>
            <p className="text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">Default blocked domains</p>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto scrollbar-thin">
              {TRACKER_DOMAINS.filter((d) => !stats.allowedDomains.includes(d)).map((d) => (
                <DomainChip key={d} domain={d} variant="default" onAllow={() => onAllowDomain(d)} />
              ))}
            </div>
          </div>
        </div>

        {/* Export */}
        <div className="rounded-2xl border p-5 mb-6" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Download size={15} className="text-[var(--accent)]" />
            <h3 className="text-sm font-medium text-[var(--text-primary)]">Export Data</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <ExportBtn icon={<FileJson size={15} />} label="Stats JSON" onClick={() => exportStatsJson(stats)} />
            <ExportBtn icon={<FileSpreadsheet size={15} />} label="Stats CSV" onClick={() => exportStatsCsv(stats)} />
            <ExportBtn icon={<FileJson size={15} />} label="History JSON" onClick={() => exportHistoryJson(history)} disabled={history.length === 0} />
            <ExportBtn icon={<FileSpreadsheet size={15} />} label="History CSV" onClick={() => exportHistoryCsv(history)} disabled={history.length === 0} />
          </div>
        </div>

        {/* Session info */}
        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-[var(--text-muted)]">
          <span>Session started {new Date(stats.sessionStart).toLocaleTimeString()}</span>
          <span>·</span>
          <span>{Math.floor(sessionSecs / 60)}m {sessionSecs % 60}s elapsed</span>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, highlight }: { icon: React.ReactNode; label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: highlight ? "var(--accent-soft)" : "var(--border-subtle)", background: highlight ? "var(--accent-glow)" : "var(--bg-surface)" }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: highlight ? "var(--accent-glow)" : "var(--bg-input)", color: "var(--accent)" }}>{icon}</span>
        <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[var(--text-primary)] mb-1">{value}</p>
      <p className="text-xs text-[var(--text-muted)]">{sub}</p>
    </div>
  );
}

function ResultCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center rounded-xl border p-3" style={{ borderColor: "var(--border-faint)", background: "var(--bg-input)" }}>
      <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-bold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function DomainChip({ domain, onRemove, onAllow, variant }: { domain: string; onRemove?: () => void; onAllow?: () => void; variant?: "default" | "allow" }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs border" style={{ borderColor: variant === "allow" ? "var(--accent-soft)" : "var(--border-subtle)", background: variant === "allow" ? "var(--accent-glow)" : "var(--bg-input)" }}>
      <span className="text-[var(--text-secondary)] font-mono">{domain}</span>
      {onRemove && (
        <button onClick={onRemove} className="text-[var(--text-faint)] hover:text-[var(--accent)] transition" aria-label="Remove">
          <Trash2 size={11} />
        </button>
      )}
      {onAllow && (
        <button onClick={onAllow} className="text-[var(--text-faint)] hover:text-[var(--accent)] transition text-[10px] underline" aria-label="Allow domain">
          allow
        </button>
      )}
    </span>
  );
}

function ExportBtn({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium transition disabled:opacity-30 hover:bg-[var(--btn-hover)]" style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>
      {icon} {label}
    </button>
  );
}
