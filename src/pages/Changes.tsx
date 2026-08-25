import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useProjects } from "../context/ProjectContext";
import {
  applyPatch,
  approveGeneratedTest,
  approveGeneratedTestWrite,
  approvePatch,
  approvePatchApply,
  generateAllPatches,
  generatePatch,
  generateTest,
  getBillingStatus,
  listChanges,
  rejectGeneratedTest,
  rejectGeneratedTestWrite,
  rejectAllPatches,
  rejectPatch,
  rejectPatchApply,
  writeAndRunGeneratedTest,
} from "../lib/api";
import type { GeneratedTestWithFindingContext, PatchWithFindingContext } from "../lib/types";
import BulkAiFixButton from "../components/BulkAiFixButton";
import BulkRejectButton from "../components/BulkRejectButton";

/**
 * The Changes page — a real unified review queue, replacing the old
 * "implemented in Phase 17/18" placeholder. Everything a patch or a
 * generated test can be *for* still lives per-finding on the Findings page
 * (that's where they're created); this page is the other half of the same
 * data — every patch and every generated test across the *whole* project,
 * in one queue, so a reviewer doesn't have to hunt through every finding
 * to find what's still waiting on a decision.
 *
 * Every action button here calls the exact same API functions the
 * Findings page's inline patch/test review UI calls (approve/reject/
 * generate/apply/write-and-run) — this page adds no new mutation surface,
 * only a different, project-wide way of listing and acting on the same
 * underlying rows. State (status, diff_text, test_code, apply_error, …)
 * is refetched from `listChanges` after every action rather than guessed
 * client-side, so this page can never show a status that doesn't match
 * what's really in the database.
 */
export default function ChangesPage() {
  const { selectedProject } = useProjects();
  const [patches, setPatches] = useState<PatchWithFindingContext[]>([]);
  const [generatedTests, setGeneratedTests] = useState<GeneratedTestWithFindingContext[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"patches" | "tests">("patches");
  const [filter, setFilter] = useState<"all" | "pending">("pending");

  function load() {
    if (!selectedProject) return;
    setLoading(true);
    setError(null);
    listChanges(selectedProject.id)
      .then((res) => {
        setPatches(res.patches);
        setGeneratedTests(res.generatedTests);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load changes"))
      .finally(() => setLoading(false));
  }

  // "Approve & generate all" (per the user's explicit request that this
  // behave the same way as Findings' "Fix all findings") is Pro-tier only.
  const [tier, setTier] = useState<"free" | "pro" | null>(null);
  useEffect(() => {
    getBillingStatus()
      .then((res) => setTier(res.tier))
      .catch(() => setTier(null));
  }, []);

  useEffect(load, [selectedProject]);

  async function withBusy(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    setError(null);
    try {
      await fn();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  if (!selectedProject) {
    return (
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Changes</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          No repository selected yet. Go to{" "}
          <Link to="/repositories" className="underline">
            Repositories
          </Link>{" "}
          to register and scan one.
        </p>
      </div>
    );
  }

  const PENDING_PATCH_STATUSES = new Set(["pending_approval", "approved", "proposed", "approved_for_apply", "failed"]);
  const PENDING_TEST_STATUSES = new Set(["pending_approval", "approved", "proposed", "approved_for_write"]);

  const visiblePatches = filter === "pending" ? patches.filter((p) => PENDING_PATCH_STATUSES.has(p.status)) : patches;
  const visibleTests =
    filter === "pending" ? generatedTests.filter((t) => PENDING_TEST_STATUSES.has(t.status)) : generatedTests;
  const pendingCount =
    patches.filter((p) => PENDING_PATCH_STATUSES.has(p.status)).length +
    generatedTests.filter((t) => PENDING_TEST_STATUSES.has(t.status)).length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Changes
          {pendingCount > 0 && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              {pendingCount} pending
            </span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          {tier === "pro" && selectedProject && patches.some((p) => p.status === "pending_approval") && (
            <BulkAiFixButton
              label="Approve & generate all"
              itemDescription={`${patches.filter((p) => p.status === "pending_approval").length} pending patch${
                patches.filter((p) => p.status === "pending_approval").length === 1 ? "" : "es"
              }`}
              onRun={() => generateAllPatches(selectedProject.id)}
              onDone={load}
            />
          )}
          {tier === "pro" &&
            selectedProject &&
            patches.some((p) => p.status === "proposed" || p.status === "approved_for_apply") && (
              <BulkRejectButton
                itemDescription={`${
                  patches.filter((p) => p.status === "proposed" || p.status === "approved_for_apply").length
                } patch${
                  patches.filter((p) => p.status === "proposed" || p.status === "approved_for_apply").length === 1
                    ? ""
                    : "es"
                }`}
                onRun={() => rejectAllPatches(selectedProject.id)}
                onDone={load}
              />
            )}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as "all" | "pending")}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="pending">Pending review only</option>
            <option value="all">All (including applied/rejected)</option>
          </select>
        </div>
      </div>

      <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
        Every AI-proposed patch and generated test for this project, in one queue. Create new ones from a
        finding's fix plan on the{" "}
        <Link to="/findings" className="underline">
          Findings
        </Link>{" "}
        page — approve, reject, apply, or run them from here.
      </p>

      <div className="mt-4 flex gap-1 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setTab("patches")}
          className={`px-3 py-1.5 text-sm font-medium ${
            tab === "patches"
              ? "border-b-2 border-slate-900 text-slate-900 dark:border-slate-100 dark:text-slate-100"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          Patches ({visiblePatches.length})
        </button>
        <button
          onClick={() => setTab("tests")}
          className={`px-3 py-1.5 text-sm font-medium ${
            tab === "tests"
              ? "border-b-2 border-slate-900 text-slate-900 dark:border-slate-100 dark:text-slate-100"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          Generated tests ({visibleTests.length})
        </button>
      </div>

      {loading && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!loading && tab === "patches" && (
        <div className="mt-4">
          {visiblePatches.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {filter === "pending" ? "Nothing waiting on review right now." : "No patches created yet."}
            </p>
          )}
          <ul className="space-y-2">
            {visiblePatches.map((patch) => (
              <li
                key={patch.id}
                className="rounded border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <ChangeHeader
                  description={patch.description}
                  status={patch.status}
                  findingRuleId={patch.findingRuleId}
                  findingFilePath={patch.findingFilePath}
                  findingSeverity={patch.findingSeverity}
                  findingId={patch.finding_id}
                />

                {patch.status === "pending_approval" && (
                  <ActionRow
                    busy={busy === patch.id}
                    onApprove={() => withBusy(patch.id, () => approvePatch(selectedProject.id, patch.id))}
                    onReject={() => withBusy(patch.id, () => rejectPatch(selectedProject.id, patch.id))}
                    approveLabel="Approve for generation"
                  />
                )}
                {patch.status === "approved" && (
                  <button
                    onClick={() => withBusy(patch.id, () => generatePatch(selectedProject.id, patch.id))}
                    disabled={busy !== null}
                    className="mt-2 rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                  >
                    Generate diff
                  </button>
                )}
                {patch.status === "rejected" && <p className="mt-2 text-slate-400">Rejected.</p>}
                {patch.status === "proposed" && (
                  <ActionRow
                    busy={busy === patch.id}
                    onApprove={() => withBusy(patch.id, () => approvePatchApply(selectedProject.id, patch.id))}
                    onReject={() => withBusy(patch.id, () => rejectPatchApply(selectedProject.id, patch.id))}
                    approveLabel="Approve diff for apply"
                  />
                )}
                {(patch.status === "approved_for_apply" || patch.status === "failed") && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => withBusy(patch.id, () => applyPatch(selectedProject.id, patch.id))}
                      disabled={busy !== null}
                      className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                    >
                      {patch.status === "failed" ? "Retry apply" : "Apply patch"}
                    </button>
                    {/* Bug fix: previously there was no way to back out once a diff
                        passed the second approval gate — only Apply was offered,
                        even for someone who changed their mind before actually
                        writing to disk. Reject is available here too now. Only
                        for "approved_for_apply" — a "failed" apply already tried
                        and failed to write anything, so the backend's reject-apply
                        route (correctly) doesn't accept that status. */}
                    {patch.status === "approved_for_apply" && (
                      <button
                        onClick={() => withBusy(patch.id, () => rejectPatchApply(selectedProject.id, patch.id))}
                        disabled={busy !== null}
                        className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                )}
                {patch.status === "applied" && (
                  <p className="mt-2 font-medium text-emerald-700 dark:text-emerald-400">Applied to disk.</p>
                )}
                {patch.status === "failed" && patch.apply_error && (
                  <p className="mt-2 text-red-600 dark:text-red-400">Apply failed: {patch.apply_error}</p>
                )}
                {patch.diff_text && (
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-900 p-2 font-mono text-[11px] text-slate-100">
                    {patch.diff_text}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && tab === "tests" && (
        <div className="mt-4">
          {visibleTests.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {filter === "pending" ? "Nothing waiting on review right now." : "No tests generated yet."}
            </p>
          )}
          <ul className="space-y-2">
            {visibleTests.map((t) => (
              <li
                key={t.id}
                className="rounded border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <ChangeHeader
                  description={t.description}
                  status={t.status}
                  findingRuleId={t.findingRuleId}
                  findingFilePath={t.findingFilePath}
                  findingSeverity={t.findingSeverity}
                  findingId={t.finding_id}
                />

                {t.status === "pending_approval" && (
                  <ActionRow
                    busy={busy === t.id}
                    onApprove={() => withBusy(t.id, () => approveGeneratedTest(selectedProject.id, t.id))}
                    onReject={() => withBusy(t.id, () => rejectGeneratedTest(selectedProject.id, t.id))}
                    approveLabel="Approve for generation"
                  />
                )}
                {t.status === "approved" && (
                  <button
                    onClick={() => withBusy(t.id, () => generateTest(selectedProject.id, t.id))}
                    disabled={busy !== null}
                    className="mt-2 rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                  >
                    Generate test
                  </button>
                )}
                {t.status === "rejected" && <p className="mt-2 text-slate-400">Rejected.</p>}
                {t.status === "proposed" && (
                  <ActionRow
                    busy={busy === t.id}
                    onApprove={() => withBusy(t.id, () => approveGeneratedTestWrite(selectedProject.id, t.id))}
                    onReject={() => withBusy(t.id, () => rejectGeneratedTestWrite(selectedProject.id, t.id))}
                    approveLabel="Approve test for write"
                  />
                )}
                {(t.status === "approved_for_write" ||
                  t.status === "written" ||
                  t.status === "failed_tests" ||
                  t.status === "passed") && (
                  <button
                    onClick={() => withBusy(t.id, () => writeAndRunGeneratedTest(selectedProject.id, t.id))}
                    disabled={busy !== null}
                    className="mt-2 rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                  >
                    {t.status === "approved_for_write" ? "Write and run" : "Re-run tests"}
                  </button>
                )}
                {t.status === "written" && (
                  <p className="mt-2 text-amber-700 dark:text-amber-400">
                    Written to disk, but no supported test command was found to actually run it.
                  </p>
                )}
                {t.status === "passed" && (
                  <p className="mt-2 font-medium text-emerald-700 dark:text-emerald-400">
                    Written and the project's real test suite passed.
                  </p>
                )}
                {t.status === "failed_tests" && (
                  <p className="mt-2 font-medium text-red-600 dark:text-red-400">
                    Written, but the project's real test suite failed.
                  </p>
                )}
                {t.target_path && <p className="mt-2 text-slate-500 dark:text-slate-400">Target: {t.target_path}</p>}
                {t.test_code && (
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-900 p-2 font-mono text-[11px] text-slate-100">
                    {t.test_code}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ChangeHeader({
  description,
  status,
  findingRuleId,
  findingFilePath,
  findingSeverity,
  findingId,
}: {
  description: string | null;
  status: string;
  findingRuleId: string | null;
  findingFilePath: string | null;
  findingSeverity: string | null;
  findingId: string | null;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="font-medium text-slate-700 dark:text-slate-200">
          {description ?? "(no description)"}{" "}
          <span className="font-normal text-slate-500 dark:text-slate-400">— {status}</span>
        </p>
        {(findingRuleId || findingFilePath) && (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {findingSeverity && <span className="uppercase">{findingSeverity}</span>}
            {findingSeverity && findingRuleId && " · "}
            {findingRuleId}
            {findingFilePath && ` · ${findingFilePath}`}
            {findingId && (
              <>
                {" "}
                ·{" "}
                <Link to="/findings" className="underline">
                  view finding
                </Link>
              </>
            )}
          </p>
        )}
        {!findingRuleId && !findingFilePath && findingId === null && (
          <p className="mt-0.5 text-xs text-slate-400">Original finding no longer exists.</p>
        )}
      </div>
    </div>
  );
}

function ActionRow({
  busy,
  onApprove,
  onReject,
  approveLabel,
}: {
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  approveLabel: string;
}) {
  return (
    <div className="mt-2 flex gap-2">
      <button
        onClick={onApprove}
        disabled={busy}
        className="rounded bg-emerald-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
      >
        {approveLabel}
      </button>
      <button
        onClick={onReject}
        disabled={busy}
        className="rounded bg-red-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
      >
        Reject
      </button>
    </div>
  );
}
