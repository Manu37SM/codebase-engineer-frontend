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

function RequireAuth() {
  const { authRequired, user, loading } = useAuth();

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
