import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import CommandPalette from "./CommandPalette";
import { ProjectProvider } from "../context/ProjectContext";
import { ThemeProvider } from "../context/ThemeContext";
import * as api from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof api>("../lib/api");
  return { ...actual, listProjects: vi.fn() };
});

const mockedApi = api as unknown as { listProjects: ReturnType<typeof vi.fn> };

const PROJECTS = [
  { id: "p1", name: "job-bot", root_path: "/tmp/job-bot", created_at: "now" },
  { id: "p2", name: "widget-app", root_path: "/tmp/widget-app", created_at: "now" },
];

function Probe({ path }: { path: string }) {
  return <div>Now viewing: {path}</div>;
}

function renderWithRoutes() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/"]}>
        <ProjectProvider>
          <CommandPalette />
          <Routes>
            <Route path="/" element={<Probe path="Dashboard" />} />
            <Route path="/findings" element={<Probe path="Findings" />} />
            <Route path="/changes" element={<Probe path="Changes" />} />
          </Routes>
        </ProjectProvider>
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe("CommandPalette", () => {
  beforeEach(() => {
    mockedApi.listProjects.mockReset().mockResolvedValue({ projects: PROJECTS });
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("is closed by default", () => {
    renderWithRoutes();
    expect(screen.queryByLabelText("Command palette search")).not.toBeInTheDocument();
  });

  it("opens on Ctrl+K and closes on Escape", async () => {
    renderWithRoutes();
    const user = userEvent.setup();

    await user.keyboard("{Control>}k{/Control}");
    expect(await screen.findByLabelText("Command palette search")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByLabelText("Command palette search")).not.toBeInTheDocument();
    });
  });

  it("opens via the custom open event (the visible Search button's mechanism)", async () => {
    renderWithRoutes();
    window.dispatchEvent(new CustomEvent("codebase-engineer:open-command-palette"));
    expect(await screen.findByLabelText("Command palette search")).toBeInTheDocument();
  });

  it("filters commands by typed text and navigates to a page on Enter", async () => {
    renderWithRoutes();
    const user = userEvent.setup();
    await user.keyboard("{Control>}k{/Control}");

    const input = await screen.findByLabelText("Command palette search");
    await user.type(input, "Findings");

    expect(screen.getByText("Findings")).toBeInTheDocument();
    expect(screen.queryByText("Architecture")).not.toBeInTheDocument();

    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText("Now viewing: Findings")).toBeInTheDocument();
    });
    // Palette closes after running the command.
    expect(screen.queryByLabelText("Command palette search")).not.toBeInTheDocument();
  });

  it("lists real registered projects and switches the selected one on click", async () => {
    renderWithRoutes();
    const user = userEvent.setup();
    await user.keyboard("{Control>}k{/Control}");

    const input = await screen.findByLabelText("Command palette search");
    await user.type(input, "widget");

    expect(await screen.findByText("widget-app")).toBeInTheDocument();
    await user.click(screen.getByText("widget-app"));

    await waitFor(() => {
      expect(window.localStorage.getItem("codebase-engineer.selectedProjectId")).toBe("p2");
    });
  });

  it("toggles the theme via the palette", async () => {
    renderWithRoutes();
    const user = userEvent.setup();
    await user.keyboard("{Control>}k{/Control}");

    const input = await screen.findByLabelText("Command palette search");
    await user.type(input, "dark mode");

    expect(await screen.findByText("Switch to dark mode")).toBeInTheDocument();
    await user.click(screen.getByText("Switch to dark mode"));

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });
});
