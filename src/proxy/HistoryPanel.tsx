import { Clock, X, Trash2, ExternalLink } from "lucide-react";
import type { HistoryEntry } from "@/proxy/types";
import { timeAgo } from "@/proxy/utils";

interface HistoryPanelProps {
  open: boolean;
  history: HistoryEntry[];
  onOpen: (entry: HistoryEntry) => void;
  onRemove: (idx: number) => void;
  onClear: () => void;
  onClose: () => void;
}

export default function HistoryPanel({ open, history, onOpen, onRemove, onClear, onClose }: HistoryPanelProps) {
  if (!open) return null;
  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ background: "var(--bg-base)" }}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Clock size={16} className="text-[var(--accent)]" /> History
        </h2>
        <div className="flex items-center gap-1">
          {history.length > 0 && (
            <button onClick={onClear} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] transition" aria-label="Clear all history">
              <Trash2 size={16} />
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition" aria-label="Close">
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <div className="flex items-center justify-center h-full p-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">No history yet. Visit a page to see it here.</p>
          </div>
        ) : (
          <ul className="py-2">
            {history.map((entry, idx) => (
              <li key={`${entry.ts}-${idx}`}>
                <div
                  className="group flex items-center gap-3 px-4 py-2.5 transition cursor-pointer"
                  onClick={() => onOpen(entry)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--btn-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)] truncate leading-tight">{entry.title || entry.displayUrl}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate mt-0.5 flex items-center gap-1">
                      <ExternalLink size={10} className="shrink-0" />{entry.displayUrl}
                    </p>
                  </div>
                  <span className="text-xs text-[var(--text-faint)] shrink-0">{timeAgo(entry.ts)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemove(idx); }}
                    className="p-1 rounded text-[var(--text-faint)] hover:text-[var(--accent)] opacity-0 group-hover:opacity-100 transition shrink-0"
                    aria-label="Remove"
                  >
                    <X size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
