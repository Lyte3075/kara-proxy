import { Plus, X, Globe, Loader2 } from "lucide-react";
import type { BrowserTab } from "@/proxy/types";
import { hostnameOf } from "@/proxy/utils";

interface TabBarProps {
  tabs: BrowserTab[];
  activeTabId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
}

export default function TabBar({ tabs, activeTabId, onSelect, onClose, onNew }: TabBarProps) {
  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b shrink-0 overflow-x-auto scrollbar-thin" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          className="group flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-lg cursor-pointer transition shrink-0 max-w-[180px] border"
          style={tab.id === activeTabId
            ? { background: "var(--accent-glow)", borderColor: "var(--accent-soft)" }
            : { background: "var(--bg-surface)", borderColor: "transparent" }
          }
        >
          {tab.loading ? (
            <Loader2 size={12} className="text-[var(--accent)] animate-spin shrink-0" />
          ) : tab.url ? (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60 shrink-0" />
          ) : (
            <Globe size={12} className="text-[var(--text-faint)] shrink-0" />
          )}
          <span className="text-xs text-[var(--text-secondary)] truncate flex-1 min-w-0">
            {tab.url ? hostnameOf(tab.url) : "New Tab"}
          </span>
          {tabs.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
              className="p-0.5 rounded text-[var(--text-faint)] hover:text-[var(--accent)] opacity-0 group-hover:opacity-100 transition shrink-0"
              aria-label="Close tab"
            >
              <X size={12} />
            </button>
          )}
        </div>
      ))}
      <button
        onClick={onNew}
        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--btn-hover)] transition shrink-0"
        aria-label="New tab"
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
