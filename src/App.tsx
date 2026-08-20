import { Navigate, Outlet, Routes, Route } from "react-router-dom";
import NavShell from "./components/NavShell";
import DashboardPage from "./pages/Dashboard";
import RepositoriesPage from "./pages/Repositories";
import ArchitecturePage from "./pages/Architecture";
import FindingsPage from "./pages/Findings";
import ChangesPage from "./pages/Changes";
import TestsPage from "./pages/Tests";
import AuditPage from "./pages/Audit";
import AiModePage from "./pages/AiMode";
import BillingPage from "./pages/Billing";
import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import { useAuth } from "./context/AuthContext";

/**
 * Task #91: the single choke point deciding whether the app's real pages
 * render or the login screen does — mirrors the backend's own single
 * choke point (`authGuard` in backend/src/auth/guard.ts). In open mode
 * (`authRequired: false`, the default with zero accounts registered) this
 * is a no-op, exactly like the backend guard — nothing changes for an
 * install that never sets up an account.
 */
function RequireAuth() {
  const { authRequired, user, loading } = useAuth();

  // Avoid a login-screen flash while the very first /auth/me check is
  // still in flight — render nothing rather than guessing.
  if (loading) return null;

  if (authRequired && !user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<NavShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="/repositories" element={<RepositoriesPage />} />
          <Route path="/architecture" element={<ArchitecturePage />} />
          <Route path="/findings" element={<FindingsPage />} />
          <Route path="/changes" element={<ChangesPage />} />
          <Route path="/tests" element={<TestsPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/ai-mode" element={<AiModePage />} />
          <Route path="/settings" element={<BillingPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
