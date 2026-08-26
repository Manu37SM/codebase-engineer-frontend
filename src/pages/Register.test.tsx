import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import RegisterPage from "./Register";
import { AuthProvider } from "../context/AuthContext";
import * as api from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof api>("../lib/api");
  return {
    ...actual,
    getCurrentUser: vi.fn(),
    registerAccount: vi.fn(),
    getAuthProviders: vi.fn(),
  };
});

vi.mock("../components/Turnstile", () => ({
  default: ({ onVerify }: { onVerify: (token: string) => void }) => {
    onVerify("test-token");
    return null;
  },
}));

const mockedApi = api as unknown as {
  getCurrentUser: ReturnType<typeof vi.fn>;
  registerAccount: ReturnType<typeof vi.fn>;
  getAuthProviders: ReturnType<typeof vi.fn>;
};

function Probe() {
  return <div>Landed on workspace</div>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <AuthProvider>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<Probe />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("RegisterPage", () => {
  beforeEach(() => {
    mockedApi.getCurrentUser.mockReset().mockResolvedValue({ authRequired: false, user: null });
    mockedApi.registerAccount.mockReset();
    mockedApi.getAuthProviders.mockReset().mockResolvedValue({ google: false, github: false, turnstile: false });
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "test-site-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not show OAuth buttons when no provider is configured", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Create an account" });
    expect(screen.queryByText("Continue with Google")).not.toBeInTheDocument();
    expect(screen.queryByText("Continue with GitHub")).not.toBeInTheDocument();
  });

  it("rejects a password shorter than 8 characters without calling the API", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Password must be at least 8 characters.")).toBeInTheDocument();
    expect(mockedApi.registerAccount).not.toHaveBeenCalled();
  });

  it("registers and navigates to the workspace on success", async () => {
    mockedApi.registerAccount.mockResolvedValue({
      user: { id: "u1", email: "a@b.com", displayName: null, createdAt: "now" },
    });
    mockedApi.getCurrentUser
      .mockResolvedValueOnce({ authRequired: false, user: null })
      .mockResolvedValueOnce({ authRequired: true, user: { id: "u1", email: "a@b.com", displayName: null, createdAt: "now" } });

    renderPage();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "a-real-password-123");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(mockedApi.registerAccount).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "a-real-password-123",
      displayName: undefined,
      turnstileToken: undefined,
    });
    expect(await screen.findByText("Landed on workspace")).toBeInTheDocument();
  });

  it("collects a Turnstile token and includes it in the register request when Turnstile is enabled", async () => {
    mockedApi.getAuthProviders.mockResolvedValue({ google: false, github: false, turnstile: true });
    mockedApi.registerAccount.mockResolvedValue({
      user: { id: "u1", email: "a@b.com", displayName: null, createdAt: "now" },
    });

    renderPage();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "a-real-password-123");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(mockedApi.registerAccount).toHaveBeenCalledWith(
      expect.objectContaining({ turnstileToken: "test-token" })
    );
  });

  it("submits without a token when Turnstile is reported enabled but no site key is configured locally", async () => {

    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
    mockedApi.getAuthProviders.mockResolvedValue({ google: false, github: false, turnstile: true });
    mockedApi.registerAccount.mockResolvedValue({
      user: { id: "u1", email: "a@b.com", displayName: null, createdAt: "now" },
    });

    renderPage();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "a-real-password-123");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(mockedApi.registerAccount).toHaveBeenCalledWith(
      expect.objectContaining({ turnstileToken: undefined })
    );
  });

  it("shows the error message on a failed registration", async () => {
    mockedApi.registerAccount.mockRejectedValue(new api.ApiError("Email already in use.", 409));

    renderPage();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "a-real-password-123");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(screen.getByText("Email already in use.")).toBeInTheDocument();
    });
  });
});
