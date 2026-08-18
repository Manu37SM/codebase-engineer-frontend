import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ArchitecturePage from "./Architecture";
import { ProjectProvider } from "../context/ProjectContext";
import * as api from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof api>("../lib/api");
  return { ...actual, listProjects: vi.fn(), getArchitecture: vi.fn() };
});

const mockedApi = api as unknown as {
  listProjects: ReturnType<typeof vi.fn>;
  getArchitecture: ReturnType<typeof vi.fn>;
};

const PROJECT = { id: "p1", name: "my-app", root_path: "/tmp/my-app", created_at: "now" };

function renderPage() {
  return render(
    <MemoryRouter>
      <ProjectProvider>
        <ArchitecturePage />
      </ProjectProvider>
    </MemoryRouter>
  );
}

describe("ArchitecturePage", () => {
  beforeEach(() => {
    mockedApi.listProjects.mockReset();
    mockedApi.getArchitecture.mockReset();
    window.localStorage.clear();
  });

  it("prompts to select a repository when none is selected", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [] });
    renderPage();
    expect(await screen.findByText(/No repository selected yet/)).toBeInTheDocument();
  });

  it("prompts to scan when the architecture view is empty", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.getArchitecture.mockResolvedValue({
      depth: 2,
      nodes: [],
      edges: [],
      externalDependencies: [],
      generatedAt: "now",
      empty: true,
    });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    expect(await screen.findByText(/hasn't been indexed yet/)).toBeInTheDocument();
  });

  it("renders a module table, edges, and external dependencies", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.getArchitecture.mockResolvedValue({
      depth: 2,
      nodes: [
        { id: "src/a", fileCount: 2, testFileCount: 1, totalLoc: 30, languages: ["TypeScript"] },
        { id: "src/b", fileCount: 1, testFileCount: 0, totalLoc: 10, languages: ["TypeScript"] },
      ],
      edges: [{ from: "src/a", to: "src/b", weight: 2 }],
      externalDependencies: [{ specifier: "react", referenceCount: 3 }],
      generatedAt: "now",
      empty: false,
    });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();

    expect(await screen.findByText("src/a")).toBeInTheDocument();
    expect(screen.getByText("src/b")).toBeInTheDocument();
    expect(screen.getByText("src/b (2)")).toBeInTheDocument(); // src/a's "Depends on" cell
    const externalSection = screen.getByText("External dependencies").closest("div")!;
    expect(within(externalSection).getByText("react")).toBeInTheDocument();
    expect(within(externalSection).getByText("3")).toBeInTheDocument();
  });

  it("refetches with a new depth when a depth button is clicked", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.getArchitecture.mockResolvedValue({
      depth: 2,
      nodes: [],
      edges: [],
      externalDependencies: [],
      generatedAt: "now",
      empty: true,
    });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText(/hasn't been indexed yet/);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "3" }));

    expect(mockedApi.getArchitecture).toHaveBeenCalledWith("p1", 3);
  });
});
