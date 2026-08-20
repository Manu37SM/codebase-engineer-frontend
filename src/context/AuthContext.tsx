import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getCurrentUser, logout as apiLogout, type AuthUser } from "../lib/api";

interface AuthContextValue {
  /** Whether this instance requires a session at all — false in open/legacy mode (zero accounts registered). */
  authRequired: boolean;
  user: AuthUser | null;
  /** True only while the very first `/auth/me` check is in flight — avoids a login-screen flash before we know the real state. */
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Task #91: mirrors ProjectContext.tsx's shape. Checks `/api/v1/auth/me`
 * once on mount (that route is always reachable — see
 * backend/src/auth/guard.ts) and exposes the result app-wide, so App.tsx
 * can decide whether to show the login screen without every page having
 * to know about auth.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [authRequired, setAuthRequired] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await getCurrentUser();
      setAuthRequired(result.authRequired);
      setUser(result.user);
    } catch {
      // If even /auth/me is unreachable, fail open rather than locking
      // someone out of a working app over a transient network hiccup —
      // matches this app's "never fabricate, but don't invent new failure
      // modes either" posture. The rest of the app will surface its own
      // errors from its own API calls regardless.
      setAuthRequired(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ authRequired, user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
