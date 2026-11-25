import { useCallback, useEffect, useMemo, useState } from "react";
import type { RefObject } from "react";
import {
  Braces, Bug, ChevronDown, ChevronRight, Copy, FileCode2, Gauge,
  Layers, Monitor, Network, Smartphone, Tablet, Terminal, X,
} from "lucide-react";

type InspectorTab = "elements" | "console" | "network" | "sources" | "styles" | "device";
type ConsoleEntry = { id: number; level: string; text: string; time: string };
type ResourceEntry = { name: string; initiatorType: string; duration: number; size: number; startTime: number };
type SourceEntry = { name: string; url: string; kind: string; inline?: string };

interface SiteInspectorProps {
  iframeRef: RefObject<HTMLIFrameElement>;
  open: boolean;
  onClose: () => void;
}

const tabs: { id: InspectorTab; label: string; icon: typeof Braces }[] = [
  { id: "elements", label: "Elements", icon: Braces },
  { id: "console", label: "Console", icon: Terminal },
  { id: "network", label: "Network", icon: Network },
  { id: "sources", label: "Sources", icon: FileCode2 },
  { id: "styles", label: "Styles", icon: Layers },
  { id: "device", label: "Device", icon: Smartphone },
];

const deviceSizes = [
  { name: "Responsive", width: 0, height: 0, icon: Monitor },
  { name: "iPhone SE", width: 375, height: 667, icon: Smartphone },
  { name: "iPhone 17 Pro Max", width: 440, height: 956, icon: Smartphone },
  { name: "iPad", width: 820, height: 1180, icon: Tablet },
  { name: "Desktop HD", width: 1280, height: 720, icon: Monitor },
];

function describeNode(node: Element) {
  const id = node.id ? "#" + node.id : "";
  const classes = typeof node.className === "string"
    ? node.className.trim().split(/\\s+/).filter(Boolean).slice(0, 2).map((name) => "." + name).join("")
    : "";
  return "<" + node.tagName.toLowerCase() + id + classes + ">";
}

function safeText(value: unknown) {
  if (typeof value === "string") return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

export default function SiteInspector({ iframeRef, open, onClose }: SiteInspectorProps) {
  const [active, setActive] = useState<InspectorTab>("elements");
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<Element | null>(null);
  const [expanded, setExpanded] = useState<Set<Element>>(new Set());
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [command, setCommand] = useState("");
  const [resources, setResources] = useState<ResourceEntry[]>([]);
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const [sourceText, setSourceText] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [sourceError, setSourceError] = useState("");
  const [filter, setFilter] = useState("");
  const [device, setDevice] = useState("Responsive");
  const [styleProperty, setStyleProperty] = useState("color");
  const [styleValue, setStyleValue] = useState("");
  const [hovered, setHovered] = useState<Element | null>(null);

  const doc = iframeRef.current?.contentDocument ?? null;
  const win = (iframeRef.current?.contentWindow as (Window & typeof globalThis) | null) ?? null;

  const refresh = useCallback(() => {
    const frame = iframeRef.current;
    if (!frame) return;
    try {
      const document = frame.contentDocument;
      if (!document) return;
      setRevision((value) => value + 1);
      const pageEntries = Array.from(frame.contentWindow?.performance.getEntriesByType("resource") ?? []);
      setResources(
        pageEntries
          .map((entry) => entry as PerformanceResourceTiming)
          .filter((entry) => Boolean(entry.name))
          .slice(-250)
          .reverse()
          .map((entry) => ({
            name: entry.name,
            initiatorType: entry.initiatorType || "other",
            duration: entry.duration,
            size: entry.transferSize || entry.encodedBodySize || 0,
            startTime: entry.startTime,
          }))
      );
      const items: SourceEntry[] = [];
      document.querySelectorAll("script").forEach((node, index) => {
        items.push({ name: node.src ? node.src.split("/").pop() || node.src : "Inline script " + (index + 1), url: node.src, kind: "JavaScript", inline: node.src ? undefined : node.textContent || "" });
      });
      document.querySelectorAll('link[rel="stylesheet"], style').forEach((node, index) => {
        const link = node as HTMLLinkElement;
        items.push({ name: link.href ? link.href.split("/").pop() || link.href : "Inline style " + (index + 1), url: link.href || "", kind: "CSS", inline: link.href ? undefined : node.textContent || "" });
      });
      setSources(items);
    } catch (error) {
      setSourceError(error instanceof Error ? error.message : "The page is not currently inspectable.");
    }
  }, [iframeRef]);

  useEffect(() => {
    if (!open) return;
    const frame = iframeRef.current;
    if (!frame) return;
    const onLoad = () => {
      setSelected(null);
      setExpanded(new Set());
      setConsoleEntries([]);
      setSourceText("");
      refresh();
    };
    frame.addEventListener("load", onLoad);
    onLoad();
    const timer = window.setInterval(refresh, 1800);
    return () => {
      frame.removeEventListener("load", onLoad);
      window.clearInterval(timer);
    };
  }, [open, iframeRef, refresh]);

  useEffect(() => {
    if (!open || !iframeRef.current) return;
    let restore = () => {};
    const install = () => {
      restore();
      let pageWindow: Window & typeof globalThis;
      try {
        const currentWindow = iframeRef.current?.contentWindow;
        if (!currentWindow) return;
        pageWindow = currentWindow as Window & typeof globalThis;
        void pageWindow.document.documentElement;
      } catch { return; }
      const pageConsole = pageWindow.console;
      const originals: Record<string, (...args: unknown[]) => void> = {};
      const add = (level: string, args: unknown[]) => {
        setConsoleEntries((prev) => [...prev.slice(-299), {
          id: Date.now() + Math.random(),
          level,
          text: args.map(safeText).join(" "),
          time: new Date().toLocaleTimeString(),
        }]);
      };
      (["log", "info", "warn", "error", "debug"] as const).forEach((level) => {
        originals[level] = pageConsole[level].bind(pageConsole) as (...args: unknown[]) => void;
        pageConsole[level] = (...args: unknown[]) => {
          originals[level](...args);
          add(level, args);
        };
      });
      const onError = (event: ErrorEvent) => add("error", [event.message + (event.filename ? " (" + event.filename + ":" + event.lineno + ")" : "")]);
      const onReject = (event: PromiseRejectionEvent) => add("error", ["Unhandled promise rejection:", event.reason]);
      pageWindow.addEventListener("error", onError);
      pageWindow.addEventListener("unhandledrejection", onReject);
      restore = () => {
        (["log", "info", "warn", "error", "debug"] as const).forEach((level) => {
          pageConsole[level] = originals[level] as Console[typeof level];
        });
        pageWindow.removeEventListener("error", onError);
        pageWindow.removeEventListener("unhandledrejection", onReject);
      };
    };
    const frame = iframeRef.current;
    frame.addEventListener("load", install);
    install();
    return () => {
      frame.removeEventListener("load", install);
      restore();
    };
  }, [open, iframeRef]);

  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame) return;
    if (!open) {
      frame.style.width = "100%";
      frame.style.height = "100%";
      frame.style.maxWidth = "100%";
      frame.style.margin = "0";
      return;
    }
    const preset = deviceSizes.find((item) => item.name === device);
    if (!preset || preset.width === 0) {
      frame.style.width = "100%";
      frame.style.height = "100%";
      frame.style.maxWidth = "100%";
      frame.style.margin = "0";
    } else {
      frame.style.width = preset.width + "px";
      frame.style.height = preset.height + "px";
      frame.style.maxWidth = "100%";
      frame.style.margin = "0 auto";
    }
    return () => {
      frame.style.width = "100%";
      frame.style.height = "100%";
      frame.style.maxWidth = "100%";
      frame.style.margin = "0";
    };
  }, [device, iframeRef, open]);

  const allElements = useMemo(() => {
    if (!doc) return [];
    try { return Array.from(doc.querySelectorAll("body *")).slice(0, 1500); } catch { return []; }
  }, [doc, revision]);

  const visibleResources = resources.filter((item) => !filter || item.name.toLowerCase().includes(filter.toLowerCase()) || item.initiatorType.toLowerCase().includes(filter.toLowerCase()));
  const selectedStyle = useMemo(() => {
    if (!selected || !win) return null;
    try { return win.getComputedStyle(selected); } catch { return null; }
  }, [selected, win, revision]);

  const runCommand = () => {
    if (!command.trim() || !win) return;
    const input = command;
    setCommand("");
    try {
      const result = win.eval(input);
      setConsoleEntries((prev) => [...prev.slice(-299), { id: Date.now(), level: "result", text: safeText(result), time: new Date().toLocaleTimeString() }]);
    } catch (error) {
      setConsoleEntries((prev) => [...prev.slice(-299), { id: Date.now(), level: "error", text: error instanceof Error ? error.stack || error.message : String(error), time: new Date().toLocaleTimeString() }]);
    }
    setActive("console");
  };

  const inspectSource = async (source: SourceEntry) => {
    setSourceLabel(source.name);
    setSourceError("");
    setSourceText(source.inline ?? "Loading source…");
    if (source.inline !== undefined) return;
    try {
      const response = await fetch(source.url);
      if (!response.ok) throw new Error("HTTP " + response.status);
      setSourceText(await response.text());
    } catch (error) {
      setSourceError(error instanceof Error ? error.message : "Could not read this source.");
      setSourceText("");
    }
  };

  const applyStyle = () => {
    if (!selected || !styleProperty.trim()) return;
    (selected as HTMLElement).style.setProperty(styleProperty.trim(), styleValue);
    setRevision((value) => value + 1);
  };

  const copyText = async (value: string) => {
    try { await navigator.clipboard.writeText(value); } catch {}
  };

  if (!open) return null;

  const renderTree = (node: Element, depth = 0): React.ReactNode => {
    const children = Array.from(node.children);
    const isExpanded = expanded.has(node) || depth < 1;
    return (
      <div key={depth + "-" + describeNode(node) + "-" + Array.from(node.parentElement?.children ?? []).indexOf(node)}>
        <div
          className="flex items-center gap-1 min-w-0 py-0.5 rounded px-1 text-[11px] font-mono cursor-pointer"
          style={{ paddingLeft: 5 + depth * 13, background: selected === node ? "rgba(59,130,246,.22)" : hovered === node ? "rgba(148,163,184,.12)" : "transparent" }}
          onMouseEnter={() => setHovered(node)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => { setSelected(node); setActive("styles"); }}
        >
          {children.length ? (
            <button className="shrink-0 text-slate-500" onClick={(event) => { event.stopPropagation(); setExpanded((prev) => { const next = new Set(prev); if (next.has(node)) next.delete(node); else next.add(node); return next; }); }}>
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          ) : <span className="w-3 shrink-0" />}
          <span className="text-sky-400">{ "<" + node.tagName.toLowerCase() }</span>
          {node.id && <span className="text-amber-300"> id="{node.id}"</span>}
          {typeof node.className === "string" && node.className.trim() && <span className="text-emerald-300 truncate"> class="{node.className.trim().slice(0, 65)}"</span>}
          <span className="text-sky-400">{">"}</span>
        </div>
        {isExpanded && children.slice(0, 250).map((child) => renderTree(child, depth + 1))}
      </div>
    );
  };

  return (
    <section className="absolute inset-x-0 bottom-0 z-30 flex flex-col border-t shadow-2xl" style={{ height: "min(54vh, 560px)", minHeight: 260, background: "#111318", borderColor: "#343944", color: "#e5e7eb" }} aria-label="Kara Inspector">
      <div className="flex items-center justify-between px-3 h-10 shrink-0 border-b" style={{ borderColor: "#303540", background: "#191c23" }}>
        <div className="flex items-center gap-2 min-w-0">
          <Bug size={15} className="text-sky-400" />
          <span className="text-xs font-semibold tracking-wide">KARA INSPECTOR</span>
          <span className="text-[10px] text-slate-500 hidden sm:inline">Developer tools</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={refresh} className="px-2 py-1 rounded text-[11px] text-slate-300 hover:bg-white/10">Refresh</button>
          <button onClick={onClose} aria-label="Close inspector" className="p-1.5 rounded hover:bg-white/10"><X size={15} /></button>
        </div>
      </div>
      <div className="flex items-center gap-0.5 px-2 overflow-x-auto shrink-0 border-b" style={{ borderColor: "#303540" }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return <button key={tab.id} onClick={() => setActive(tab.id)} className="flex items-center gap-1.5 px-3 py-2 text-[11px] whitespace-nowrap border-b-2" style={{ color: active === tab.id ? "#7dd3fc" : "#9ca3af", borderColor: active === tab.id ? "#38bdf8" : "transparent" }}><Icon size={13} />{tab.label}</button>;
        })}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {active === "elements" && (
          <div className="grid grid-cols-2 h-full min-h-0">
            <div className="overflow-auto p-2 border-r border-[#303540]">
              {doc?.documentElement ? <>{renderTree(doc.documentElement)}<div className="text-[10px] text-slate-500 px-2 py-2">{allElements.length} elements indexed (limit 1,500)</div></> : <p className="text-xs text-slate-500 p-3">Waiting for a page to load…</p>}
            </div>
            <div className="overflow-auto p-3 text-[11px]">
              <div className="text-slate-400 mb-2 uppercase tracking-wider text-[10px]">Selected element</div>
              {selected ? <>
                <div className="font-mono text-sky-300 break-all mb-3">{describeNode(selected)}</div>
                <div className="space-y-1">{Array.from(selected.attributes).map((attr) => <div key={attr.name} className="break-all"><span className="text-amber-300">{attr.name}</span><span className="text-slate-500"> = </span><span className="text-emerald-300">"{attr.value}"</span></div>)}</div>
                <button onClick={() => copyText(selected.outerHTML)} className="mt-3 flex items-center gap-1 text-sky-300"><Copy size={12} /> Copy HTML</button>
              </> : <p className="text-slate-500">Select an element in the DOM tree to inspect it.</p>}
            </div>
          </div>
        )}
        {active === "console" && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-auto p-2 font-mono text-[11px] space-y-1">
              {consoleEntries.length === 0 && <p className="text-slate-500 p-2">Console is listening. Page logs and JavaScript errors will appear here.</p>}
              {consoleEntries.map((entry) => <div key={entry.id} className="border-b border-white/5 py-1 whitespace-pre-wrap break-words" style={{ color: entry.level === "error" ? "#f87171" : entry.level === "warn" ? "#fbbf24" : entry.level === "result" ? "#86efac" : "#d1d5db" }}><span className="text-slate-600 mr-2">{entry.time}</span>{entry.text}</div>)}
            </div>
            <form className="flex gap-2 p-2 border-t border-[#303540]" onSubmit={(event) => { event.preventDefault(); runCommand(); }}>
              <span className="text-sky-400 font-mono pt-2">&gt;</span>
              <input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Run JavaScript in the inspected page…" className="flex-1 min-w-0 bg-transparent outline-none text-xs font-mono" />
              <button className="px-3 py-1.5 rounded bg-sky-500/20 text-sky-300 text-xs">Run</button>
            </form>
          </div>
        )}
        {active === "network" && (
          <div className="h-full flex flex-col">
            <div className="flex gap-2 p-2 border-b border-[#303540]">
              <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter requests…" className="flex-1 bg-[#20242d] rounded px-2 py-1.5 text-xs outline-none" />
              <button onClick={() => { iframeRef.current?.contentWindow?.performance.clearResourceTimings(); setResources([]); }} className="text-xs text-slate-400 px-2">Clear</button>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_65px_65px] gap-2 px-3 py-1.5 text-[10px] text-slate-500 border-b border-[#303540]"><span>Name</span><span>Type</span><span className="text-right">Time</span></div>
            <div className="overflow-auto flex-1">{visibleResources.map((item, index) => <div key={item.name + index} className="grid grid-cols-[minmax(0,1fr)_65px_65px] gap-2 px-3 py-1.5 text-[10px] border-b border-white/5 hover:bg-white/5"><span className="truncate" title={item.name}>{item.name.split("/").pop() || item.name}</span><span className="text-slate-400">{item.initiatorType}</span><span className="text-right text-slate-400">{item.duration.toFixed(0)} ms</span></div>)}
              {visibleResources.length === 0 && <p className="p-3 text-xs text-slate-500">No resource timing entries yet. Some browser-internal and cross-origin requests may not be exposed.</p>}</div>
            <div className="px-3 py-1.5 text-[10px] text-slate-500 border-t border-[#303540]">{visibleResources.length} resources · sizes and HTTP status codes are not exposed by all browsers</div>
          </div>
        )}
        {active === "sources" && (
          <div className="grid grid-cols-[minmax(130px,34%)_1fr] h-full">
            <div className="overflow-auto border-r border-[#303540]">
              <div className="px-3 py-2 text-[10px] uppercase text-slate-500">Page files</div>
              {sources.map((source, index) => <button key={source.kind + source.name + index} onClick={() => void inspectSource(source)} className="block w-full text-left px-3 py-2 text-[11px] hover:bg-white/5 border-t border-white/5"><span className="text-slate-500 mr-2">{source.kind === "CSS" ? "◆" : "JS"}</span><span className="break-all">{source.name}</span></button>)}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#303540] text-[10px] text-slate-400"><span className="truncate">{sourceLabel || "Select a source file"}</span><button disabled={!sourceText} onClick={() => copyText(sourceText)}><Copy size={13} /></button></div>
              {sourceError && <p className="text-xs text-red-400 p-3">{sourceError}</p>}
              <pre className="flex-1 overflow-auto p-3 text-[10px] leading-5 font-mono whitespace-pre-wrap break-all text-slate-300">{sourceText || "Source preview will appear here."}</pre>
            </div>
          </div>
        )}
        {active === "styles" && (
          <div className="h-full overflow-auto p-3 text-xs">
            {!selected ? <p className="text-slate-500">Choose an element in Elements to inspect its computed styles.</p> : <>
              <div className="font-mono text-sky-300 mb-3">{describeNode(selected)}</div>
              <form className="flex flex-wrap gap-2 mb-4" onSubmit={(event) => { event.preventDefault(); applyStyle(); }}>
                <input value={styleProperty} onChange={(event) => setStyleProperty(event.target.value)} placeholder="CSS property" className="min-w-0 flex-1 bg-[#20242d] rounded px-2 py-2 outline-none font-mono" />
                <input value={styleValue} onChange={(event) => setStyleValue(event.target.value)} placeholder="Value" className="min-w-0 flex-1 bg-[#20242d] rounded px-2 py-2 outline-none font-mono" />
                <button className="px-3 py-2 rounded bg-sky-500/20 text-sky-300">Apply</button>
              </form>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Computed styles</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono">{selectedStyle && ["display", "position", "width", "height", "margin", "padding", "color", "backgroundColor", "fontSize", "fontFamily", "fontWeight", "border", "opacity", "overflow", "zIndex"].map((key) => <div key={key} className="contents"><span className="text-sky-300">{key}</span><span className="text-slate-300 break-all">{selectedStyle.getPropertyValue(key.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase()))}</span></div>)}</div>
            </>}
          </div>
        )}
        {active === "device" && (
          <div className="h-full overflow-auto p-4">
            <div className="flex items-center gap-2 mb-3"><Gauge size={16} className="text-sky-400" /><span className="text-sm font-semibold">Viewport emulation</span></div>
            <p className="text-xs text-slate-400 mb-4">Resize the inspected page to preview responsive layouts. This changes the page viewport, not the actual device hardware or user agent.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{deviceSizes.map((item) => { const Icon = item.icon; return <button key={item.name} onClick={() => setDevice(item.name)} className="rounded-lg border p-3 text-left" style={{ borderColor: device === item.name ? "#38bdf8" : "#343944", background: device === item.name ? "rgba(56,189,248,.12)" : "#191c23" }}><Icon size={18} className="mb-2 text-sky-300" /><div className="text-xs font-medium">{item.name}</div><div className="text-[10px] text-slate-500">{item.width ? item.width + " × " + item.height : "Use available space"}</div></button>; })}</div>
            <div className="mt-4 text-[10px] text-slate-500">Selected: {device}. Some sites may use viewport metadata or browser-specific APIs that cannot be fully emulated.</div>
          </div>
        )}
      </div>
    </section>
  );
}
