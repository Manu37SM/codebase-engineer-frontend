import { FormEvent, useEffect, useState } from "react";
import {
  ApiError,
  checkAiProviderStatus,
  createAiProvider,
  deleteAiProvider,
  listAiProviders,
  updateAiProvider,
} from "../lib/api";
import { SUPPORTED_AI_PROVIDER_KINDS, type AIProviderConfig, type AIProviderStatus } from "../lib/types";

const STATUS_STYLES: Record<string, string> = {
  reachable: "bg-emerald-100 text-emerald-800",
  auth_error: "bg-red-100 text-red-800",
  rate_limited: "bg-amber-100 text-amber-800",
  unreachable: "bg-slate-100 text-slate-700",
};

export default function AiModePage() {
  const [providers, setProviders] = useState<AIProviderConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>(SUPPORTED_AI_PROVIDER_KINDS[0]);
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [statusById, setStatusById] = useState<Record<string, AIProviderStatus | "checking" | "error">>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    listAiProviders()
      .then((res) => setProviders(res.providers))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load AI providers"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError("A name is required.");
      return;
    }
    setSubmitting(true);
    try {
      await createAiProvider({
        name: name.trim(),
        kind,
        baseUrl: baseUrl.trim() || undefined,
        model: model.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
      });
      setName("");
      setBaseUrl("");
      setModel("");
      setApiKey("");
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to add provider.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleEnabled(provider: AIProviderConfig) {
    setBusyId(provider.id);
    try {
      await updateAiProvider(provider.id, { enabled: !provider.enabled });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update provider.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(provider: AIProviderConfig) {
    setBusyId(provider.id);
    try {
      await deleteAiProvider(provider.id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete provider.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCheckStatus(provider: AIProviderConfig) {
    setStatusById((prev) => ({ ...prev, [provider.id]: "checking" }));
    try {
      const status = await checkAiProviderStatus(provider.id);
      setStatusById((prev) => ({ ...prev, [provider.id]: status }));
    } catch {
      setStatusById((prev) => ({ ...prev, [provider.id]: "error" }));
    }
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900">AI Mode</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">
        AI Mode is an optional layer — every Free Mode feature (Dashboard, Architecture, Findings,
        Git, Tests, Dependencies, Security, Audit) keeps working with no provider configured.
        Configuring a provider here only enables it for use; no AI action is triggered by
        configuring or enabling a provider. AI-assisted finding explanations, fix plans, and patch
        generation are not implemented yet.
      </p>

      <form
        onSubmit={handleCreate}
        className="mt-4 flex flex-wrap items-end gap-3 rounded border border-slate-200 bg-white p-4"
      >
        <div>
          <label className="block text-xs font-medium text-slate-600" htmlFor="provider-name">
            Name
          </label>
          <input
            id="provider-name"
            className="mt-1 w-40 rounded border border-slate-300 px-2 py-1 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My provider"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600" htmlFor="provider-kind">
            Kind
          </label>
          <select
            id="provider-kind"
            className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {SUPPORTED_AI_PROVIDER_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600" htmlFor="provider-base-url">
            Base URL
          </label>
          <input
            id="provider-base-url"
            className="mt-1 w-64 rounded border border-slate-300 px-2 py-1 text-sm"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://localhost:11434/v1"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600" htmlFor="provider-model">
            Model
          </label>
          <input
            id="provider-model"
            className="mt-1 w-40 rounded border border-slate-300 px-2 py-1 text-sm"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="llama3.1"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600" htmlFor="provider-api-key">
            API key (optional)
          </label>
          <input
            id="provider-api-key"
            type="password"
            className="mt-1 w-40 rounded border border-slate-300 px-2 py-1 text-sm"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="not required for local servers"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add provider"}
        </button>
        {formError && <p className="w-full text-sm text-red-600">{formError}</p>}
      </form>

      <div className="mt-6">
        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && providers.length === 0 && (
          <p className="text-sm text-slate-500">
            No AI provider configured yet. AI-Mode actions stay disabled until one is added and
            enabled above.
          </p>
        )}
        <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
          {providers.map((provider) => {
            const status = statusById[provider.id];
            return (
              <li key={provider.id} className="flex items-center justify-between gap-3 p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{provider.name}</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {provider.kind}
                    </span>
                    {provider.enabled ? (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        Enabled
                      </span>
                    ) : (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        Disabled
                      </span>
                    )}
                    {status && status !== "checking" && status !== "error" && (
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status.status] ?? ""}`}
                      >
                        {status.status}
                      </span>
                    )}
                    {status === "checking" && (
                      <span className="text-xs text-slate-400">Checking…</span>
                    )}
                    {status === "error" && (
                      <span className="text-xs text-red-600">Status check failed</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {provider.baseUrl ?? "no base URL set"} · {provider.model ?? "no model set"} ·{" "}
                    {provider.hasApiKey ? `key ${provider.apiKeyRef}` : "no API key"}
                  </div>
                  {status && status !== "checking" && status !== "error" && status.detail && (
                    <div className="mt-1 text-xs text-slate-400">{status.detail}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    onClick={() => handleCheckStatus(provider)}
                  >
                    Check status
                  </button>
                  <button
                    className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    disabled={busyId === provider.id}
                    onClick={() => handleToggleEnabled(provider)}
                  >
                    {provider.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    disabled={busyId === provider.id}
                    onClick={() => handleDelete(provider)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
