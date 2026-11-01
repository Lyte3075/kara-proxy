import { useRef, useState } from "react";
import {
  X,
  Server,
  Search,
  Database,
  ExternalLink,
  Check,
  Trash2,
  RefreshCw,
  Download,
  Upload,
  KeyRound,
  Lock,
  Palette,
  Sun,
  Moon,
  Plus,
  BarChart3,
} from "lucide-react";
import type { Settings, BackupFile, EncryptedVault, HistoryEntry, Bookmark, SearchEngine, ProxyStats, ThemeColor, ThemeMode, CustomPalette } from "@/proxy/types";
import { DEFAULT_RELAY, SEARCH_ENGINES, THEME_COLORS } from "@/proxy/types";
import {
  buildBackupFile,
  downloadBackupFile,
  parseBackupFile,
  formatBytes,
  formatSpeed,
} from "@/proxy/utils";

interface SettingsPageProps {
  open: boolean;
  settings: Settings;
  history: HistoryEntry[];
  bookmarks: Bookmark[];
  vault: EncryptedVault | null;
  customEngines: SearchEngine[];
  stats: ProxyStats;
  onClose: () => void;
  onSave: (settings: Settings) => void;
  onClearHistory: () => void;
  onClearBookmarks: () => void;
  onResetAll: () => void;
  onImportBackup: (file: BackupFile) => void;
  onOpenVault: () => void;
  onAddEngine: (name: string, url: string) => void;
  onRemoveEngine: (id: string) => void;
  onOpenStats: () => void;
  customPalettes: CustomPalette[];
  onAddPalette: (name: string, accent: string, accentBright: string, accentHover: string, gradFrom: string, gradTo: string) => void;
  onRemovePalette: (id: string) => void;
  onSelectPalette: (id: string | null) => void;
}

type Tab = "relay" | "search" | "appearance" | "stats" | "data" | "vault";

export default function SettingsPage({
  open,
  settings,
  history,
  bookmarks,
  vault,
  customEngines,
  stats,
  onClose,
  onSave,
  onClearHistory,
  onClearBookmarks,
  onResetAll,
  onImportBackup,
  onOpenVault,
  onAddEngine,
  onRemoveEngine,
  onOpenStats,
  customPalettes,
  onAddPalette,
  onRemovePalette,
  onSelectPalette,
}: SettingsPageProps) {
  const [relay, setRelay] = useState(settings.relay);
  const [engineId, setEngineId] = useState(settings.searchEngineId);
  const [themeColor, setThemeColor] = useState<ThemeColor>(settings.themeColor);
  const [themeMode, setThemeMode] = useState<ThemeMode>(settings.themeMode);
  const [blockTrackers, setBlockTrackers] = useState(settings.blockTrackers);
  const [tab, setTab] = useState<Tab>("relay");
  const [saved, setSaved] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [newEngineName, setNewEngineName] = useState("");
  const [newEngineUrl, setNewEngineUrl] = useState("");
  const [paletteName, setPaletteName] = useState("");
  const [pAccent, setPAccent] = useState("#10b981");
  const [pBright, setPBright] = useState("#34d399");
  const [pHover, setPHover] = useState("#059669");
  const [pFrom, setPFrom] = useState("#059669");
  const [pTo, setPTo] = useState("#064e3b");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const allEngines = [...SEARCH_ENGINES, ...customEngines];
  const dirty =
    relay !== settings.relay ||
    engineId !== settings.searchEngineId ||
    themeColor !== settings.themeColor ||
    themeMode !== settings.themeMode ||
    blockTrackers !== settings.blockTrackers ||
    settings.customPaletteId !== null;

  const handleSave = () => {
    onSave({
      relay: relay.trim().replace(/\/+$/, "") || DEFAULT_RELAY,
      searchEngineId: engineId,
      themeColor,
      themeMode,
      customPaletteId: settings.customPaletteId,
      blockTrackers,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const validEngine =
    newEngineName.trim().length > 0 &&
    newEngineUrl.trim().includes("%s") &&
    newEngineUrl.trim().startsWith("http");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border bg-[var(--bg-elev)] shadow-2xl flex flex-col max-h-[88vh] overflow-hidden"
        style={{ borderColor: "var(--border-primary)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--border-primary)" }}
        >
          <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2 tracking-tight">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: "var(--accent)", boxShadow: "0 0 8px var(--accent-glow)" }}
            />
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--btn-hover)] transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 overflow-x-auto scrollbar-thin">
          <TabBtn active={tab === "relay"} onClick={() => setTab("relay")} icon={<Server size={15} />}>Relay</TabBtn>
          <TabBtn active={tab === "search"} onClick={() => setTab("search")} icon={<Search size={15} />}>Search</TabBtn>
          <TabBtn active={tab === "appearance"} onClick={() => setTab("appearance")} icon={<Palette size={15} />}>Appearance</TabBtn>
          <TabBtn active={tab === "stats"} onClick={() => setTab("stats")} icon={<BarChart3 size={15} />}>Stats</TabBtn>
          <TabBtn active={tab === "data"} onClick={() => setTab("data")} icon={<Database size={15} />}>Data</TabBtn>
          <TabBtn active={tab === "vault"} onClick={() => setTab("vault")} icon={<KeyRound size={15} />}>Vault</TabBtn>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === "relay" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Relay endpoint</label>
                <input
                  type="text"
                  value={relay}
                  onChange={(e) => setRelay(e.target.value)}
                  placeholder="https://your-relay.workers.dev"
                  spellCheck={false}
                  className="input font-mono"
                />
                <p className="text-xs text-[var(--text-muted)] mt-2 leading-relaxed">
                  The URL of your Cloudflare Worker relay. The default is a shared demo relay that
                  may be rate-limited — deploy your own for reliable browsing.
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                <input
                  id="block-trackers"
                  type="checkbox"
                  checked={blockTrackers}
                  onChange={(e) => setBlockTrackers(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                />
                <label htmlFor="block-trackers" className="cursor-pointer">
                  <span className="block text-sm font-medium text-[var(--text-primary)]">Block ads and trackers</span>
                  <span className="block text-xs text-[var(--text-muted)] mt-1 leading-relaxed">Blocks the tracker domains listed by your relay. Off by default because some sites depend on these services for images, video, maps, games, or sign-in.</span>
                </label>
              </div>
              <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                <p className="text-xs text-[var(--text-muted)] mb-2">Current relay</p>
                <p className="text-sm font-mono text-[var(--accent-bright)] break-all">{relay || DEFAULT_RELAY}</p>
                <p className="text-xs text-[var(--text-faint)] mt-2">Default: <code>{DEFAULT_RELAY}</code></p>
              </div>
              <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                <h3 className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                  <ExternalLink size={14} className="text-[var(--accent)]" />Deploy your own relay — free, no card
                </h3>
                <ol className="space-y-2 text-xs text-[var(--text-secondary)] leading-relaxed list-decimal list-inside">
                  <li>Go to <a href="https://dash.cloudflare.com" target="_blank" rel="noreferrer noopener" className="text-[var(--accent-bright)] hover:opacity-80 inline-flex items-center gap-0.5">dash.cloudflare.com <ExternalLink size={10} /></a> and sign up (free, no credit card).</li>
                  <li>Sidebar: <span className="text-[var(--text-primary)]">Workers &amp; Pages → Create Worker</span>.</li>
                  <li>Name it and click <span className="text-[var(--text-primary)]">Deploy</span>, then click <span className="text-[var(--text-primary)]">Edit code</span>.</li>
                  <li>Paste the contents of <code className="text-[var(--accent-bright)]">worker/worker.js</code> from this project, then click <span className="text-[var(--text-primary)]">Deploy</span>.</li>
                  <li>Copy the <code className="text-[var(--accent-bright)]">*.workers.dev</code> URL into the field above.</li>
                </ol>
                <p className="text-xs text-[var(--text-faint)] leading-relaxed">Free plan: 100,000 requests/day.</p>
              </div>
            </div>
          )}

          {tab === "search" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Default search engine</label>
                <p className="text-xs text-[var(--text-muted)] mb-3 leading-relaxed">
                  Used when you type a search term instead of a URL in the address bar.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {allEngines.map((engine) => (
                    <div key={engine.id} className="relative">
                      <button
                        onClick={() => setEngineId(engine.id)}
                        className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${engineId === engine.id ? "" : "hover:bg-[var(--btn-hover)]"}`}
                        style={engineId === engine.id
                          ? { borderColor: "var(--accent)", background: "var(--accent-glow)", boxShadow: "0 0 12px var(--accent-shadow)" }
                          : { borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }
                        }
                      >
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)]">{engine.name}</p>
                          <p className="text-xs text-[var(--text-muted)] font-mono">{engine.host}</p>
                        </div>
                        {engineId === engine.id && <Check size={16} className="text-[var(--accent)] shrink-0" />}
                      </button>
                      {engine.custom && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemoveEngine(engine.id); }}
                          className="absolute top-1.5 right-1.5 p-1 rounded text-[var(--text-faint)] hover:text-[var(--accent)] transition"
                          aria-label="Remove engine"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Add custom engine */}
              <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                <h3 className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                  <Plus size={14} className="text-[var(--accent)]" />Add custom search engine
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newEngineName}
                    onChange={(e) => setNewEngineName(e.target.value)}
                    placeholder="Engine name (e.g. Kagi)"
                    className="input"
                  />
                  <input
                    type="text"
                    value={newEngineUrl}
                    onChange={(e) => setNewEngineUrl(e.target.value)}
                    placeholder="https://kagi.com/search?q=%s"
                    spellCheck={false}
                    className="input font-mono"
                  />
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Use <code className="text-[var(--accent-bright)]">%s</code> where the search query goes.
                </p>
                <button
                  onClick={() => {
                    if (validEngine) {
                      onAddEngine(newEngineName.trim(), newEngineUrl.trim());
                      setNewEngineName("");
                      setNewEngineUrl("");
                    }
                  }}
                  disabled={!validEngine}
                  className="btn-primary"
                >
                  <Plus size={15} /> Add engine
                </button>
              </div>
            </div>
          )}

          {tab === "appearance" && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Color theme</label>
                <p className="text-xs text-[var(--text-muted)] mb-3 leading-relaxed">Choose the accent color for the interface.</p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {THEME_COLORS.map((tc) => (
                    <button
                      key={tc.id}
                      onClick={() => { setThemeColor(tc.id); onSelectPalette(null); }}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition ${themeColor === tc.id && !settings.customPaletteId ? "" : "hover:bg-[var(--btn-hover)]"}`}
                      style={themeColor === tc.id && !settings.customPaletteId
                        ? { borderColor: "var(--accent)", background: "var(--accent-glow)", boxShadow: "0 0 12px var(--accent-shadow)" }
                        : { borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }
                      }
                    >
                      <span className="w-8 h-8 rounded-lg" style={{ background: themeSwatch(tc.id) }} />
                      <span className="text-xs text-[var(--text-secondary)]">{tc.name}</span>
                      {themeColor === tc.id && !settings.customPaletteId && <Check size={13} className="text-[var(--accent)]" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom palettes */}
              {customPalettes.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Custom palettes</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {customPalettes.map((p) => (
                      <div key={p.id} className="relative">
                        <button
                          onClick={() => { onSelectPalette(p.id); setThemeColor(p.id as ThemeColor); }}
                          className={`w-full flex flex-col items-center gap-2 p-3 rounded-xl border transition ${settings.customPaletteId === p.id ? "" : "hover:bg-[var(--btn-hover)]"}`}
                          style={settings.customPaletteId === p.id
                            ? { borderColor: "var(--accent)", background: "var(--accent-glow)" }
                            : { borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }
                          }
                        >
                          <span className="w-8 h-8 rounded-lg" style={{ background: `linear-gradient(135deg, ${p.gradFrom}, ${p.gradTo})` }} />
                          <span className="text-xs text-[var(--text-secondary)]">{p.name}</span>
                          {settings.customPaletteId === p.id && <Check size={13} className="text-[var(--accent)]" />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemovePalette(p.id); if (settings.customPaletteId === p.id) onSelectPalette(null); }}
                          className="absolute top-1.5 right-1.5 p-1 rounded text-[var(--text-faint)] hover:text-[var(--accent)] transition"
                          aria-label="Remove palette"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Create custom palette */}
              <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                <h3 className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                  <Plus size={14} className="text-[var(--accent)]" />Create custom palette
                </h3>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Palette name</label>
                  <input type="text" value={paletteName} onChange={(e) => setPaletteName(e.target.value)} placeholder="e.g. Teal" className="input" />
                </div>
                <div className="grid grid-cols-5 gap-2">
                  <ColorField label="Accent" value={pAccent} onChange={setPAccent} />
                  <ColorField label="Bright" value={pBright} onChange={setPBright} />
                  <ColorField label="Hover" value={pHover} onChange={setPHover} />
                  <ColorField label="Grad from" value={pFrom} onChange={setPFrom} />
                  <ColorField label="Grad to" value={pTo} onChange={setPTo} />
                </div>
                <button
                  onClick={() => {
                    if (paletteName.trim()) {
                      onAddPalette(paletteName.trim(), pAccent, pBright, pHover, pFrom, pTo);
                      setPaletteName("");
                    }
                  }}
                  disabled={!paletteName.trim()}
                  className="btn-primary"
                >
                  <Plus size={15} /> Save palette
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Mode</label>
                <p className="text-xs text-[var(--text-muted)] mb-3 leading-relaxed">Toggle between dark and light appearance.</p>
                <div className="grid grid-cols-2 gap-2 max-w-xs">
                  <button onClick={() => setThemeMode("dark")} className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 transition ${themeMode === "dark" ? "" : "hover:bg-[var(--btn-hover)]"}`} style={themeMode === "dark" ? { borderColor: "var(--accent)", background: "var(--accent-glow)" } : { borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                    <Moon size={16} className="text-[var(--accent)]" />
                    <span className="text-sm font-medium text-[var(--text-primary)]">Dark</span>
                  </button>
                  <button onClick={() => setThemeMode("light")} className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 transition ${themeMode === "light" ? "" : "hover:bg-[var(--btn-hover)]"}`} style={themeMode === "light" ? { borderColor: "var(--accent)", background: "var(--accent-glow)" } : { borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                    <Sun size={16} className="text-[var(--accent)]" />
                    <span className="text-sm font-medium text-[var(--text-primary)]">Light</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === "stats" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MiniStat label="Data usage" value={formatBytes(stats.bytesDownloaded)} sub={`${stats.requestsMade} requests`} />
                <MiniStat label="Avg speed" value={formatSpeed(stats.requestsMade > 0 ? Math.round(stats.bytesDownloaded / Math.max(1, (Date.now() - stats.sessionStart) / 1000)) : 0)} sub="this session" />
                <MiniStat label="Blocked" value={String(stats.blockedRequests)} sub="trackers avoided" highlight />
              </div>
              <button
                onClick={() => { onOpenStats(); onClose(); }}
                className="btn-primary w-full"
              >
                <BarChart3 size={16} /> Open full dashboard
              </button>
              <p className="text-xs text-[var(--text-muted)] text-center leading-relaxed">
                Stats are tracked per session and reset when you reset all data.
              </p>
            </div>
          )}

          {tab === "data" && (
            <div className="space-y-4">
              <div className="space-y-3">
                <DataRow label="Browsing history" value={`${history.length} ${history.length === 1 ? "entry" : "entries"}`} onClear={onClearHistory} disabled={history.length === 0} />
                <DataRow label="Bookmarks" value={`${bookmarks.length} ${bookmarks.length === 1 ? "item" : "items"}`} onClear={onClearBookmarks} disabled={bookmarks.length === 0} />
              </div>
              <div className="pt-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-bright)] opacity-70 mb-3">Backup &amp; restore</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => downloadBackupFile(buildBackupFile(history, bookmarks))}
                    disabled={history.length === 0 && bookmarks.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition disabled:opacity-30"
                    style={{ borderColor: "var(--border-primary)", color: "var(--accent-bright)" }}
                  >
                    <Download size={15} /> Export backup
                  </button>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition"
                    style={{ borderColor: "var(--border-primary)", color: "var(--accent-bright)" }}
                  >
                    <Upload size={15} /> Import backup
                  </button>
                  <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const parsed = parseBackupFile(String(reader.result));
                      if (parsed) { onImportBackup(parsed); setImportMsg("Backup imported successfully."); }
                      else { setImportMsg("Couldn't read that file."); }
                      setTimeout(() => setImportMsg(null), 3000);
                    };
                    reader.readAsText(file);
                    e.target.value = "";
                  }} />
                </div>
                {importMsg && <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1"><Check size={13} /> {importMsg}</p>}
                <p className="text-xs text-[var(--text-faint)] mt-2 leading-relaxed">Export saves your history and bookmarks as a JSON file.</p>
              </div>
              <div className="pt-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                <button
                  onClick={() => { if (confirm("Reset all Kara data?")) onResetAll(); }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition"
                  style={{ borderColor: "var(--border-primary)", color: "var(--accent-bright)" }}
                >
                  <RefreshCw size={15} /> Reset everything
                </button>
                <p className="text-xs text-[var(--text-faint)] mt-2 leading-relaxed">Clears all stored data. Cannot be undone.</p>
              </div>
            </div>
          )}

          {tab === "vault" && (
            <div className="space-y-4">
              <div className="rounded-xl border p-5 text-center" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "var(--accent-glow)", border: "1px solid var(--accent-soft)" }}>
                  <Lock size={22} className="text-[var(--accent)]" />
                </div>
                <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1">Encrypted login vault</h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-sm mx-auto mb-4">
                  Save logins for your favorite sites, encrypted with a master password.
                </p>
                <button onClick={onOpenVault} className="btn-primary">{vault ? "Open vault" : "Create vault"}</button>
              </div>
              <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-faint)", background: "var(--bg-surface)" }}>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  <span className="text-[var(--accent-bright)] font-medium">How it works:</span> Logins are
                  encrypted with AES-256-GCM using PBKDF2 (150,000 iterations). Stored in your browser only.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: "var(--border-primary)" }}>
          <span className="text-xs text-[var(--text-faint)]">
            {saved ? <span className="text-emerald-400 flex items-center gap-1"><Check size={13} /> Saved</span>
            : dirty ? <span className="text-amber-400">Unsaved changes</span>
            : "All changes saved"}
          </span>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">Close</button>
            <button onClick={handleSave} disabled={!dirty} className="btn-primary">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{label}</label>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-full h-9 rounded-lg border cursor-pointer" style={{ borderColor: "var(--border-subtle)" }} />
    </div>
  );
}

function themeSwatch(color: ThemeColor): string {
  const map: Record<ThemeColor, string> = {
    red: "linear-gradient(135deg, #dc2626, #7f1d1d)",
    blue: "linear-gradient(135deg, #2563eb, #1e3a8a)",
    green: "linear-gradient(135deg, #16a34a, #14532d)",
    amber: "linear-gradient(135deg, #d97706, #92400e)",
    violet: "linear-gradient(135deg, #9333ea, #5b21b6)",
  };
  return map[color];
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition border"
      style={active
        ? { background: "var(--accent-glow)", color: "var(--accent-bright)", borderColor: "var(--accent-soft)" }
        : { color: "var(--text-muted)", borderColor: "transparent" }
      }
    >
      {icon}{children}
    </button>
  );
}

function DataRow({ label, value, onClear, disabled }: { label: string; value: string; onClear: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border px-4 py-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{value}</p>
      </div>
      <button
        onClick={onClear}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition disabled:opacity-30"
        style={{ borderColor: "var(--border-primary)", color: "var(--accent-bright)" }}
      >
        <Trash2 size={13} /> Clear
      </button>
    </div>
  );
}

function MiniStat({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: highlight ? "var(--accent-soft)" : "var(--border-subtle)", background: highlight ? "var(--accent-glow)" : "var(--bg-surface)" }}>
      <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-bold text-[var(--text-primary)]">{value}</p>
      <p className="text-xs text-[var(--text-faint)]">{sub}</p>
    </div>
  );
}
