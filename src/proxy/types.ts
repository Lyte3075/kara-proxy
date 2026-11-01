export interface HistoryEntry {
  url: string;
  displayUrl: string;
  title: string;
  ts: number;
}

export interface Shortcut {
  id: string;
  title: string;
  url: string;
}

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  ts: number;
}

export interface SearchEngine {
  id: string;
  name: string;
  searchUrl: string;
  host: string;
  custom?: boolean;
}

export const SEARCH_ENGINES: SearchEngine[] = [
  { id: "duckduckgo", name: "DuckDuckGo", searchUrl: "https://duckduckgo.com/?q=%s", host: "duckduckgo.com" },
  { id: "google", name: "Google", searchUrl: "https://www.google.com/search?q=%s", host: "google.com" },
  { id: "bing", name: "Bing", searchUrl: "https://www.bing.com/search?q=%s", host: "bing.com" },
  { id: "brave", name: "Brave Search", searchUrl: "https://search.brave.com/search?q=%s", host: "search.brave.com" },
  { id: "startpage", name: "Startpage", searchUrl: "https://www.startpage.com/sp/search?query=%s", host: "startpage.com" },
  { id: "mojeek", name: "Mojeek", searchUrl: "https://www.mojeek.com/search?q=%s", host: "mojeek.com" },
  { id: "ecosia", name: "Ecosia", searchUrl: "https://www.ecosia.org/search?q=%s", host: "ecosia.org" },
];

export type ThemeColor = "red" | "blue" | "green" | "amber" | "violet";
export type ThemeMode = "dark" | "light";

export interface CustomPalette {
  id: string;
  name: string;
  accent: string;
  accentBright: string;
  accentHover: string;
  gradFrom: string;
  gradTo: string;
}

export interface Settings {
  relay: string;
  searchEngineId: string;
  themeColor: ThemeColor;
  themeMode: ThemeMode;
  /** ID of a custom palette, or null */
  customPaletteId: string | null;
  blockTrackers: boolean;
}

export const DEFAULT_RELAY = "https://kara.lyte3075.workers.dev";
export const DEFAULT_SEARCH_ENGINE_ID = "duckduckgo";
export const DEFAULT_THEME_COLOR: ThemeColor = "red";
export const DEFAULT_THEME_MODE: ThemeMode = "dark";
export const DEFAULT_BLOCK_TRACKERS = false;

export const THEME_COLORS: { id: ThemeColor; name: string }[] = [
  { id: "red", name: "Crimson" },
  { id: "blue", name: "Azure" },
  { id: "green", name: "Emerald" },
  { id: "amber", name: "Amber" },
  { id: "violet", name: "Violet" },
];

export const TRACKER_DOMAINS = [
  "doubleclick.net", "googlesyndication.com", "google-analytics.com", "googletagmanager.com",
  "facebook.net", "connect.facebook.net", "adservice.google.com",
  "amazon-adsystem.com", "criteo.com", "criteo.net", "adsrvr.org", "adnxs.com",
  "2mdn.net", "rubiconproject.com", "pubmatic.com", "openx.net", "moatads.com",
  "scorecardresearch.com", "quantserve.com", "bidswitch.net",
  "taboola.com", "outbrain.com", "clarity.ms", "hotjar.com",
  "segment.io", "segment.com", "mixpanel.com", "amplitude.com", "fullstory.com",
  "sentry.io", "bugsnag.com", "newrelic.com", "nr-data.net",
];

/* ---------- Tabs ---------- */

export interface BrowserTab {
  id: string;
  title: string;
  url: string | null;
  iframeUrl: string | null;
  history: string[];
  navIdx: number;
  loading: boolean;
  error: string | null;
  /** When non-null, the tab is rendering a YouTube embed instead of a proxied iframe */
  youtube: import("./utils").YouTubeTarget | null;
}

/* ---------- Vault ---------- */

export interface VaultEntry {
  id: string;
  title: string;
  url: string;
  username: string;
  password: string;
  ts: number;
}

export interface EncryptedVault {
  salt: string;
  iv: string;
  data: string;
}

export interface BackupFile {
  version: number;
  exportedAt: number;
  history: HistoryEntry[];
  bookmarks: Bookmark[];
}

/* ---------- Stats ---------- */

export interface ProxyStats {
  bytesDownloaded: number;
  requestsMade: number;
  blockedRequests: number;
  sessionStart: number;
  speedSamples: number[];
  recentBlocks: number[];
  /** Domains the user has manually blocked */
  customBlocklist: string[];
  /** Domains the user has manually allowed (removed from default blocklist) */
  allowedDomains: string[];
}

export interface SpeedTestResult {
  downloadSpeed: number;
  uploadSpeed: number;
  latency: number;
  timestamp: number;
}

export const STORAGE_KEYS = {
  history: "kara.history",
  settings: "kara.settings",
  shortcuts: "kara.shortcuts",
  bookmarks: "kara.bookmarks",
  vault: "kara.vault",
  stats: "kara.stats",
  customEngines: "kara.customEngines",
  customPalettes: "kara.customPalettes",
  speedTests: "kara.speedTests",
} as const;
