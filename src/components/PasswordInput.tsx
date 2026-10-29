import { useState } from "react";

/** Password field with a show/hide toggle. The toggle is skipped in tab order only for the label-less icon; it stays keyboard reachable. */
export default function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative mt-1">
      <input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        className="w-full rounded border border-slate-300 py-1.5 pl-2 pr-14 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 px-2.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
