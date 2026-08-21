import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BillingPage from "./Billing";
import * as api from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof api>("../lib/api");
  return {
    ...actual,
    getBillingStatus: vi.fn(),
    createBillingCheckout: vi.fn(),
  };
});

const mockedApi = api as unknown as {
  getBillingStatus: ReturnType<typeof vi.fn>;
  createBillingCheckout: ReturnType<typeof vi.fn>;
};

function renderPage() {
  return render(<BillingPage />);
}

describe("BillingPage", () => {
  // jsdom doesn't implement real navigation — assigning window.location.href
  // logs a "not implemented" warning and never actually updates the
  // property, so a real navigation can't be observed by reading it back.
  // Replace `window.location` with a plain writable stub for these tests
  // so the redirect assignment itself (what Billing.tsx actually does) can
  // be asserted on directly.
  const originalLocation = window.location;

  beforeEach(() => {
    mockedApi.getBillingStatus.mockReset();
    mockedApi.createBillingCheckout.mockReset();
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
});
