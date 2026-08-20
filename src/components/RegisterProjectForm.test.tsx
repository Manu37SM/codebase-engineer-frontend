import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegisterProjectForm from "./RegisterProjectForm";
import { AuthProvider } from "../context/AuthContext";
import * as api from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof api>("../lib/api");
  return {
    ...actual,
    createProject: vi.fn(),
    importProject: vi.fn(),
    getCurrentUser: vi.fn(),
    listGitHubRepos: vi.fn(),
    importGitHubRepo: vi.fn(),
  };
});

const mockedApi = api as unknown as {
  createProject: ReturnType<typeof vi.fn>;
  importProject: ReturnType<typeof vi.fn>;
  getCurrentUser: ReturnType<typeof vi.fn>;
  listGitHubRepos: ReturnType<typeof vi.fn>;
  importGitHubRepo: ReturnType<typeof vi.fn>;
};

const CONNECTED_USER = {
  id: "u1",
  email: "octo@example.com",
  displayName: "Octo",
  createdAt: "now",
  githubConnected: true,
};

function renderForm(onRegistered = vi.fn()) {
  return render(
    <AuthProvider>
      <RegisterProjectForm onRegistered={onRegistered} />
    </AuthProvider>
  );
}

describe("RegisterProjectForm (Task #85 — git/zip URL modes; Task #84 — GitHub repo browser)", () => {
  beforeEach(() => {
    mockedApi.createProject.mockReset();
    mockedApi.importProject.mockReset();
    mockedApi.listGitHubRepos.mockReset();
    mockedApi.importGitHubRepo.mockReset();
    mockedApi.getCurrentUser.mockReset().mockResolvedValue({ authRequired: false, user: null });
  });

  it("defaults to local-path mode", async () => {
    renderForm();
    expect(await screen.findByLabelText("Absolute path")).toBeInTheDocument();
  });

  it("switches to Git URL mode and imports via a git clone", async () => {
    mockedApi.importProject.mockResolvedValue({ project: { id: "p1" } });
    const onRegistered = vi.fn();
    renderForm(onRegistered);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Git URL" }));

    await user.type(screen.getByLabelText("Name"), "cloned-repo");
    await user.type(screen.getByLabelText("Git URL"), "https://github.com/user/repo.git");
    await user.click(screen.getByRole("button", { name: "Register & continue" }));

    expect(mockedApi.importProject).toHaveBeenCalledWith("cloned-repo", "git", "https://github.com/user/repo.git");
    expect(mockedApi.createProject).not.toHaveBeenCalled();
    expect(onRegistered).toHaveBeenCalledWith("p1");
  });

  it("switches to Zip URL mode and imports via a zip download", async () => {
    mockedApi.importProject.mockResolvedValue({ project: { id: "p2" } });
    renderForm();

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Zip URL" }));

    await user.type(screen.getByLabelText("Name"), "zipped-repo");
    await user.type(screen.getByLabelText("Zip download URL"), "https://example.com/archive.zip");
    await user.click(screen.getByRole("button", { name: "Register & continue" }));

    expect(mockedApi.importProject).toHaveBeenCalledWith("zipped-repo", "zip", "https://example.com/archive.zip");
  });

  it("shows the import failure message rather than a generic one", async () => {
    mockedApi.importProject.mockRejectedValue(new api.ApiError("git clone failed: repository not found", 400));
    renderForm();

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Git URL" }));
    await user.type(screen.getByLabelText("Name"), "x");
    await user.type(screen.getByLabelText("Git URL"), "https://github.com/nope/nope.git");
    await user.click(screen.getByRole("button", { name: "Register & continue" }));

    expect(await screen.findByText("git clone failed: repository not found")).toBeInTheDocument();
  });

  it("GitHub mode: prompts to connect when the user hasn't linked GitHub", async () => {
    renderForm();

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "GitHub" }));

    expect(await screen.findByText(/Connect your GitHub account/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Connect GitHub" })).toHaveAttribute(
      "href",
      "/api/v1/auth/github/start"
    );
    expect(mockedApi.listGitHubRepos).not.toHaveBeenCalled();
  });

  it("GitHub mode: lists real repos and imports the picked one", async () => {
    mockedApi.getCurrentUser.mockResolvedValue({ authRequired: true, user: CONNECTED_USER });
    mockedApi.listGitHubRepos.mockResolvedValue({
      repos: [
        {
          id: 1,
          name: "my-app",
          fullName: "octocat/my-app",
          private: false,
          htmlUrl: "https://github.com/octocat/my-app",
          description: null,
          defaultBranch: "main",
          updatedAt: "now",
          fork: false,
        },
        {
          id: 2,
          name: "secret",
          fullName: "octocat/secret",
          private: true,
          htmlUrl: "https://github.com/octocat/secret",
          description: null,
          defaultBranch: "main",
          updatedAt: "now",
          fork: false,
        },
      ],
      truncated: false,
    });
    mockedApi.importGitHubRepo.mockResolvedValue({ project: { id: "p3" } });
    const onRegistered = vi.fn();
    renderForm(onRegistered);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "GitHub" }));

    const select = await screen.findByLabelText("Repository");
    await user.selectOptions(select, "octocat/secret");
    await user.click(screen.getByRole("button", { name: "Register & continue" }));

    expect(mockedApi.importGitHubRepo).toHaveBeenCalledWith("octocat/secret", undefined);
    expect(onRegistered).toHaveBeenCalledWith("p3");
  });

  it("GitHub mode: requires a repo to be picked before submitting", async () => {
    mockedApi.getCurrentUser.mockResolvedValue({ authRequired: true, user: CONNECTED_USER });
    mockedApi.listGitHubRepos.mockResolvedValue({ repos: [], truncated: false });
    renderForm();

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "GitHub" }));
    await screen.findByLabelText("Repository");
    await user.click(screen.getByRole("button", { name: "Register & continue" }));

    expect(await screen.findByText("Pick a repository to import.")).toBeInTheDocument();
    expect(mockedApi.importGitHubRepo).not.toHaveBeenCalled();
  });
});
