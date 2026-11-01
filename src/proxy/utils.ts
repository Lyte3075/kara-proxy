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

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Settings>;
      return {
        relay: p.relay || DEFAULT_RELAY,
        searchEngineId: p.searchEngineId || DEFAULT_SEARCH_ENGINE_ID,
        themeColor: p.themeColor || DEFAULT_THEME_COLOR,
        themeMode: p.themeMode || DEFAULT_THEME_MODE,
        customPaletteId: p.customPaletteId ?? null,
        blockTrackers: p.blockTrackers === true,
      };
    }
  } catch {}
  return { relay: DEFAULT_RELAY, searchEngineId: DEFAULT_SEARCH_ENGINE_ID, themeColor: DEFAULT_THEME_COLOR, themeMode: DEFAULT_THEME_MODE, customPaletteId: null, blockTrackers: DEFAULT_BLOCK_TRACKERS };
}

export function saveSettings(settings: Settings): void {
  try { localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings)); } catch {}
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
