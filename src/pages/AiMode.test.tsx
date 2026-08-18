import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AiModePage from "./AiMode";
import * as api from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof api>("../lib/api");
  return {
    ...actual,
    listAiProviders: vi.fn(),
    createAiProvider: vi.fn(),
    updateAiProvider: vi.fn(),
    deleteAiProvider: vi.fn(),
    checkAiProviderStatus: vi.fn(),
  };
});

const mockedApi = api as unknown as {
  listAiProviders: ReturnType<typeof vi.fn>;
  createAiProvider: ReturnType<typeof vi.fn>;
  updateAiProvider: ReturnType<typeof vi.fn>;
  deleteAiProvider: ReturnType<typeof vi.fn>;
  checkAiProviderStatus: ReturnType<typeof vi.fn>;
};

const PROVIDER = {
  id: "prov1",
  name: "Local llama",
  kind: "openai-compatible",
  baseUrl: "http://localhost:11434/v1",
  model: "llama3.1",
  apiKeyRef: null,
  hasApiKey: false,
  enabled: false,
  createdAt: "now",
};

function renderPage() {
  return render(<AiModePage />);
}

describe("AiModePage", () => {
  beforeEach(() => {
    mockedApi.listAiProviders.mockReset();
    mockedApi.createAiProvider.mockReset();
    mockedApi.updateAiProvider.mockReset();
    mockedApi.deleteAiProvider.mockReset();
    mockedApi.checkAiProviderStatus.mockReset();
  });

  it("shows an empty state and explains Free Mode is unaffected when no provider is configured", async () => {
    mockedApi.listAiProviders.mockResolvedValue({ providers: [] });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/No AI provider configured yet/)).toBeInTheDocument();
    });
    expect(screen.getByText(/every Free Mode feature/)).toBeInTheDocument();
  });

  it("lists a configured provider with its kind, base URL, model, and disabled state", async () => {
    mockedApi.listAiProviders.mockResolvedValue({ providers: [PROVIDER] });
    renderPage();

    const item = (await screen.findByText("Local llama")).closest("li")!;
    expect(within(item).getByText("openai-compatible")).toBeInTheDocument();
    expect(within(item).getByText("Disabled")).toBeInTheDocument();
    expect(within(item).getByText(/http:\/\/localhost:11434\/v1/)).toBeInTheDocument();
    expect(within(item).getByText(/no API key/)).toBeInTheDocument();
  });

  it("adds a provider via the form and reloads the list", async () => {
    mockedApi.listAiProviders.mockResolvedValue({ providers: [] });
    mockedApi.createAiProvider.mockResolvedValue({ provider: PROVIDER });
    renderPage();
    await waitFor(() => expect(screen.getByText(/No AI provider configured yet/)).toBeInTheDocument());

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Name"), "Local llama");
    await user.type(screen.getByLabelText("Base URL"), "http://localhost:11434/v1");
    await user.type(screen.getByLabelText("Model"), "llama3.1");
    await user.click(screen.getByRole("button", { name: "Add provider" }));

    expect(mockedApi.createAiProvider).toHaveBeenCalledWith({
      name: "Local llama",
      kind: "openai-compatible",
      baseUrl: "http://localhost:11434/v1",
      model: "llama3.1",
      apiKey: undefined,
    });
    expect(mockedApi.listAiProviders).toHaveBeenCalledTimes(2);
  });

  it("rejects submitting without a name", async () => {
    mockedApi.listAiProviders.mockResolvedValue({ providers: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText(/No AI provider configured yet/)).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Add provider" }));

    expect(screen.getByText(/A name is required/)).toBeInTheDocument();
    expect(mockedApi.createAiProvider).not.toHaveBeenCalled();
  });

  it("enables a provider and reloads", async () => {
    mockedApi.listAiProviders.mockResolvedValue({ providers: [PROVIDER] });
    mockedApi.updateAiProvider.mockResolvedValue({ provider: { ...PROVIDER, enabled: true } });
    renderPage();
    await screen.findByText("Local llama");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Enable" }));

    expect(mockedApi.updateAiProvider).toHaveBeenCalledWith("prov1", { enabled: true });
    await waitFor(() => expect(mockedApi.listAiProviders).toHaveBeenCalledTimes(2));
  });

  it("deletes a provider and reloads", async () => {
    mockedApi.listAiProviders.mockResolvedValue({ providers: [PROVIDER] });
    mockedApi.deleteAiProvider.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText("Local llama");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(mockedApi.deleteAiProvider).toHaveBeenCalledWith("prov1");
    await waitFor(() => expect(mockedApi.listAiProviders).toHaveBeenCalledTimes(2));
  });

  it("checks status and shows the resulting badge", async () => {
    mockedApi.listAiProviders.mockResolvedValue({ providers: [PROVIDER] });
    mockedApi.checkAiProviderStatus.mockResolvedValue({
      status: "reachable",
      detail: null,
      checkedAt: "now",
    });
    renderPage();
    await screen.findByText("Local llama");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Check status" }));

    await waitFor(() => {
      expect(screen.getByText("reachable")).toBeInTheDocument();
    });
  });

  it("shows an error detail when the status check reports auth_error", async () => {
    mockedApi.listAiProviders.mockResolvedValue({ providers: [PROVIDER] });
    mockedApi.checkAiProviderStatus.mockResolvedValue({
      status: "auth_error",
      detail: "Authentication failed calling /models (HTTP 401)",
      checkedAt: "now",
    });
    renderPage();
    await screen.findByText("Local llama");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Check status" }));

    await waitFor(() => {
      expect(screen.getByText("auth_error")).toBeInTheDocument();
    });
    expect(screen.getByText(/Authentication failed/)).toBeInTheDocument();
  });
});
