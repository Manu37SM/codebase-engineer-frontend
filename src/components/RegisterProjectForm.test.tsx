import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegisterProjectForm from "./RegisterProjectForm";
import * as api from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof api>("../lib/api");
  return { ...actual, createProject: vi.fn(), importProject: vi.fn() };
});

const mockedApi = api as unknown as {
  createProject: ReturnType<typeof vi.fn>;
  importProject: ReturnType<typeof vi.fn>;
};

describe("RegisterProjectForm (Task #85 — git/zip URL modes)", () => {
  beforeEach(() => {
    mockedApi.createProject.mockReset();
    mockedApi.importProject.mockReset();
  });

  it("defaults to local-path mode", () => {
    render(<RegisterProjectForm onRegistered={vi.fn()} />);
    expect(screen.getByLabelText("Absolute path")).toBeInTheDocument();
  });

  it("switches to Git URL mode and imports via a git clone", async () => {
    mockedApi.importProject.mockResolvedValue({ project: { id: "p1" } });
    const onRegistered = vi.fn();
    render(<RegisterProjectForm onRegistered={onRegistered} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Git URL" }));

    await user.type(screen.getByLabelText("Name"), "cloned-repo");
    await user.type(screen.getByLabelText("Git URL"), "https://github.com/user/repo.git");
    await user.click(screen.getByRole("button", { name: "Register & continue" }));

    expect(mockedApi.importProject).toHaveBeenCalledWith("cloned-repo", "git", "https://github.com/user/repo.git");
    expect(mockedApi.createProject).not.toHaveBeenCalled();
    expect(onRegistered).toHaveBeenCalledWith("p1");
  });

  it("switches to Zip URL mode and imports via a zip download", async () => {
    mockedApi.importProject.mockResolvedValue({ project: { id: "p2" } });
    render(<RegisterProjectForm onRegistered={vi.fn()} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Zip URL" }));

    await user.type(screen.getByLabelText("Name"), "zipped-repo");
    await user.type(screen.getByLabelText("Zip download URL"), "https://example.com/archive.zip");
    await user.click(screen.getByRole("button", { name: "Register & continue" }));

    expect(mockedApi.importProject).toHaveBeenCalledWith("zipped-repo", "zip", "https://example.com/archive.zip");
  });

  it("shows the import failure message rather than a generic one", async () => {
    mockedApi.importProject.mockRejectedValue(new api.ApiError("git clone failed: repository not found", 400));
    render(<RegisterProjectForm onRegistered={vi.fn()} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Git URL" }));
    await user.type(screen.getByLabelText("Name"), "x");
    await user.type(screen.getByLabelText("Git URL"), "https://github.com/nope/nope.git");
    await user.click(screen.getByRole("button", { name: "Register & continue" }));

    expect(await screen.findByText("git clone failed: repository not found")).toBeInTheDocument();
  });
});
