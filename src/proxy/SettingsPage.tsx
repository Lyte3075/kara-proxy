import { useEffect, useRef, useState } from "react";
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
  Eye,
} from "lucide-react";
import type { Settings, BackupFile, EncryptedVault, HistoryEntry, Bookmark, SearchEngine, ProxyStats, ThemeColor, ThemeMode, CustomPalette } from "@/proxy/types";
import { DEFAULT_RELAY, DEFAULT_RELAY_TOKEN, SEARCH_ENGINES, THEME_COLORS } from "@/proxy/types";
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

type Tab = "relay" | "search" | "appearance" | "cloaking" | "stats" | "data" | "vault";

const BUILT_IN_RELAYS = [
  { id: "kara-prod-page", name: "Kara Default (Blitz) · 1.5 GB RAM", url: "wss://kara.prod.page/wisp/", addedAt: 0 },
  { id: "kara-render", name: "Kara Proxy Wisp (Render)", url: "wss://kara-wisp-relay-p9eh.onrender.com/wisp/", addedAt: 0 },
];

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
  useEffect(() => setRelay(settings.relay), [settings.relay]);
  const [relayToken, setRelayToken] = useState(settings.relayToken);
  const [relayName, setRelayName] = useState("");
  const [savedRelays, setSavedRelays] = useState<Array<{ id: string; name: string; url: string; addedAt: number }>>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("kara-saved-relays") || "[]");
      const existing = Array.isArray(stored)
        ? stored.filter((item) => item && typeof item.id === "string" && typeof item.name === "string" && typeof item.url === "string")
        : [];
      const migrated = existing.map((item) => item.url === "wss://kara-proxy-wisp.onrender.com/wisp/"
        ? { ...item, id: "kara-render", name: "Kara Proxy Wisp (Render)", url: "wss://kara-wisp-relay-p9eh.onrender.com/wisp/" }
        : item.url === "wss://kara-wisp-relay-p9eh.onrender.com/wisp/"
        ? { ...item, id: "kara-render", name: "Kara Proxy Wisp (Render)", url: "wss://kara-wisp-relay-p9eh.onrender.com/wisp/" }
        : item.url === "wss://kara.prod.page/"
          ? { ...item, url: "wss://kara.prod.page/wisp/" }
          : item);
      const merged = [...BUILT_IN_RELAYS, ...migrated.filter((item) => !BUILT_IN_RELAYS.some((builtin) => builtin.url === item.url))];
      localStorage.setItem("kara-saved-relays", JSON.stringify(merged));
      return merged;
    } catch {
      return BUILT_IN_RELAYS;
    }
  });
  const [engineId, setEngineId] = useState(settings.searchEngineId);
  const [themeColor, setThemeColor] = useState<ThemeColor>(settings.themeColor);
  const [themeMode, setThemeMode] = useState<ThemeMode>(settings.themeMode);
  const [blockTrackers, setBlockTrackers] = useState(settings.blockTrackers);
  const [tabCloakEnabled, setTabCloakEnabled] = useState(settings.tabCloakEnabled);
  const [tabCloakTitle, setTabCloakTitle] = useState(settings.tabCloakTitle);
  const [tabCloakFavicon, setTabCloakFavicon] = useState(settings.tabCloakFavicon);
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
    tabCloakEnabled !== settings.tabCloakEnabled ||
    tabCloakTitle !== settings.tabCloakTitle ||
    tabCloakFavicon !== settings.tabCloakFavicon ||
    settings.customPaletteId !== null;

  const handleSave = () => {
    onSave({
      relay: relay.trim() || DEFAULT_RELAY,
      relayToken: DEFAULT_RELAY_TOKEN,
      searchEngineId: engineId,
      themeColor,
      themeMode,
      customPaletteId: settings.customPaletteId,
      blockTrackers,
      tabCloakEnabled,
      tabCloakTitle: tabCloakTitle.trim(),
      tabCloakFavicon: tabCloakFavicon.trim(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const saveRelayLink = () => {
    const url = relay.trim();
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "wss:") return;
      const existing = savedRelays.find((item) => item.url === url);
      const entry = {
        id: existing?.id ?? `relay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: relayName.trim() || parsed.hostname,
        url,
        addedAt: existing?.addedAt ?? Date.now(),
      };
      const next = existing
        ? savedRelays.map((item) => item.id === existing.id ? entry : item)
        : [entry, ...savedRelays];
      setSavedRelays(next);
      localStorage.setItem("kara-saved-relays", JSON.stringify(next));
      setRelayName("");
    } catch {
      return;
    }
  };

  const useSavedRelay = (url: string) => {
    setRelay(url);
    onSave({ ...settings, relay: url, relayToken: DEFAULT_RELAY_TOKEN });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };

  const deleteSavedRelay = (id: string) => {
    const next = savedRelays.filter((item) => item.id !== id);
    setSavedRelays(next);
    localStorage.setItem("kara-saved-relays", JSON.stringify(next));
  };

  const openAboutBlank = () => {
    const popup = window.open("about:blank", "_blank");
    if (!popup) {
      setImportMsg("Your browser blocked the new tab. Allow pop-ups for Kara and try again.");
      return;
    }
    const doc = popup.document;
    doc.open();
    doc.write("<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head><body></body></html>");
    doc.close();
    doc.title = tabCloakEnabled && tabCloakTitle.trim() ? tabCloakTitle.trim() : "Kara";
    const iconUrl = tabCloakEnabled ? tabCloakFavicon.trim() : "";
    if (iconUrl) {
      try {
        const parsed = new URL(iconUrl, window.location.href);
        if (parsed.protocol === "https:" || parsed.protocol === "http:") {
          const icon = doc.createElement("link");
          icon.rel = "icon";
          icon.href = parsed.href;
          doc.head.appendChild(icon);
        }
      } catch {}
    }
    doc.documentElement.style.cssText = "width:100%;height:100%;margin:0;overflow:hidden;background:#09090b";
    doc.body.style.cssText = "width:100%;height:100%;margin:0;overflow:hidden";
    const frame = doc.createElement("iframe");
    frame.title = "Kara Proxy";
    frame.src = window.location.href;
    frame.allow = "accelerometer; autoplay; clipboard-read; clipboard-write; encrypted-media; fullscreen; geolocation; microphone; camera; payment; picture-in-picture";
    frame.referrerPolicy = "no-referrer";
    frame.style.cssText = "display:block;width:100%;height:100%;border:0;background:#09090b";
    doc.body.appendChild(frame);
  };

  const canSaveRelay = (() => {
    try {
      return new URL(relay.trim()).protocol === "wss:";
    } catch {
      return false;
    }
  })();

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
          <TabBtn active={tab === "cloaking"} onClick={() => setTab("cloaking")} icon={<Eye size={15} />}>Cloaking</TabBtn>
          <TabBtn active={tab === "stats"} onClick={() => setTab("stats")} icon={<BarChart3 size={15} />}>Stats</TabBtn>
          <TabBtn active={tab === "data"} onClick={() => setTab("data")} icon={<Database size={15} />}>Data</TabBtn>
          <TabBtn active={tab === "vault"} onClick={() => setTab("vault")} icon={<KeyRound size={15} />}>Vault</TabBtn>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === "relay" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Wisp WebSocket endpoint</label>
                <input
                  type="text"
                  value={relay}
                  onChange={(e) => setRelay(e.target.value)}
                  placeholder="wss://your-relay.example/wisp/"
                  spellCheck={false}
                  className="input font-mono"
                />
                <p className="text-xs text-[var(--text-muted)] mt-2 leading-relaxed">
                  Enter the secure WebSocket URL of your Wisp relay. Use the endpoint provided by your host, usually ending in /wisp/.
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
                  <span className="block text-xs text-[var(--text-muted)] mt-1 leading-relaxed">Filters the built-in tracker list and your custom blocked domains inside Scramjet before those requests reach the relay.</span>
                </label>
              </div>
              <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                <p className="text-xs text-[var(--text-muted)] mb-2">Current relay</p>
                <p className="text-sm font-mono text-[var(--accent-bright)] break-all">{relay || "Not configured"}</p>
                <p className="text-xs text-[var(--text-faint)] mt-2">The Kara .prod.page relay is preselected for new users. Kara Proxy Wisp on Render is included as a backup.</p>
              </div>
              <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                    <Server size={14} className="text-[var(--accent)]" />Saved relay links
                  </h3>
                  <span className="text-xs text-[var(--text-faint)]">{savedRelays.length} saved</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Kara probes each relay's /health endpoint to wake sleeping hosts, then tries saved relays in order if one stays unavailable. Hosts must expose the Kara Wisp health endpoint and allow cross-origin health checks.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2">
                  <input
                    type="text"
                    value={relayName}
                    onChange={(e) => setRelayName(e.target.value)}
                    placeholder="Name (e.g. Blitz)"
                    className="input"
                  />
                  <input
                    type="text"
                    value={relay}
                    readOnly
                    aria-label="Endpoint to save"
                    className="input font-mono opacity-75"
                  />
                  <button
                    onClick={saveRelayLink}
                    disabled={!canSaveRelay}
                    className="btn-primary disabled:opacity-40"
                    title="Save the endpoint above"
                  >
                    <Plus size={15} /> Save link
                  </button>
                </div>
                {savedRelays.length === 0 ? (
                  <p className="text-xs text-[var(--text-faint)] rounded-lg border border-dashed p-3 text-center" style={{ borderColor: "var(--border-primary)" }}>
                    Built-in Kara relays will appear here automatically. You can add your own relay above.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {savedRelays.map((item) => (
                      <div key={item.id} className="rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center gap-2" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elev)" }}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[var(--text-primary)] truncate">{item.name}</span>
                            {relay.trim() === item.url && <span className="text-[10px] rounded-full px-2 py-0.5" style={{ color: "var(--accent-bright)", background: "var(--accent-glow)" }}>Selected</span>}
                          </div>
                          <p className="text-xs font-mono text-[var(--text-muted)] break-all mt-1">{item.url}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => useSavedRelay(item.url)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition"
                            style={{ borderColor: "var(--accent-soft)", color: "var(--accent-bright)" }}
                          >
                            <Check size={13} /> Use
                          </button>
                          <button
                            onClick={() => deleteSavedRelay(item.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition hover:text-red-400"
                            style={{ borderColor: "var(--border-primary)", color: "var(--text-muted)" }}
                            aria-label={`Delete ${item.name}`}
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-[var(--text-faint)] leading-relaxed">Saved on this browser and this Kara website only. It won't automatically sync to another device. Wake-up attempts cannot override a host's sleep policy, and fallback only uses relays saved here.</p>
              </div>
              <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                <h3 className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                  <ExternalLink size={14} className="text-[var(--accent)]" />Deploy a portable Wisp relay
                </h3>
                <ol className="space-y-2 text-xs text-[var(--text-secondary)] leading-relaxed list-decimal list-inside">
                  <li>Deploy this repository on any host that supports Docker or Node.js 22 and persistent WebSocket connections. The root <code className="text-[var(--accent-bright)]">Dockerfile</code> is the universal deployment entrypoint.</li>
                  <li>Keep <code className="text-[var(--accent-bright)]">render.yaml</code> for the existing Render deployment. The existing Railway configuration is also retained.</li>
                  <li>Set <code className="text-[var(--accent-bright)]">ALLOWED_ORIGINS</code> to your exact Kara website origin.</li>
                  <li><code className="text-[var(--accent-bright)]">WISP_TOKEN</code> is optional. Kara's current setup does not send a token.</li>
                  <li>Copy the host's HTTPS address, change it to <code className="text-[var(--accent-bright)]">wss://</code>, and append <code className="text-[var(--accent-bright)]">/wisp/</code>.</li>
                  <li>Paste the endpoint above and save.</li>
                </ol>
                <p className="text-xs text-[var(--text-faint)] leading-relaxed">The frontend stays static. The relay is provider-independent; the host only needs to support HTTPS and long-lived WebSocket upgrades. See <code className="text-[var(--accent-bright)]">relay/README.md</code> for deployment settings.</p>
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

          {tab === "cloaking" && (
            <div className="space-y-4">
              <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                <div className="flex items-start gap-3">
                  <input
                    id="tab-cloak-enabled"
                    type="checkbox"
                    checked={tabCloakEnabled}
                    onChange={(e) => setTabCloakEnabled(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  />
                  <label htmlFor="tab-cloak-enabled" className="cursor-pointer">
                    <span className="block text-sm font-medium text-[var(--text-primary)]">Enable tab cloaking</span>
                    <span className="block text-xs text-[var(--text-muted)] mt-1 leading-relaxed">Customize the title and favicon shown for the Kara tab. This changes the browser's tab appearance, not the address bar or network identity.</span>
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Tab title</label>
                  <input type="text" value={tabCloakTitle} onChange={(e) => setTabCloakTitle(e.target.value)} placeholder="e.g. Google Classroom" maxLength={80} className="input" disabled={!tabCloakEnabled} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Favicon URL</label>
                  <input type="url" value={tabCloakFavicon} onChange={(e) => setTabCloakFavicon(e.target.value)} placeholder="https://example.com/favicon.ico" className="input font-mono" disabled={!tabCloakEnabled} />
                  <p className="text-[11px] text-[var(--text-faint)] mt-1.5">Use a direct HTTP or HTTPS image URL. Some browsers cache favicons, so changes may not appear immediately.</p>
                </div>
                <div className="space-y-4">
                  {[
                    { group: "Learning platforms", items: [
                      { label: "Canvas Dashboard", title: "Canvas Dashboard", domain: "canvas.instructure.com" },
                      { label: "ClassLink", title: "ClassLink", domain: "my.classlink.com" },
                      { label: "Clever", title: "Clever", domain: "clever.com" },
                      { label: "Schoology", title: "Schoology", domain: "app.schoology.com" },
                      { label: "Blackboard", title: "Blackboard", domain: "blackboard.com" },
                      { label: "Moodle", title: "Moodle", domain: "moodle.org" },
                      { label: "PowerSchool", title: "PowerSchool", domain: "powerschool.com" },
                      { label: "Infinite Campus", title: "Infinite Campus", domain: "infinitecampus.com" },
                      { label: "Google Classroom", title: "Google Classroom", domain: "classroom.google.com" },
                      { label: "Microsoft Teams", title: "Microsoft Teams", domain: "teams.microsoft.com" },
                      { label: "OneNote", title: "OneNote", domain: "onenote.com" },
                    ]},
                    { group: "Classroom tools", items: [
                      { label: "Seesaw", title: "Seesaw", domain: "web.seesaw.me" },
                      { label: "Nearpod", title: "Nearpod", domain: "nearpod.com" },
                      { label: "Kahoot!", title: "Kahoot!", domain: "kahoot.com" },
                      { label: "Quizlet", title: "Quizlet", domain: "quizlet.com" },
                      { label: "IXL", title: "IXL", domain: "ixl.com" },
                      { label: "Edpuzzle", title: "Edpuzzle", domain: "edpuzzle.com" },
                      { label: "Newsela", title: "Newsela", domain: "newsela.com" },
                      { label: "Edmodo", title: "Edmodo", domain: "edmodo.com" },
                    ]},
                    { group: "Learning resources", items: [
                      { label: "Khan Academy", title: "Khan Academy", domain: "khanacademy.org" },
                      { label: "Duolingo", title: "Duolingo", domain: "duolingo.com" },
                      { label: "Prodigy", title: "Prodigy", domain: "prodigygame.com" },
                      { label: "BrainPOP", title: "BrainPOP", domain: "brainpop.com" },
                      { label: "Discovery Education", title: "Discovery Education", domain: "discoveryeducation.com" },
                      { label: "McGraw Hill", title: "McGraw Hill", domain: "mheducation.com" },
                      { label: "Pearson", title: "Pearson", domain: "pearson.com" },
                      { label: "Savvas", title: "Savvas", domain: "savvas.com" },
                      { label: "HMH", title: "HMH", domain: "hmhco.com" },
                    ]},
                    { group: "Google Workspace", items: [
                      { label: "Google Docs", title: "Google Docs", domain: "docs.google.com" },
                      { label: "Google Drive", title: "Google Drive", domain: "drive.google.com" },
                      { label: "Google Slides", title: "Google Slides", domain: "slides.google.com" },
                      { label: "Google Sheets", title: "Google Sheets", domain: "sheets.google.com" },
                    ]},
                    { group: "Microsoft 365", items: [
                      { label: "Microsoft Word", title: "Microsoft Word", domain: "word.cloud.microsoft" },
                      { label: "Microsoft Excel", title: "Microsoft Excel", domain: "excel.cloud.microsoft" },
                      { label: "Microsoft PowerPoint", title: "Microsoft PowerPoint", domain: "powerpoint.cloud.microsoft" },
                      { label: "Microsoft Outlook", title: "Outlook", domain: "outlook.office.com" },
                    ]},
                  ].map((section) => (
                    <div key={section.group}>
                      <p className="text-xs font-medium text-[var(--text-muted)] mb-2">{section.group}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {section.items.map((preset) => {
                          const icon = `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(`https://${preset.domain}`)}&sz=64`;
                          const fallbackIcon = `https://${preset.domain}/favicon.ico`;
                          const selected = tabCloakTitle === preset.title && tabCloakFavicon === icon;
                          return (
                            <button key={preset.title} type="button" onClick={() => { setTabCloakEnabled(true); setTabCloakTitle(preset.title); setTabCloakFavicon(icon); }} className="flex items-center gap-2 min-w-0 px-3 py-2.5 rounded-lg border text-left text-xs transition hover:text-[var(--text-primary)]" style={{ borderColor: selected ? "var(--accent)" : "var(--border-primary)", background: selected ? "var(--accent-glow)" : "transparent" }}>
                              <img src={icon} alt="" loading="lazy" onError={(event) => { const image = event.currentTarget; if (image.src !== fallbackIcon) image.src = fallbackIcon; }} className="w-5 h-5 shrink-0 rounded-sm" />
                              <span className="truncate text-[var(--text-secondary)]">{preset.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-[var(--text-faint)] leading-relaxed">Preset icons are fetched using each service's full domain URL, with that site's /favicon.ico as a fallback. Some school-managed portals use district-specific branding, so you can replace any icon with your school's own image URL above.</p>
                <button type="button" onClick={handleSave} className="btn-primary" disabled={!dirty}>
                  <Check size={15} /> Save cloaking settings
                </button>
              </div>

              <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                <h3 className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2"><Eye size={15} className="text-[var(--accent)]" />Open Kara in about:blank</h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">Opens a new about:blank tab containing Kara in a full-screen embedded view. The outer tab can retain your chosen title and favicon while its address remains about:blank. Browser popup and iframe policies may prevent this on some devices.</p>
                <button type="button" onClick={openAboutBlank} className="btn-primary">
                  <ExternalLink size={15} /> Open about:blank tab
                </button>
                <p className="text-[11px] text-[var(--text-faint)] leading-relaxed">This is a launch convenience, not a security or anonymity feature. Your network requests still use the configured Wisp relay, and websites may still identify themselves within their own content.</p>
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
