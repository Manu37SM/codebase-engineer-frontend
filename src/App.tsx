import { Routes, Route } from "react-router-dom";
import NavShell from "./components/NavShell";
import PlaceholderPage from "./pages/Placeholder";
import DashboardPage from "./pages/Dashboard";
import RepositoriesPage from "./pages/Repositories";
import ArchitecturePage from "./pages/Architecture";
import FindingsPage from "./pages/Findings";
import TestsPage from "./pages/Tests";
import AuditPage from "./pages/Audit";
import AiModePage from "./pages/AiMode";

export default function App() {
  return (
    <Routes>
      <Route element={<NavShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="/repositories" element={<RepositoriesPage />} />
        <Route path="/architecture" element={<ArchitecturePage />} />
        <Route path="/findings" element={<FindingsPage />} />
        <Route
          path="/changes"
          element={
            <PlaceholderPage
              title="Changes"
              note="AI-proposed patch review & approval — implemented in Phase 17/18."
            />
          }
        />
        <Route path="/tests" element={<TestsPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/ai-mode" element={<AiModePage />} />
        <Route
          path="/settings"
          element={<PlaceholderPage title="Settings" />}
        />
      </Route>
    </Routes>
  );
}
