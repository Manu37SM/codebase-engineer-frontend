import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BillingPage from "./Billing";
import { AuthProvider } from "../context/AuthContext";
import * as api from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof api>("../lib/api");
  return {
    ...actual,
    getBillingStatus: vi.fn(),
    createBillingCheckout: vi.fn(),
    getAuthProviders: vi.fn(),
    getCurrentUser: vi.fn(),
  };
});

const mockedApi = api as unknown as {
  getBillingStatus: ReturnType<typeof vi.fn>;
  createBillingCheckout: ReturnType<typeof vi.fn>;
  getAuthProviders: ReturnType<typeof vi.fn>;
  getCurrentUser: ReturnType<typeof vi.fn>;
};

function renderPage() {
  return render(
    <AuthProvider>
      <BillingPage />
    </AuthProvider>
  );
}

describe("BillingPage", () => {

  const originalLocation = window.location;

  beforeEach(() => {
    mockedApi.getBillingStatus.mockReset();
    mockedApi.createBillingCheckout.mockReset();

    mockedApi.getAuthProviders.mockReset().mockResolvedValue({ google: false, github: false });
    mockedApi.getCurrentUser.mockReset().mockResolvedValue({ authRequired: false, user: null });
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { ...originalLocation, href: "" },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it("shows an honest not-configured message and no upgrade button when billing is unconfigured", async () => {
    mockedApi.getBillingStatus.mockResolvedValue({
      configured: false,
      tier: "free",
      limit: null,
      used: 0,
      subscription: null,
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Billing is not configured on this server/)).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Upgrade to Pro" })).not.toBeInTheDocument();
  });

  it("shows free-tier usage and an upgrade button when configured and under the limit", async () => {
    mockedApi.getBillingStatus.mockResolvedValue({
      configured: true,
      tier: "free",
      limit: 50,
      used: 10,
      subscription: { status: "active", currentPeriodEnd: null },
    });
    renderPage();

    await screen.findByText("Current plan: Free");
    expect(screen.getByText("10 / 50 AI operations used this month.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upgrade to Pro" })).toBeInTheDocument();
  });

  it("shows a limit-reached warning once usage reaches the cap", async () => {
    mockedApi.getBillingStatus.mockResolvedValue({
      configured: true,
      tier: "free",
      limit: 50,
      used: 50,
      subscription: { status: "active", currentPeriodEnd: null },
    });
    renderPage();

    await screen.findByText("Current plan: Free");
    expect(screen.getByText(/You've reached this month's free-tier limit/)).toBeInTheDocument();
  });

  it("shows unlimited Pro state with no upgrade button on the pro tier", async () => {
    mockedApi.getBillingStatus.mockResolvedValue({
      configured: true,
      tier: "pro",
      limit: null,
      used: 500,
      subscription: { status: "active", currentPeriodEnd: "2027-01-01T00:00:00.000Z" },
    });
    renderPage();

    await screen.findByText("Current plan: Pro");
    expect(screen.getByText("Unlimited AI operations")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Upgrade to Pro" })).not.toBeInTheDocument();
  });

  it("creates a real checkout session and redirects the browser to Dodo's hosted checkout URL", async () => {
    mockedApi.getBillingStatus.mockResolvedValue({
      configured: true,
      tier: "free",
      limit: 50,
      used: 5,
      subscription: { status: "active", currentPeriodEnd: null },
    });
    mockedApi.createBillingCheckout.mockResolvedValue({
      sessionId: "cks_abc123",
      checkoutUrl: "https://test.dodopayments.com/checkout/cks_abc123",
    });
    renderPage();

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Upgrade to Pro" }));

    expect(mockedApi.createBillingCheckout).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(window.location.href).toBe("https://test.dodopayments.com/checkout/cks_abc123");
    });
  });

  it("clears a stuck \"Redirecting to checkout…\" state on pageshow (browser Back / bfcache restore after an incomplete checkout)", async () => {
    mockedApi.getBillingStatus.mockResolvedValue({
      configured: true,
      tier: "free",
      limit: 50,
      used: 3,
      subscription: { status: "active", currentPeriodEnd: null },
    });
    mockedApi.createBillingCheckout.mockResolvedValue({
      sessionId: "cks_abc123",
      checkoutUrl: "https://test.dodopayments.com/checkout/cks_abc123",
    });
    renderPage();

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Upgrade to Pro" }));
    await screen.findByText("Redirecting to checkout…");

    act(() => {
      window.dispatchEvent(new Event("pageshow"));
    });

    await waitFor(() => {
      expect(screen.queryByText("Redirecting to checkout…")).not.toBeInTheDocument();
    });
    expect(await screen.findByRole("button", { name: "Upgrade to Pro" })).not.toBeDisabled();
  });

  it("shows an error and re-enables the button when checkout creation fails", async () => {
    mockedApi.getBillingStatus.mockResolvedValue({
      configured: true,
      tier: "free",
      limit: 50,
      used: 5,
      subscription: { status: "active", currentPeriodEnd: null },
    });
    mockedApi.createBillingCheckout.mockRejectedValue(new Error("Failed to start checkout."));
    renderPage();

    const user = userEvent.setup();
    const button = await screen.findByRole("button", { name: "Upgrade to Pro" });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText("Failed to start checkout.")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Upgrade to Pro" })).not.toBeDisabled();
  });

  describe("Connected accounts (per the user's request that GitHub/Google be add-ons to the registered account, not separate logins)", () => {
    beforeEach(() => {
      mockedApi.getBillingStatus.mockResolvedValue({
        configured: false,
        tier: "free",
        limit: null,
        used: 0,
        subscription: null,
      });
    });

    it("hides the section entirely when no OAuth provider is configured server-side", async () => {
      mockedApi.getAuthProviders.mockResolvedValue({ google: false, github: false });
      renderPage();

      await waitFor(() => expect(mockedApi.getAuthProviders).toHaveBeenCalled());
      expect(screen.queryByText("Connected accounts")).not.toBeInTheDocument();
    });

    it("offers a Connect link for a configured-but-not-yet-linked provider", async () => {
      mockedApi.getAuthProviders.mockResolvedValue({ google: true, github: true });
      mockedApi.getCurrentUser.mockResolvedValue({
        authRequired: true,
        user: {
          id: "u1",
          email: "manish@example.com",
          displayName: null,
          createdAt: "now",
          githubConnected: false,
          driveConnected: false,
        },
      });
      renderPage();

      await screen.findByText("Connected accounts");
      expect(screen.getByRole("link", { name: "Connect GitHub" })).toHaveAttribute(
        "href",
        "/api/v1/auth/github/start"
      );
      expect(screen.getByRole("link", { name: "Connect Google" })).toHaveAttribute(
        "href",
        "/api/v1/auth/google/start"
      );
    });

    it("shows Connected instead of a link once a provider is already linked to this account", async () => {
      mockedApi.getAuthProviders.mockResolvedValue({ google: true, github: true });
      mockedApi.getCurrentUser.mockResolvedValue({
        authRequired: true,
        user: {
          id: "u1",
          email: "manish@example.com",
          displayName: null,
          createdAt: "now",
          githubConnected: true,
          driveConnected: false,
        },
      });
      renderPage();

      await screen.findByText("Connected accounts");
      expect(screen.getAllByText("Connected")).toHaveLength(1);
      expect(screen.queryByRole("link", { name: "Connect GitHub" })).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Connect Google" })).toBeInTheDocument();
    });

    it("offers a Reconnect link alongside \"Connected\" — re-authorizing a stale token (e.g. a 401/403 the user hit) shouldn't require a full sign-out", async () => {
      mockedApi.getAuthProviders.mockResolvedValue({ google: true, github: true });
      mockedApi.getCurrentUser.mockResolvedValue({
        authRequired: true,
        user: {
          id: "u1",
          email: "manish@example.com",
          displayName: null,
          createdAt: "now",
          githubConnected: true,
          driveConnected: true,
        },
      });
      renderPage();

      await screen.findByText("Connected accounts");
      const reconnectLinks = screen.getAllByRole("link", { name: "Reconnect" });
      expect(reconnectLinks).toHaveLength(2);
      expect(reconnectLinks[0]).toHaveAttribute("href", "/api/v1/auth/github/start");
      expect(reconnectLinks[1]).toHaveAttribute("href", "/api/v1/auth/google/start");
    });
  });
});
