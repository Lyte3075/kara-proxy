import type {
  HistoryEntry,
  Settings,
  Shortcut,
  Bookmark,
  SearchEngine,
  EncryptedVault,
  BackupFile,
  BrowserTab,
  ProxyStats,
  ThemeColor,
  ThemeMode,
  CustomPalette,
  SpeedTestResult,
} from "./types";
import {
  DEFAULT_RELAY,
  DEFAULT_RELAY_TOKEN,
  DEFAULT_SEARCH_ENGINE_ID,
  DEFAULT_THEME_COLOR,
  DEFAULT_THEME_MODE,
  DEFAULT_BLOCK_TRACKERS,
  SEARCH_ENGINES,
  STORAGE_KEYS,
} from "./types";

/* ---------- history ---------- */

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.history);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function saveHistory(entries: HistoryEntry[]): void {
  try { localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(entries.slice(0, 100))); } catch {}
}

/* ---------- settings ---------- */

const BUILT_IN_RELAYS = [
  { id: "kara-prod-page", name: "Kara Default (Blitz) · 1.5 GB RAM", url: "wss://kara.prod.page/wisp/", addedAt: 0 },
  { id: "kara-render", name: "Kara Proxy Wisp (Render)", url: "wss://kara-wisp-relay-p9eh.onrender.com/wisp/", addedAt: 0 },
];

function ensureBuiltInRelays(): void {
  try {
    const raw = localStorage.getItem("kara-saved-relays");
    const stored = raw ? JSON.parse(raw) : [];
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
  } catch {}
}

export function loadSettings(): Settings {
  ensureBuiltInRelays();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Settings>;
      return {
        relay: (() => { const last = localStorage.getItem("kara-last-relay"); const migratedLast = last === "wss://kara-proxy-wisp.onrender.com/wisp/" ? "wss://kara-wisp-relay-p9eh.onrender.com/wisp/" : last === "wss://kara.prod.page/" ? "wss://kara.prod.page/wisp/" : last; if (migratedLast && (migratedLast.startsWith("ws://") || migratedLast.startsWith("wss://"))) return migratedLast; const saved = p.relay === "wss://kara-proxy-wisp.onrender.com/wisp/" ? "wss://kara-wisp-relay-p9eh.onrender.com/wisp/" : p.relay === "wss://kara.prod.page/" ? "wss://kara.prod.page/wisp/" : p.relay; return typeof saved === "string" && (saved.startsWith("ws://") || saved.startsWith("wss://")) ? saved : DEFAULT_RELAY; })(),
        relayToken: typeof p.relayToken === "string" ? p.relayToken : DEFAULT_RELAY_TOKEN,
        searchEngineId: p.searchEngineId || DEFAULT_SEARCH_ENGINE_ID,
        themeColor: p.themeColor || DEFAULT_THEME_COLOR,
        themeMode: p.themeMode || DEFAULT_THEME_MODE,
        customPaletteId: p.customPaletteId ?? null,
        blockTrackers: p.blockTrackers === true,
        tabCloakEnabled: p.tabCloakEnabled === true,
        tabCloakTitle: typeof p.tabCloakTitle === "string" ? p.tabCloakTitle : "",
        tabCloakFavicon: typeof p.tabCloakFavicon === "string" ? p.tabCloakFavicon : "",
        translateEnabled: p.translateEnabled === true,
        translateLanguage: typeof p.translateLanguage === "string" ? p.translateLanguage : "es",
      };
    }
  } catch {}
  return { relay: DEFAULT_RELAY, relayToken: DEFAULT_RELAY_TOKEN, searchEngineId: DEFAULT_SEARCH_ENGINE_ID, themeColor: DEFAULT_THEME_COLOR, themeMode: DEFAULT_THEME_MODE, customPaletteId: null, blockTrackers: DEFAULT_BLOCK_TRACKERS, tabCloakEnabled: false, tabCloakTitle: "", tabCloakFavicon: "", translateEnabled: false, translateLanguage: "es" };
}

export function saveSettings(settings: Settings): void {
  try { localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings)); if (settings.relay) localStorage.setItem("kara-last-relay", settings.relay); } catch {}
}

/* ---------- shortcuts ---------- */

export function loadShortcuts(): Shortcut[] {
  try { const r = localStorage.getItem(STORAGE_KEYS.shortcuts); return r ? JSON.parse(r) : []; } catch { return []; }
}
export function saveShortcuts(s: Shortcut[]): void { try { localStorage.setItem(STORAGE_KEYS.shortcuts, JSON.stringify(s)); } catch {} }

/* ---------- bookmarks ---------- */

export function loadBookmarks(): Bookmark[] {
  try { const r = localStorage.getItem(STORAGE_KEYS.bookmarks); return r ? JSON.parse(r) : []; } catch { return []; }
}
export function saveBookmarks(b: Bookmark[]): void { try { localStorage.setItem(STORAGE_KEYS.bookmarks, JSON.stringify(b)); } catch {} }

/* ---------- vault ---------- */

export function loadEncryptedVault(): EncryptedVault | null {
  try { const r = localStorage.getItem(STORAGE_KEYS.vault); return r ? JSON.parse(r) : null; } catch { return null; }
}
export function saveEncryptedVault(v: EncryptedVault | null): void {
  try { if (v) localStorage.setItem(STORAGE_KEYS.vault, JSON.stringify(v)); else localStorage.removeItem(STORAGE_KEYS.vault); } catch {}
}

/* ---------- custom search engines ---------- */

export function loadCustomEngines(): SearchEngine[] {
  try { const r = localStorage.getItem(STORAGE_KEYS.customEngines); return r ? JSON.parse(r) : []; } catch { return []; }
}
export function saveCustomEngines(e: SearchEngine[]): void { try { localStorage.setItem(STORAGE_KEYS.customEngines, JSON.stringify(e)); } catch {} }

export function getAllEngines(custom: SearchEngine[]): SearchEngine[] { return [...SEARCH_ENGINES, ...custom]; }
export function getSearchEngine(id: string, custom: SearchEngine[] = []): SearchEngine {
  return getAllEngines(custom).find((e) => e.id === id) ?? SEARCH_ENGINES[0];
}
export function buildSearchUrl(engine: SearchEngine, query: string): string {
  return engine.searchUrl.replace("%s", encodeURIComponent(query));
}

/** Route a page through Google's translated-site host without changing the URL shown in Kara. */
export function buildTranslatedPageUrl(target: string, language: string): string {
  try {
    const url = new URL(target);
    if (url.protocol !== "http:" && url.protocol !== "https:") return target;
    if (url.hostname.endsWith(".translate.goog")) return target;
    url.hostname = url.hostname.replace(/\./g, "-") + ".translate.goog";
    url.searchParams.set("_x_tr_sl", "auto");
    url.searchParams.set("_x_tr_tl", language);
    url.searchParams.set("_x_tr_hl", language);
    return url.href;
  } catch {
    return target;
  }
}

/** Convert Google's translated-site URL back to the original page URL for Kara's address bar. */
export function restoreOriginalPageUrl(target: string): string {
  try {
    const url = new URL(target);
    const suffix = ".translate.goog";
    if (!url.hostname.endsWith(suffix)) return target;
    const translatedHost = url.hostname.slice(0, -suffix.length);
    url.hostname = translatedHost.replace(/--/g, "\u0000").replace(/-/g, ".").replace(/\u0000/g, "-");
    for (const key of ["_x_tr_sl", "_x_tr_tl", "_x_tr_hl", "_x_tr_pto", "_x_tr_sch", "_x_tr_hist"]) {
      url.searchParams.delete(key);
    }
    return url.href;
  } catch {
    return target;
  }
}

/* ---------- custom palettes ---------- */

export function loadCustomPalettes(): CustomPalette[] {
  try { const r = localStorage.getItem(STORAGE_KEYS.customPalettes); return r ? JSON.parse(r) : []; } catch { return []; }
}
export function saveCustomPalettes(p: CustomPalette[]): void { try { localStorage.setItem(STORAGE_KEYS.customPalettes, JSON.stringify(p)); } catch {} }

/** Apply a custom palette's CSS variables to the document root */
export function applyCustomPalette(p: CustomPalette | null): void {
  const root = document.documentElement;
  if (!p) { root.removeAttribute("data-custom-palette"); return; }
  root.setAttribute("data-custom-palette", p.id);
  root.style.setProperty("--accent", p.accent);
  root.style.setProperty("--accent-bright", p.accentBright);
  root.style.setProperty("--accent-hover", p.accentHover);
  root.style.setProperty("--accent-grad-from", p.gradFrom);
  root.style.setProperty("--accent-grad-to", p.gradTo);
  root.style.setProperty("--accent-soft", hexToRgba(p.accent, 0.5));
  root.style.setProperty("--accent-glow", hexToRgba(p.accent, 0.2));
  root.style.setProperty("--accent-tint", hexToRgba(p.gradTo, 0.4));
  root.style.setProperty("--accent-shadow", hexToRgba(p.gradTo, 0.3));
  root.style.setProperty("--accent-shadow-strong", hexToRgba(p.gradTo, 0.4));
  root.style.setProperty("--btn-hover", hexToRgba(p.gradTo, 0.3));
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ---------- stats ---------- */

export function loadStats(): ProxyStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.stats);
    if (raw) {
      const p = JSON.parse(raw) as Partial<ProxyStats>;
      return {
        bytesDownloaded: p.bytesDownloaded || 0,
        requestsMade: p.requestsMade || 0,
        blockedRequests: p.blockedRequests || 0,
        sessionStart: p.sessionStart || Date.now(),
        speedSamples: Array.isArray(p.speedSamples) ? p.speedSamples : [],
        recentBlocks: Array.isArray(p.recentBlocks) ? p.recentBlocks : [],
        customBlocklist: Array.isArray(p.customBlocklist) ? p.customBlocklist : [],
        allowedDomains: Array.isArray(p.allowedDomains) ? p.allowedDomains : [],
      };
    }
  } catch {}
  return { bytesDownloaded: 0, requestsMade: 0, blockedRequests: 0, sessionStart: Date.now(), speedSamples: [], recentBlocks: [], customBlocklist: [], allowedDomains: [] };
}

export function saveStats(stats: ProxyStats): void {
  try {
    localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify({
      ...stats,
      speedSamples: stats.speedSamples.slice(-30),
      recentBlocks: stats.recentBlocks.slice(-20),
    }));
  } catch {}
}

export function recordRequest(stats: ProxyStats, bytes: number): ProxyStats {
  const now = Date.now();
  const elapsed = Math.max(1, (now - stats.sessionStart) / 1000);
  const speed = Math.round(bytes / elapsed);
  return { ...stats, bytesDownloaded: stats.bytesDownloaded + bytes, requestsMade: stats.requestsMade + 1, speedSamples: [...stats.speedSamples, speed].slice(-30) };
}

export function recordBlocked(stats: ProxyStats): ProxyStats {
  return { ...stats, blockedRequests: stats.blockedRequests + 1, recentBlocks: [...stats.recentBlocks, Date.now()].slice(-20) };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatSpeed(bps: number): string { return `${formatBytes(bps)}/s`; }

/* ---------- speed tests ---------- */

export function loadSpeedTests(): SpeedTestResult[] {
  try { const r = localStorage.getItem(STORAGE_KEYS.speedTests); return r ? JSON.parse(r) : []; } catch { return []; }
}

export function saveSpeedTest(result: SpeedTestResult): SpeedTestResult[] {
  const all = [...loadSpeedTests(), result].slice(-20);
  try { localStorage.setItem(STORAGE_KEYS.speedTests, JSON.stringify(all)); } catch {}
  return all;
}

/* ---------- export stats / history as JSON or CSV ---------- */

export function exportStatsJson(stats: ProxyStats): void {
  const data = { ...stats, exportedAt: Date.now() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  triggerDownload(blob, `kara-stats-${new Date().toISOString().slice(0, 10)}.json`);
}

export function exportStatsCsv(stats: ProxyStats): void {
  const rows = [
    ["Metric", "Value"],
    ["Bytes Downloaded", String(stats.bytesDownloaded)],
    ["Requests Made", String(stats.requestsMade)],
    ["Blocked Requests", String(stats.blockedRequests)],
    ["Session Start", new Date(stats.sessionStart).toISOString()],
    ["Speed Samples", stats.speedSamples.join(";")],
  ];
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  triggerDownload(new Blob([csv], { type: "text/csv" }), `kara-stats-${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportHistoryJson(history: HistoryEntry[]): void {
  const data = { history, exportedAt: Date.now() };
  triggerDownload(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `kara-history-${new Date().toISOString().slice(0, 10)}.json`);
}

export function exportHistoryCsv(history: HistoryEntry[]): void {
  const rows = [["URL", "Display URL", "Title", "Timestamp", "Date"]];
  for (const h of history) {
    rows.push([h.url, h.displayUrl, h.title, String(h.ts), new Date(h.ts).toISOString()]);
  }
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  triggerDownload(new Blob([csv], { type: "text/csv" }), `kara-history-${new Date().toISOString().slice(0, 10)}.csv`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------- url helpers ---------- */

export function normalizeInput(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+.*$/i.test(t)) return `https://${t}`;
  return null;
}

export function buildProxiedUrl(relay: string, target: string, blockTrackers = false): string {
  const params = new URLSearchParams({ url: target });
  if (blockTrackers) params.set("blockTrackers", "1");
  return `${relay.replace(/\/+$/, "")}/proxy?${params.toString()}`;
}

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function uid(): string { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }

export function hostnameOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url.replace(/^https?:\/\//, "").replace(/^www\./, ""); }
}

export function initialOf(title: string): string {
  const m = title.trim().match(/[A-Za-z0-9]/);
  return m ? m[0].toUpperCase() : "?";
}

/* ---------- backup ---------- */

export function buildBackupFile(history: HistoryEntry[], bookmarks: Bookmark[]): BackupFile {
  return { version: 1, exportedAt: Date.now(), history, bookmarks };
}

export function parseBackupFile(text: string): BackupFile | null {
  try {
    const p = JSON.parse(text) as Partial<BackupFile>;
    if (!p || typeof p !== "object") return null;
    return {
      version: typeof p.version === "number" ? p.version : 1,
      exportedAt: typeof p.exportedAt === "number" ? p.exportedAt : Date.now(),
      history: Array.isArray(p.history) ? (p.history as HistoryEntry[]) : [],
      bookmarks: Array.isArray(p.bookmarks) ? (p.bookmarks as Bookmark[]) : [],
    };
  } catch { return null; }
}

export function downloadBackupFile(file: BackupFile): void {
  triggerDownload(new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }), `kara-backup-${new Date().toISOString().slice(0, 10)}.json`);
}

/* ---------- tabs ---------- */

export function createTab(): BrowserTab {
  return { id: uid(), title: "New Tab", url: null, iframeUrl: null, history: [], navIdx: -1, loading: false, error: null };
}
