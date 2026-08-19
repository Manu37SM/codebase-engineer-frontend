import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Light/dark mode. Three stored preferences, mirroring the OS-level
 * convention (light / dark / follow system) rather than just a boolean —
 * "system" is the honest default for a user who's never expressed a
 * preference, rather than silently guessing light.
 *
 * Persisted the same way `ProjectContext` persists the selected project:
 * a plain localStorage key, read once on mount, written on every change,
 * with a try/catch around storage access since it can throw in some
 * embedded/test environments.
 *
 * Applying the theme is a single `classList.toggle("dark", ...)` on
 * `<html>` — Tailwind is configured with `darkMode: "class"`
 * (tailwind.config.js), so every `dark:` utility across the app reacts to
 * that one class. Pages that haven't been given explicit `dark:` variants
 * still get a reasonable dark appearance via the `.dark` overrides for the
 * common slate/white utility classes in `index.css`, so switching themes
 * never leaves an unstyled, jarring page even before every page is
 * individually touched up.
 */
export type ThemePreference = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "codebase-engineer.theme";

interface ThemeContextValue {
  theme: ThemePreference;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

function readStoredTheme(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // localStorage unavailable — fall through to the default below
  }
  return "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(readStoredTheme);
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);

  // Track OS-level changes live, so a "system" preference stays accurate
  // without requiring a reload (e.g. the user's OS switches to dark mode
  // at sunset while this tab is already open).
  useEffect(() => {
    let mql: MediaQueryList;
    try {
      mql = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, []);

  const resolvedTheme: "light" | "dark" = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  function setTheme(next: ThemePreference) {
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // ignore storage failures — the preference still applies for this session
    }
  }

  function toggleTheme() {
    // Cycling from "system" flips relative to what's currently shown,
    // rather than jumping to a fixed value the user didn't ask for.
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
