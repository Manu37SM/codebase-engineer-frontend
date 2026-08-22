import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";

/**
 * Dark mode only, per the user's explicit request to drop the light/dark
 * toggle entirely ("dark mode is enough no need to switch"). This used to
 * be a real light/dark/system preference with localStorage persistence and
 * a live `prefers-color-scheme` listener — all of that is gone now; the
 * `.dark` class is applied to `<html>` unconditionally, once, on mount.
 *
 * The context/hook shape is kept (rather than deleting `ThemeContext`
 * outright) so `NavShell`/`CommandPalette` and anything else that already
 * calls `useTheme()` doesn't need a structural rewrite — `resolvedTheme` is
 * always `"dark"`, and `setTheme`/`toggleTheme` are no-ops kept only for
 * type/call-site compatibility during this transition.
 */
export type ThemePreference = "dark";

interface ThemeContextValue {
  theme: ThemePreference;
  resolvedTheme: "dark";
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: "dark",
      resolvedTheme: "dark",
      setTheme: () => {},
      toggleTheme: () => {},
    }),
    []
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
