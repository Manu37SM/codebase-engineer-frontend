import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./Login";
import { AuthProvider } from "../context/AuthContext";
import * as api from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof api>("../lib/api");
  return {
    ...actual,
    getCurrentUser: vi.fn(),
    login: vi.fn(),
    getAuthProviders: vi.fn(),
  };
});

const mockedApi = api as unknown as {
  getCurrentUser: ReturnType<typeof vi.fn>;
  login: ReturnType<typeof vi.fn>;
  getAuthProviders: ReturnType<typeof vi.fn>;
};

function Probe() {
  return <div>Landed on workspace</div>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Probe />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    mockedApi.getCurrentUser.mockReset().mockResolvedValue({ authRequired: true, user: null });
    mockedApi.login.mockReset();
    mockedApi.getAuthProviders.mockReset().mockResolvedValue({ google: false, github: false });
  });

  it("does not show OAuth buttons when no provider is configured", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Sign in" });
    expect(screen.queryByText("Continue with Google")).not.toBeInTheDocument();
    expect(screen.queryByText("Continue with GitHub")).not.toBeInTheDocument();
  });

  it("shows only the configured OAuth provider's button", async () => {
    mockedApi.getAuthProviders.mockResolvedValue({ google: true, github: false });
    renderPage();
    expect(await screen.findByText("Continue with Google")).toBeInTheDocument();
    expect(screen.queryByText("Continue with GitHub")).not.toBeInTheDocument();
  });

  it("logs in and navigates to the workspace on success", async () => {
    mockedApi.login.mockResolvedValue({ user: { id: "u1", email: "a@b.com", displayName: null, createdAt: "now" } });
    mockedApi.getCurrentUser
      .mockResolvedValueOnce({ authRequired: true, user: null })
      .mockResolvedValueOnce({ authRequired: true, user: { id: "u1", email: "a@b.com", displayName: null, createdAt: "now" } });

    renderPage();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "a-real-password-123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(mockedApi.login).toHaveBeenCalledWith({ email: "a@b.com", password: "a-real-password-123" });
    expect(await screen.findByText("Landed on workspace")).toBeInTheDocument();
  });

  it("shows the error message on a failed login", async () => {
    mockedApi.login.mockRejectedValue(new api.ApiError("Invalid email or password.", 401));

    renderPage();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByText("Invalid email or password.")).toBeInTheDocument();
    });
  });
});
