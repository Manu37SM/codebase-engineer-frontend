import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { listProjects as apiListProjects } from "../lib/api";
import type { Project } from "../lib/types";

const SELECTED_PROJECT_STORAGE_KEY = "codebase-engineer.selectedProjectId";

interface ProjectContextValue {
  projects: Project[];
  loading: boolean;
  error: string | null;
  selectedProjectId: string | null;
  selectedProject: Project | null;
  selectProject: (id: string | null) => void;
  refresh: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(SELECTED_PROJECT_STORAGE_KEY);
    } catch {
      return null; 
    }
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { projects: fetched } = await apiListProjects();
      setProjects(fetched);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectProject = useCallback((id: string | null) => {
    setSelectedProjectId(id);
    try {
      if (id) window.localStorage.setItem(SELECTED_PROJECT_STORAGE_KEY, id);
      else window.localStorage.removeItem(SELECTED_PROJECT_STORAGE_KEY);
    } catch {

    }
  }, []);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const value: ProjectContextValue = {
    projects,
    loading,
    error,
    selectedProjectId,
    selectedProject,
    selectProject,
    refresh,
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjects(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProjects must be used within a ProjectProvider");
  return ctx;
}
