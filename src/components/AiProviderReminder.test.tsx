import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AiProviderReminder from "./AiProviderReminder";
import * as api from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof api>("../lib/api");
  return {
    ...actual,
    listAiProviders: vi.fn(),
  };
});

const mockedApi = api as unknown as {
  listAiProviders: ReturnType<typeof vi.fn>;
};

function renderReminder(onDismiss = vi.fn()) {
  return render(
    <MemoryRouter>
      <AiProviderReminder onDismiss={onDismiss} />
    </MemoryRouter>
  );
}

describe("AiProviderReminder (nudge shown after registering, per the user's request that AI Mode setup shouldn't be silently skippable)", () => {
  beforeEach(() => {
    mockedApi.listAiProviders.mockReset();
  });

  it("shows the reminder when no AI provider is configured yet", async () => {
    mockedApi.listAiProviders.mockResolvedValue({ providers: [] });
    renderReminder();

    expect(await screen.findByText("An AI provider is necessary")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Register AI provider now!" })).toHaveAttribute("href", "/ai-mode");
    expect(screen.getByRole("button", { name: "Skip / Add later" })).toBeInTheDocument();
  });

  it("stays hidden when a provider already exists — this is a nudge, not a nag", async () => {
    mockedApi.listAiProviders.mockResolvedValue({
      providers: [{ id: "p1", name: "My Provider", kind: "openai-compatible", baseUrl: null, model: null, enabled: true, createdAt: "now" }],
    });
    renderReminder();

    await waitFor(() => expect(mockedApi.listAiProviders).toHaveBeenCalled());
    expect(screen.queryByText("An AI provider is necessary")).not.toBeInTheDocument();
  });

  it("fails safe (stays hidden) if the provider check itself errors, rather than nagging incorrectly", async () => {
    mockedApi.listAiProviders.mockRejectedValue(new Error("network error"));
    renderReminder();

    await waitFor(() => expect(mockedApi.listAiProviders).toHaveBeenCalled());
    expect(screen.queryByText("An AI provider is necessary")).not.toBeInTheDocument();
  });

  it("calls onDismiss when \"Skip / Add later\" is clicked", async () => {
    mockedApi.listAiProviders.mockResolvedValue({ providers: [] });
    const onDismiss = vi.fn();
    renderReminder(onDismiss);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Skip / Add later" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
