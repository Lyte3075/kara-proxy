import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, Settings as SettingsIcon, HelpCircle, KeyRound, BarChart3 } from "lucide-react";
import AddressBar from "@/proxy/AddressBar";
import ProxyView from "@/proxy/ProxyView";
import HistoryPanel from "@/proxy/HistoryPanel";
import StartPage from "@/proxy/StartPage";
import SettingsPage from "@/proxy/SettingsPage";
import { DeployHelpModal } from "@/proxy/SettingsModal";
import TabBar from "@/proxy/TabBar";
import VaultPanel from "@/proxy/VaultPanel";
import StatsDashboard from "@/proxy/StatsDashboard";
import type {
  HistoryEntry, Settings, Shortcut, Bookmark, BrowserTab, VaultEntry,
  EncryptedVault, BackupFile, SearchEngine, ProxyStats, CustomPalette, SpeedTestResult,
} from "@/proxy/types";
import {
  buildProxiedUrl, buildSearchUrl, createTab, getSearchEngine,
  loadBookmarks, loadCustomEngines, loadEncryptedVault, loadHistory, loadSettings,
  loadShortcuts, loadStats, loadCustomPalettes, loadSpeedTests,
  normalizeInput, recordBlocked, recordRequest,
  saveBookmarks, saveCustomEngines, saveEncryptedVault, saveHistory, saveSettings,
  saveShortcuts, saveStats, saveCustomPalettes, saveSpeedTest,
  applyCustomPalette, uid,
} from "@/proxy/utils";

function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(() => loadShortcuts());
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => loadBookmarks());
  const [encryptedVault, setEncryptedVault] = useState<EncryptedVault | null>(() => loadEncryptedVault());
  const [vaultEntries, setVaultEntries] = useState<VaultEntry[] | null>(null);
  const [customEngines, setCustomEngines] = useState<SearchEngine[]>(() => loadCustomEngines());
  const [customPalettes, setCustomPalettes] = useState<CustomPalette[]>(() => loadCustomPalettes());
  const [stats, setStats] = useState<ProxyStats>(() => loadStats());
  const [speedTests, setSpeedTests] = useState<SpeedTestResult[]>(() => loadSpeedTests());
  const [tabs, setTabs] = useState<BrowserTab[]>(() => [createTab()]);
  const [activeTabId, setActiveTabId] = useState(() => tabs[0].id);
  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [autofillPayload, setAutofillPayload] = useState<{ username: string; password: string; nonce: number } | null>(null);

  const searchEngine = useMemo(() => getSearchEngine(settings.searchEngineId, customEngines), [settings.searchEngineId, customEngines]);
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  // Apply theme to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme-color", settings.themeColor);
    root.setAttribute("data-theme-mode", settings.themeMode);
    if (settings.customPaletteId) {
      const palette = customPalettes.find((p) => p.id === settings.customPaletteId);
      applyCustomPalette(palette ?? null);
    } else {
      applyCustomPalette(null);
    }
  }, [settings.themeColor, settings.themeMode, settings.customPaletteId, customPalettes]);

  useEffect(() => saveHistory(history), [history]);
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => saveShortcuts(shortcuts), [shortcuts]);
  useEffect(() => saveBookmarks(bookmarks), [bookmarks]);
  useEffect(() => saveEncryptedVault(encryptedVault), [encryptedVault]);
  useEffect(() => saveCustomEngines(customEngines), [customEngines]);
  useEffect(() => saveStats(stats), [stats]);
  useEffect(() => saveCustomPalettes(customPalettes), [customPalettes]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data) return;
      if (e.data.type === "kara-stats" && typeof e.data.bytes === "number") setStats((prev) => recordRequest(prev, e.data.bytes));
      else if (e.data.type === "kara-blocked") setStats((prev) => recordBlocked(prev));
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  /* ---------- tab helpers ---------- */
  const updateTab = useCallback((id: string, patch: Partial<BrowserTab>) => setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))), []);
  const updateActiveTab = useCallback((patch: Partial<BrowserTab>) => updateTab(activeTabId, patch), [activeTabId, updateTab]);
  const newTab = useCallback(() => { const t = createTab(); setTabs((p) => [...p, t]); setActiveTabId(t.id); setInput(""); setHistoryOpen(false); setStatsOpen(false); }, []);
  const closeTab = useCallback((id: string) => { setTabs((prev) => { if (prev.length === 1) return prev; const idx = prev.findIndex((t) => t.id === id); const f = prev.filter((t) => t.id !== id); if (id === activeTabId) setActiveTabId(f[Math.max(0, idx - 1)].id); return f; }); }, [activeTabId]);
  const selectTab = useCallback((id: string) => { setActiveTabId(id); setHistoryOpen(false); setStatsOpen(false); }, []);

  /* ---------- navigation ---------- */
  const navigateTo = useCallback((rawTarget: string, tabId: string = activeTabId) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const normalized = normalizeInput(rawTarget);
    const finalTarget = normalized ?? buildSearchUrl(searchEngine, rawTarget.trim());
    let url: string;
    try { const dest = new URL(finalTarget); url = dest.origin === window.location.origin ? finalTarget : buildProxiedUrl(settings.relay, finalTarget, settings.blockTrackers); } catch { url = buildProxiedUrl(settings.relay, finalTarget, settings.blockTrackers); }
    const newHistory = tab.navIdx < tab.history.length - 1 ? tab.history.slice(0, tab.navIdx + 1) : [...tab.history];
    newHistory.push(finalTarget);
    updateTab(tabId, { url: finalTarget, iframeUrl: url, loading: true, error: null, history: newHistory, navIdx: newHistory.length - 1 });
    if (tabId === activeTabId) setInput(finalTarget);
    setStatsOpen(false); setHistoryOpen(false);
    setHistory((prev) => { const entry: HistoryEntry = { url: finalTarget, displayUrl: finalTarget.replace(/^https?:\/\//, ""), title: finalTarget.replace(/^https?:\/\//, ""), ts: Date.now() }; return [entry, ...prev.filter((h) => h.url !== finalTarget)].slice(0, 100); });
  }, [tabs, activeTabId, settings.relay, settings.blockTrackers, searchEngine, updateTab]);

  const goBack = useCallback(() => { if (activeTab.navIdx <= 0) return; const i = activeTab.navIdx - 1; const t = activeTab.history[i]; updateActiveTab({ navIdx: i, url: t, iframeUrl: buildProxiedUrl(settings.relay, t, settings.blockTrackers), loading: true, error: null }); setInput(t); }, [activeTab, settings.relay, settings.blockTrackers, updateActiveTab]);
  const goForward = useCallback(() => { if (activeTab.navIdx >= activeTab.history.length - 1) return; const i = activeTab.navIdx + 1; const t = activeTab.history[i]; updateActiveTab({ navIdx: i, url: t, iframeUrl: buildProxiedUrl(settings.relay, t, settings.blockTrackers), loading: true, error: null }); setInput(t); }, [activeTab, settings.relay, settings.blockTrackers, updateActiveTab]);
  const reload = useCallback(() => { if (activeTab.iframeUrl) { updateActiveTab({ loading: true }); const c = activeTab.iframeUrl; updateActiveTab({ iframeUrl: null }); requestAnimationFrame(() => updateActiveTab({ iframeUrl: c })); } }, [activeTab, updateActiveTab]);
  const handleLoad = useCallback(() => updateActiveTab({ loading: false }), [updateActiveTab]);
  const handleHome = useCallback(() => { updateActiveTab({ url: null, iframeUrl: null, loading: false, error: null }); setInput(""); setHistoryOpen(false); setStatsOpen(false); }, [updateActiveTab]);
  useEffect(() => { setInput(activeTab.url ?? ""); }, [activeTabId]); // eslint-disable-line

  /* ---------- settings & data ---------- */
  const handleSaveSettings = useCallback((s: Settings) => setSettings(s), []);
  const addShortcut = useCallback((title: string, url: string) => setShortcuts((p) => [...p, { id: uid(), title, url }]), []);
  const removeShortcut = useCallback((id: string) => setShortcuts((p) => p.filter((s) => s.id !== id)), []);
  const addBookmark = useCallback((title: string, url: string) => setBookmarks((p) => [{ id: uid(), title, url, ts: Date.now() }, ...p]), []);
  const removeBookmark = useCallback((id: string) => setBookmarks((p) => p.filter((b) => b.id !== id)), []);
  const openHistoryEntry = useCallback((e: HistoryEntry) => { setHistoryOpen(false); navigateTo(e.url); }, [navigateTo]);
  const removeHistoryEntry = useCallback((idx: number) => setHistory((p) => p.filter((_, i) => i !== idx)), []);
  const clearHistory = useCallback(() => setHistory([]), []);
  const clearBookmarks = useCallback(() => setBookmarks([]), []);
  const importBackup = useCallback((file: BackupFile) => { if (file.history.length > 0) setHistory(file.history); if (file.bookmarks.length > 0) setBookmarks(file.bookmarks); }, []);

  const addCustomEngine = useCallback((name: string, url: string) => {
    const id = `custom-${uid()}`;
    let host = "custom";
    try { host = new URL(url.replace("%s", "test")).hostname.replace(/^www\./, ""); } catch {}
    setCustomEngines((p) => [...p, { id, name, searchUrl: url, host, custom: true }]);
  }, []);
  const removeCustomEngine = useCallback((id: string) => setCustomEngines((p) => p.filter((e) => e.id !== id)), []);

  /* ---------- custom palettes ---------- */
  const addPalette = useCallback((name: string, accent: string, accentBright: string, accentHover: string, gradFrom: string, gradTo: string) => {
    const id = `palette-${uid()}`;
    setCustomPalettes((p) => [...p, { id, name, accent, accentBright, accentHover, gradFrom, gradTo }]);
  }, []);
  const removePalette = useCallback((id: string) => { setCustomPalettes((p) => p.filter((x) => x.id !== id)); setSettings((s) => s.customPaletteId === id ? { ...s, customPaletteId: null } : s); }, []);
  const selectPalette = useCallback((id: string | null) => setSettings((s) => ({ ...s, customPaletteId: id })), []);

  /* ---------- blocklist management ---------- */
  const addBlockedDomain = useCallback((domain: string) => setStats((s) => s.customBlocklist.includes(domain) ? s : { ...s, customBlocklist: [...s.customBlocklist, domain] }), []);
  const removeBlockedDomain = useCallback((domain: string) => setStats((s) => ({ ...s, customBlocklist: s.customBlocklist.filter((d) => d !== domain) })), []);
  const allowDomain = useCallback((domain: string) => setStats((s) => s.allowedDomains.includes(domain) ? s : { ...s, allowedDomains: [...s.allowedDomains, domain] }), []);
  const removeAllowed = useCallback((domain: string) => setStats((s) => ({ ...s, allowedDomains: s.allowedDomains.filter((d) => d !== domain) })), []);

  /* ---------- speed test ---------- */
  const handleSpeedTest = useCallback((result: SpeedTestResult) => { setSpeedTests(saveSpeedTest(result)); }, []);

  const resetAll = useCallback(() => {
    setHistory([]); setBookmarks([]); setShortcuts([]); setEncryptedVault(null); setVaultEntries(null);
    setCustomEngines([]); setCustomPalettes([]);
    setStats({ bytesDownloaded: 0, requestsMade: 0, blockedRequests: 0, sessionStart: Date.now(), speedSamples: [], recentBlocks: [], customBlocklist: [], allowedDomains: [] });
    setSpeedTests([]);
    localStorage.clear();
    window.location.reload();
  }, []);

  /* ---------- vault ---------- */
  const handleVaultChange = useCallback((v: EncryptedVault | null) => setEncryptedVault(v), []);
  const handleEntriesChange = useCallback((e: VaultEntry[] | null) => setVaultEntries(e), []);
  const handleAutofill = useCallback((e: VaultEntry) => { setAutofillPayload({ username: e.username, password: e.password, nonce: Date.now() }); setVaultOpen(false); }, []);

  /* ---------- derived ---------- */
  const proxied = activeTab.iframeUrl ? activeTab.iframeUrl.includes("/proxy?") : false;
  const canGoBack = activeTab.navIdx > 0;
  const canGoForward = activeTab.navIdx < activeTab.history.length - 1;
  const showStartPage = !activeTab.iframeUrl && !activeTab.error && !statsOpen;

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)] overflow-hidden">
      <header className="flex items-center gap-2 px-3 py-2.5 border-b shrink-0" style={{ borderColor: "var(--border-primary)", background: "var(--bg-base)" }}>
        <button onClick={handleHome} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--btn-hover)] transition shrink-0" aria-label="Home">
          <span className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center shadow-lg" style={{ background: "var(--accent-grad-from)", boxShadow: "0 4px 12px var(--accent-shadow)" }}>
            <img src="/Kara.png" alt="Kara" className="w-full h-full object-cover" />
          </span>
          <span className="text-sm font-bold tracking-tight hidden sm:block">Kara</span>
        </button>
        <AddressBar value={input} loading={activeTab.loading} canGoBack={canGoBack} canGoForward={canGoForward} onChange={setInput} onSubmit={(v) => navigateTo(v)} onBack={goBack} onForward={goForward} onReload={reload} proxied={proxied} searchEngine={searchEngine} />
        <div className="flex items-center gap-0.5 shrink-0">
          <IconButton label="Stats" onClick={() => { setStatsOpen((o) => !o); setHistoryOpen(false); }}>
            <BarChart3 size={18} className={statsOpen ? "text-[var(--accent)]" : ""} />
          </IconButton>
          <IconButton label="Vault" onClick={() => setVaultOpen(true)}>
            <KeyRound size={18} className={vaultOpen ? "text-[var(--accent)]" : ""} />
          </IconButton>
          <IconButton label="History" onClick={() => { setHistoryOpen((o) => !o); setStatsOpen(false); }}>
            <Clock size={18} className={historyOpen ? "text-[var(--accent)]" : ""} />
          </IconButton>
          <IconButton label="Deploy guide" onClick={() => setHelpOpen(true)}>
            <HelpCircle size={18} />
          </IconButton>
          <IconButton label="Settings" onClick={() => setSettingsOpen(true)}>
            <SettingsIcon size={18} />
          </IconButton>
        </div>
      </header>

      <TabBar tabs={tabs} activeTabId={activeTabId} onSelect={selectTab} onClose={closeTab} onNew={newTab} />

      {showStartPage && !historyOpen ? (
        <StartPage shortcuts={shortcuts} bookmarks={bookmarks} onLaunch={(u) => navigateTo(u)} onAddShortcut={addShortcut} onRemoveShortcut={removeShortcut} onAddBookmark={addBookmark} onRemoveBookmark={removeBookmark} onShowHelp={() => setHelpOpen(true)} />
      ) : statsOpen ? (
        <StatsDashboard stats={stats} history={history} relay={settings.relay} speedTests={speedTests} onSpeedTest={handleSpeedTest} onAddBlockedDomain={addBlockedDomain} onRemoveBlockedDomain={removeBlockedDomain} onAllowDomain={allowDomain} onRemoveAllowed={removeAllowed} onClose={() => setStatsOpen(false)} />
      ) : historyOpen ? (
        <HistoryPanel open={historyOpen} history={history} onOpen={openHistoryEntry} onRemove={removeHistoryEntry} onClear={clearHistory} onClose={() => setHistoryOpen(false)} />
      ) : (
        <ProxyView iframeUrl={activeTab.iframeUrl} loading={activeTab.loading} error={activeTab.error} onLoad={handleLoad} onHome={handleHome} autofillPayload={autofillPayload} />
      )}

      <SettingsPage
        open={settingsOpen} settings={settings} history={history} bookmarks={bookmarks} vault={encryptedVault} customEngines={customEngines} stats={stats}
        customPalettes={customPalettes} onAddPalette={addPalette} onRemovePalette={removePalette} onSelectPalette={selectPalette}
        onClose={() => setSettingsOpen(false)} onSave={handleSaveSettings} onClearHistory={clearHistory} onClearBookmarks={clearBookmarks} onResetAll={resetAll} onImportBackup={importBackup}
        onOpenVault={() => { setSettingsOpen(false); setVaultOpen(true); }} onAddEngine={addCustomEngine} onRemoveEngine={removeCustomEngine} onOpenStats={() => { setSettingsOpen(false); setStatsOpen(true); }}
      />

      <VaultPanel open={vaultOpen} encryptedVault={encryptedVault} onClose={() => setVaultOpen(false)} onVaultChange={handleVaultChange} entries={vaultEntries} onEntriesChange={handleEntriesChange} onAutofill={handleAutofill} />
      <DeployHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      <footer className="flex items-center justify-between px-4 py-1.5 border-t text-[11px] text-[var(--text-muted)] shrink-0" style={{ borderColor: "var(--border-primary)", background: "var(--bg-base)" }}>
        <span className="flex items-center gap-1.5">
          {proxied ? (<><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 6px rgba(52,211,153,0.5)" }} /> Relayed</>)
          : activeTab.iframeUrl ? (<><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Direct</>)
          : (<><span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} /> Idle</>)}
        </span>
        <span className="hidden sm:flex items-center gap-3">
          <span>{tabs.length} {tabs.length === 1 ? "tab" : "tabs"}</span>
          <span className="opacity-40">·</span>
          {vaultEntries && <><span className="text-[var(--accent-bright)] opacity-60">Vault unlocked</span><span className="opacity-40">·</span></>}
          <span className="text-[var(--accent-bright)] opacity-60">Search: {searchEngine.name}</span>
          <span className="opacity-40">·</span>
          <span className="truncate max-w-[24vw]">Relay: {settings.relay.includes("demo") ? "demo" : "yours"}</span>
        </span>
      </footer>
    </div>
  );
}

function IconButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return <button onClick={onClick} aria-label={label} className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--btn-hover)] transition">{children}</button>;
}

export default App;
