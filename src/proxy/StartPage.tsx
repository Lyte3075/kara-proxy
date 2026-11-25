import { useState } from "react";
import { ShieldCheck, Zap, Lock, BookOpen, Plus, X, Star as StarIcon } from "lucide-react";
import type { Shortcut, Bookmark } from "@/proxy/types";
import { initialOf, hostnameOf } from "@/proxy/utils";

interface StartPageProps {
  shortcuts: Shortcut[];
  bookmarks: Bookmark[];
  onLaunch: (url: string) => void;
  onAddShortcut: (title: string, url: string) => void;
  onRemoveShortcut: (id: string) => void;
  onAddBookmark: (title: string, url: string) => void;
  onRemoveBookmark: (id: string) => void;
  onShowHelp: () => void;
}

export default function StartPage({ shortcuts, bookmarks, onLaunch, onAddShortcut, onRemoveShortcut, onAddBookmark, onRemoveBookmark, onShowHelp }: StartPageProps) {
  const [addShortcutOpen, setAddShortcutOpen] = useState(false);
  const [addBookmarkOpen, setAddBookmarkOpen] = useState(false);

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-base)]">
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-12">
        {/* Hero */}
        <div className="text-center mb-14">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl border mb-5"
            style={{ background: "var(--accent-glow)", borderColor: "var(--accent-soft)", boxShadow: "0 0 24px var(--accent-glow)" }}
          >
            <img src="/Kara.png" alt="Kara" className="w-full h-full object-cover rounded-2xl" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight mb-2">Kara</h1>
          <p className="text-[var(--text-muted)] max-w-md mx-auto leading-relaxed">
            A private, relay-backed browser. Type a URL above or pick a shortcut below.
          </p>
        </div>

        {/* Feature row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-12">
          <Feature icon={<ShieldCheck size={16} />} title="Private" desc="Sites see the relay, not you" />
          <Feature icon={<Zap size={16} />} title="Fast" desc="Edge-cached relay" />
          <Feature icon={<Lock size={16} />} title="Yours" desc="Deploy your own relay free" />
        </div>

        {/* Shortcuts */}
        <div className="mb-10">
          <SectionHeader title="Shortcuts" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {shortcuts.map((s) => (
              <ShortcutCard key={s.id} shortcut={s} onLaunch={() => onLaunch(s.url)} onRemove={() => onRemoveShortcut(s.id)} />
            ))}
            <AddCard label="Add shortcut" onClick={() => setAddShortcutOpen(true)} />
          </div>
        </div>

        {/* Bookmarks */}
        <div className="mb-6">
          <SectionHeader
            title="Bookmarks"
            action={
              <button onClick={() => setAddBookmarkOpen(true)} className="inline-flex items-center gap-1 text-xs text-[var(--accent-bright)] hover:opacity-80 transition">
                <Plus size={13} /> Add
              </button>
            }
          />
          {bookmarks.length === 0 ? (
            <div className="rounded-xl border px-4 py-6 text-center" style={{ borderColor: "var(--border-faint)", background: "var(--bg-surface)" }}>
              <StarIcon size={20} className="text-[var(--text-faint)] mx-auto mb-2" />
              <p className="text-xs text-[var(--text-muted)]">No bookmarks yet. Add sites you visit often.</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {bookmarks.map((b) => (
                <li
                  key={b.id}
                  className="group flex items-center gap-3 px-3 py-2.5 rounded-xl border border-transparent hover:border-[var(--border-subtle)] transition cursor-pointer"
                  onClick={() => onLaunch(b.url)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-glow)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <StarIcon size={14} className="text-[var(--accent)] opacity-70 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)] truncate">{b.title}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate font-mono">{hostnameOf(b.url)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveBookmark(b.id); }}
                    className="p-1 rounded text-[var(--text-faint)] hover:text-[var(--accent)] opacity-0 group-hover:opacity-100 transition shrink-0"
                    aria-label="Remove bookmark"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-14 flex items-center justify-center gap-4 text-xs text-[var(--text-faint)]">
          <button onClick={onShowHelp} className="inline-flex items-center gap-1.5 hover:text-[var(--accent-bright)] transition">
            <BookOpen size={13} /> Deploy guide
          </button>
        </div>
      </div>

      {addShortcutOpen && (
        <AddDialog title="Add shortcut" onClose={() => setAddShortcutOpen(false)} onSubmit={(title, url) => { onAddShortcut(title, url); setAddShortcutOpen(false); }} />
      )}
      {addBookmarkOpen && (
        <AddDialog title="Add bookmark" onClose={() => setAddBookmarkOpen(false)} onSubmit={(title, url) => { onAddBookmark(title, url); setAddBookmarkOpen(false); }} />
      )}
    </div>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3 px-1">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-bright)] opacity-70">{title}</h2>
      {action}
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl border p-3.5" style={{ borderColor: "var(--border-faint)", background: "var(--bg-surface)" }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[var(--accent)]">{icon}</span>
        <span className="text-sm font-medium text-[var(--text-primary)]">{title}</span>
      </div>
      <p className="text-xs text-[var(--text-muted)] leading-relaxed">{desc}</p>
    </div>
  );
}

function ShortcutCard({ shortcut, onLaunch, onRemove }: { shortcut: Shortcut; onLaunch: () => void; onRemove: () => void }) {
  return (
    <div
      className="group relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition cursor-pointer hover:bg-[var(--accent-glow)]"
      style={{ borderColor: "var(--border-faint)", background: "var(--bg-surface)" }}
      onClick={onLaunch}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute top-1.5 right-1.5 p-1 rounded-lg text-[var(--text-faint)] hover:text-[var(--accent)] opacity-0 group-hover:opacity-100 transition"
        aria-label="Remove shortcut"
      >
        <X size={13} />
      </button>
      <span
        className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-lg"
        style={{ background: "linear-gradient(135deg, var(--accent-grad-from), var(--accent-grad-to))", boxShadow: "0 4px 12px var(--accent-shadow)" }}
      >
        {initialOf(shortcut.title)}
      </span>
      <span className="text-xs text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition truncate max-w-full">{shortcut.title}</span>
    </div>
  );
}

function AddCard({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl border border-dashed transition min-h-[112px] hover:bg-[var(--accent-glow)]"
      style={{ borderColor: "var(--border-dashed)" }}
    >
      <span className="w-12 h-12 rounded-xl flex items-center justify-center text-[var(--accent)]" style={{ background: "var(--accent-tint)" }}>
        <Plus size={22} />
      </span>
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
    </button>
  );
}

function AddDialog({ title, onClose, onSubmit }: { title: string; onClose: () => void; onSubmit: (title: string, url: string) => void }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const valid = name.trim().length > 0 && url.trim().length > 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-2xl" style={{ borderColor: "var(--border-primary)", background: "var(--bg-elev)" }} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{title}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. GitHub" autoFocus className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">URL</label>
            <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com" spellCheck={false} className="input font-mono" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">Cancel</button>
          <button onClick={() => valid && onSubmit(name.trim(), url.trim())} disabled={!valid} className="btn-primary">Add</button>
        </div>
      </div>
    </div>
  );
}
