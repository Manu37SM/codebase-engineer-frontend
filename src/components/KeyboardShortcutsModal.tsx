import { useEffect, useState } from "react";

export const OPEN_SHORTCUTS_EVENT = "codebase-engineer:open-shortcuts-help";

interface ShortcutEntry {
  keys: string;
  description: string;
}

const SHORTCUTS: ShortcutEntry[] = [
  { keys: "⌘K / Ctrl K", description: "Open the command palette (jump to a page or switch repository)" },
  { keys: "?", description: "Show this keyboard shortcuts reference" },
  { keys: "Esc", description: "Close the command palette or this dialog" },
  { keys: "↑ / ↓", description: "Move through results in the command palette" },
  { keys: "Enter", description: "Select the highlighted command palette result" },
];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}

export default function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget(e.target)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    function handleOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener(OPEN_SHORTCUTS_EVENT, handleOpenEvent);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener(OPEN_SHORTCUTS_EVENT, handleOpenEvent);
    };
  }, []);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Keyboard shortcuts</h2>
        </div>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-center justify-between gap-4 px-4 py-2 text-sm">
              <span className="text-slate-600 dark:text-slate-300">{s.description}</span>
              <span className="shrink-0 rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                {s.keys}
              </span>
            </li>
          ))}
        </ul>
        <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Press Esc to close
        </div>
      </div>
    </div>
  );
}
