import { useState } from "react";
import { X, Lock, Unlock, Plus, Trash2, KeyRound, Eye, EyeOff, Copy, Check, ShieldAlert, Loader2 } from "lucide-react";
import type { VaultEntry, EncryptedVault } from "@/proxy/types";
import { decryptVault, encryptVault } from "@/proxy/vaultCrypto";
import { hostnameOf, uid } from "@/proxy/utils";

interface VaultPanelProps {
  open: boolean;
  encryptedVault: EncryptedVault | null;
  onClose: () => void;
  onVaultChange: (vault: EncryptedVault | null) => void;
  entries: VaultEntry[] | null;
  onEntriesChange: (entries: VaultEntry[] | null) => void;
  onAutofill: (entry: VaultEntry) => void;
}

export default function VaultPanel({ open, encryptedVault, onClose, onVaultChange, entries, onEntriesChange, onAutofill }: VaultPanelProps) {
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<VaultEntry | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!open) return null;
  const hasVault = encryptedVault !== null;
  const unlocked = entries !== null;

  const handleCreate = async () => {
    setError(null);
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirmPw) { setError("Passwords don't match."); return; }
    setBusy(true);
    try {
      const vault = await encryptVault(password, JSON.stringify([]));
      onVaultChange(vault); onEntriesChange([]); setPassword(""); setConfirmPw("");
    } catch { setError("Failed to create vault."); }
    finally { setBusy(false); }
  };

  const handleUnlock = async () => {
    setError(null); setBusy(true);
    try {
      const plain = await decryptVault(password, encryptedVault!);
      onEntriesChange(Array.isArray(JSON.parse(plain)) ? JSON.parse(plain) as VaultEntry[] : []);
      setPassword("");
    } catch { setError("Wrong password."); }
    finally { setBusy(false); }
  };

  const handleLock = () => { onEntriesChange(null); setPassword(""); setError(null); };

  const handleDeleteVault = () => {
    if (!confirm("Delete the vault and all saved logins? This cannot be undone.")) return;
    onVaultChange(null); onEntriesChange(null); setPassword(""); setConfirmPw(""); setError(null);
  };

  const persistEntries = async (updated: VaultEntry[]) => {
    onEntriesChange(updated);
    if (password && encryptedVault) {
      const vault = await encryptVault(password, JSON.stringify(updated));
      onVaultChange(vault);
    }
  };

  const saveEntry = (entry: VaultEntry) => {
    if (!entries) return;
    const exists = entries.some((e) => e.id === entry.id);
    persistEntries(exists ? entries.map((e) => e.id === entry.id ? entry : e) : [...entries, entry]);
    setEditing(null);
  };

  const deleteEntry = (id: string) => { if (entries) persistEntries(entries.filter((e) => e.id !== id)); };

  const copyPassword = (entry: VaultEntry) => {
    navigator.clipboard.writeText(entry.password).catch(() => {});
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 1200);
  };

  /* Create vault */
  if (!hasVault) {
    return (
      <Shell onClose={onClose} title="Vault">
        <div className="p-6 space-y-4">
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: "var(--accent-glow)", border: "1px solid var(--accent-soft)", boxShadow: "0 0 16px var(--accent-glow)" }}>
              <Lock size={26} className="text-[var(--accent)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Create your vault</h3>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed max-w-sm mx-auto">
              Set a master password to encrypt your saved logins. Stored encrypted in your browser only.
            </p>
          </div>
          <div className="space-y-3">
            <Field label="Master password"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoFocus className="input" /></Field>
            <Field label="Confirm password"><input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Re-enter password" className="input" /></Field>
            {error && <ErrorMsg msg={error} />}
          </div>
          <button onClick={handleCreate} disabled={busy || !password || !confirmPw} className="btn-primary w-full">
            {busy ? <Loader2 size={16} className="animate-spin" /> : "Create vault"}
          </button>
          <p className="text-xs text-[var(--text-faint)] text-center leading-relaxed">No recovery option. If you forget the password, logins are gone.</p>
        </div>
      </Shell>
    );
  }

  /* Locked */
  if (!unlocked) {
    return (
      <Shell onClose={onClose} title="Vault">
        <div className="p-6 space-y-4">
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: "var(--accent-glow)", border: "1px solid var(--accent-soft)" }}>
              <Lock size={26} className="text-[var(--accent)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Unlock your vault</h3>
            <p className="text-sm text-[var(--text-muted)]">Enter your master password.</p>
          </div>
          <div className="space-y-3">
            <Field label="Master password">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleUnlock()} placeholder="Master password" autoFocus className="input" />
            </Field>
            {error && <ErrorMsg msg={error} />}
          </div>
          <button onClick={handleUnlock} disabled={busy || !password} className="btn-primary w-full">
            {busy ? <Loader2 size={16} className="animate-spin" /> : "Unlock"}
          </button>
          <button onClick={handleDeleteVault} className="w-full text-xs text-[var(--text-faint)] hover:text-[var(--accent)] transition py-2">Forgot password? Delete vault</button>
        </div>
      </Shell>
    );
  }

  /* Editor */
  if (editing) {
    return (
      <Shell onClose={onClose} title="Vault">
        <EntryEditor entry={editing} onSave={saveEntry} onCancel={() => setEditing(null)} />
      </Shell>
    );
  }

  /* List */
  return (
    <Shell onClose={onClose} title="Vault">
      <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <span className="text-xs text-[var(--text-muted)]">{entries!.length} saved {entries!.length === 1 ? "login" : "logins"}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setEditing({ id: uid(), title: "", url: "", username: "", password: "", ts: Date.now() })} className="inline-flex items-center gap-1 text-xs text-[var(--accent-bright)] hover:opacity-80 transition px-2 py-1">
            <Plus size={13} /> Add
          </button>
          <button onClick={handleLock} className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition px-2 py-1">
            <Unlock size={13} /> Lock
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {entries!.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <KeyRound size={24} className="text-[var(--text-faint)] mb-3" />
            <p className="text-sm text-[var(--text-muted)]">No saved logins yet. Add one to autofill it.</p>
          </div>
        ) : (
          <ul className="py-2">
            {entries!.map((entry) => (
              <li key={entry.id} className="group flex items-center gap-3 px-5 py-3 border-b transition" style={{ borderColor: "var(--border-faint)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-glow)")} onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: "linear-gradient(135deg, var(--accent-grad-from), var(--accent-grad-to))", boxShadow: "0 4px 12px var(--accent-shadow)" }}>
                  {entry.title ? entry.title[0].toUpperCase() : "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-primary)] truncate">{entry.title || hostnameOf(entry.url)}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate font-mono">{entry.url ? hostnameOf(entry.url) : "—"}</p>
                </div>
                <button onClick={() => copyPassword(entry)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] transition shrink-0" aria-label="Copy password">
                  {copiedId === entry.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
                <button onClick={() => onAutofill(entry)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] transition shrink-0" aria-label="Autofill">
                  <KeyRound size={14} />
                </button>
                <button onClick={() => setEditing(entry)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition shrink-0 text-xs">Edit</button>
                <button onClick={() => deleteEntry(entry.id)} className="p-1.5 rounded-lg text-[var(--text-faint)] hover:text-[var(--accent)] transition shrink-0" aria-label="Delete">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border shadow-2xl flex flex-col max-h-[85vh] overflow-hidden" style={{ borderColor: "var(--border-primary)", background: "var(--bg-elev)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--border-primary)" }}>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Lock size={15} className="text-[var(--accent)]" /> {title}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return <p className="text-xs text-[var(--accent)] flex items-center gap-1.5"><ShieldAlert size={13} /> {msg}</p>;
}

function EntryEditor({ entry, onSave, onCancel }: { entry: VaultEntry; onSave: (entry: VaultEntry) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(entry.title);
  const [url, setUrl] = useState(entry.url);
  const [username, setUsername] = useState(entry.username);
  const [password, setPassword] = useState(entry.password);
  const [show, setShow] = useState(false);
  const valid = title.trim().length > 0 && password.length > 0;

  return (
    <Shell onClose={onCancel} title={entry.title ? "Edit login" : "Add login"}>
      <div className="p-6 space-y-3 flex-1 overflow-y-auto">
        <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. GitHub" autoFocus className="input" /></Field>
        <Field label="URL"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com" spellCheck={false} className="input font-mono" /></Field>
        <Field label="Username"><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="your@email.com" className="input" /></Field>
        <Field label="Password">
          <div className="relative">
            <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="input pr-10" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </Field>
      </div>
      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: "var(--border-primary)" }}>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">Cancel</button>
        <button onClick={() => onSave({ ...entry, title: title.trim(), url: url.trim(), username: username.trim(), password, ts: Date.now() })} disabled={!valid} className="btn-primary">Save</button>
      </div>
    </Shell>
  );
}
