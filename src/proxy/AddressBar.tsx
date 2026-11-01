import { useState, useRef, type FormEvent, type KeyboardEvent } from "react";
import { ArrowLeft, ArrowRight, RotateCw, Lock, Search, ShieldCheck, ShieldAlert } from "lucide-react";
import type { SearchEngine } from "@/proxy/types";

interface AddressBarProps {
  value: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  proxied: boolean;
  searchEngine: SearchEngine;
}

export default function AddressBar({ value, loading, canGoBack, canGoForward, onChange, onSubmit, onBack, onForward, onReload, proxied, searchEngine }: AddressBarProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (e: FormEvent) => { e.preventDefault(); onSubmit(value); inputRef.current?.blur(); };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Escape") inputRef.current?.blur(); };

  return (
    <form onSubmit={submit} className="flex items-center gap-1.5 flex-1 min-w-0">
      <div className="flex items-center gap-0.5 mr-1">
        <NavBtn disabled={!canGoBack} onClick={onBack} label="Back"><ArrowLeft size={18} /></NavBtn>
        <NavBtn disabled={!canGoForward} onClick={onForward} label="Forward"><ArrowRight size={18} /></NavBtn>
        <NavBtn onClick={onReload} label="Reload" disabled={loading}><RotateCw size={16} className={loading ? "animate-spin" : ""} /></NavBtn>
      </div>

      <div
        className="flex items-center gap-2 flex-1 min-w-0 rounded-xl border px-3 py-2 transition"
        style={{
          background: "var(--bg-input)",
          borderColor: focused ? "var(--accent)" : "var(--border-subtle)",
          boxShadow: focused ? "0 0 0 1px var(--accent-soft)" : "none",
        }}
      >
        {proxied ? <ShieldCheck size={15} className="text-emerald-400 shrink-0" /> : <Lock size={15} className="text-[var(--text-faint)] shrink-0" />}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          placeholder={`Search ${searchEngine.name} or type a URL`}
          spellCheck={false}
          autoComplete="off"
          className="flex-1 min-w-0 bg-transparent text-sm text-[var(--text-primary)] focus:outline-none"
          style={{ color: "var(--text-primary)" }}
        />
        <style>{`.addressbar-input::placeholder { color: var(--text-faint); }`}</style>
        <button type="submit" className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] transition shrink-0">
          <Search size={16} />
        </button>
      </div>

      {!proxied && (
        <span className="hidden sm:flex items-center gap-1 text-xs text-amber-400/80 shrink-0 ml-1">
          <ShieldAlert size={13} /> direct
        </span>
      )}
    </form>
  );
}

function NavBtn({ children, disabled, onClick, label }: { children: React.ReactNode; disabled?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--btn-hover)] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--text-secondary)] transition"
    >
      {children}
    </button>
  );
}
