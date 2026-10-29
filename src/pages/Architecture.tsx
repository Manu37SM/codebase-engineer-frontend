import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useProjects } from "../context/ProjectContext";
import { getArchitecture } from "../lib/api";
import type { ArchitectureView, ModuleNode } from "../lib/types";
import { Icon, MeterBar, NoProjectState, PageHeader, PageSkeleton, StatCard } from "../components/ui";

const DEPTH_OPTIONS = [1, 2, 3] as const;

type SortKey = "id" | "fileCount" | "testFileCount" | "totalLoc";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "id", label: "Module" },
  { key: "fileCount", label: "Files" },
  { key: "testFileCount", label: "Tests" },
  { key: "totalLoc", label: "LOC" },
];

function compareNodes(a: ModuleNode, b: ModuleNode, key: SortKey): number {
  return key === "id" ? a.id.localeCompare(b.id) : a[key] - b[key];
}

export default function ArchitecturePage() {
  const { selectedProject } = useProjects();
  const [depth, setDepth] = useState<number>(2);
  const [view, setView] = useState<ArchitectureView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);

  useEffect(() => {
    if (!selectedProject) {
      setView(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getArchitecture(selectedProject.id, depth)
      .then((result) => {
        if (!cancelled) setView(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load architecture");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProject, depth]);

  const edgesByModule = useMemo(() => {
    const outgoing = new Map<string, { to: string; weight: number }[]>();
    const incoming = new Map<string, { from: string; weight: number }[]>();
    for (const edge of view?.edges ?? []) {
      outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), { to: edge.to, weight: edge.weight }]);
      incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), { from: edge.from, weight: edge.weight }]);
    }
    return { outgoing, incoming };
  }, [view]);

  const visibleNodes = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let nodes = (view?.nodes ?? []).filter((n) => !q || n.id.toLowerCase().includes(q));
    if (sort) {
      const dir = sort.dir === "asc" ? 1 : -1;
      nodes = [...nodes].sort((a, b) => dir * compareNodes(a, b, sort.key));
    }
    return nodes;
  }, [view, filter, sort]);

  const totals = useMemo(() => {
    const nodes = view?.nodes ?? [];
    return {
      modules: nodes.length,
      files: nodes.reduce((s, n) => s + n.fileCount, 0),
      loc: nodes.reduce((s, n) => s + n.totalLoc, 0),
      maxLoc: Math.max(0, ...nodes.map((n) => n.totalLoc)),
      edges: view?.edges.length ?? 0,
    };
  }, [view]);

  function toggleSort(key: SortKey) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: key === "id" ? "asc" : "desc" };
      if (prev.dir === "desc" && key !== "id") return { key, dir: "asc" };
      if (prev.dir === "asc" && key === "id") return { key, dir: "desc" };
      return null; // third click returns to the server's order
    });
  }

  if (!selectedProject) return <NoProjectState page="Architecture" />;

  const maxExternal = Math.max(0, ...(view?.externalDependencies ?? []).map((d) => d.referenceCount));

  return (
    <div>
      <PageHeader
        title="Architecture"
        subtitle={`Files are grouped into modules by directory (depth ${depth}). This is an aggregated summary, not a raw per-file graph — increase depth for a finer-grained module breakdown.`}
        actions={
          <div className="flex items-center gap-1 text-xs">
            <span className="mr-1 text-slate-500 dark:text-slate-400">Depth</span>
            {DEPTH_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDepth(d)}
                aria-pressed={depth === d}
                className={`h-7 w-7 rounded-md font-medium ${
                  depth === d
                    ? "bg-sky-600 text-white dark:bg-sky-500 dark:text-slate-950"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        }
      />

      {loading && <PageSkeleton label="Loading architecture" />}
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {!loading && !error && view?.empty && (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          This repository hasn't been indexed yet. Go to{" "}
          <Link to="/repositories" className="underline">
            Repositories
          </Link>{" "}
          and click Scan.
        </p>
      )}

      {!loading && !error && view && !view.empty && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Modules" value={totals.modules} />
            <StatCard label="Files in modules" value={totals.files.toLocaleString()} />
            <StatCard label="Lines of code" value={totals.loc.toLocaleString()} />
            <StatCard label="Dependency links" value={totals.edges} hint="between modules" />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="min-w-0 lg:col-span-2">
              <div className="mb-2 flex items-center gap-3">
                <div className="relative w-full max-w-xs">
                  <Icon
                    name="search"
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="search"
                    aria-label="Filter modules"
                    placeholder="Filter modules…"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  />
                </div>
                {filter && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {visibleNodes.length} of {view.nodes.length}
                  </span>
                )}
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700/70 dark:bg-slate-900">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                      {COLUMNS.map((col) => {
                        const active = sort?.key === col.key;
                        return (
                          <th
                            key={col.key}
                            scope="col"
                            aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}
                            className="px-3 py-2 font-medium"
                          >
                            <button
                              type="button"
                              onClick={() => toggleSort(col.key)}
                              title={`Sort by ${col.label.toLowerCase()}`}
                              className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                            >
                              {col.label}
                              {active && <Icon name={sort!.dir === "asc" ? "sortAsc" : "sortDesc"} className="h-3 w-3" />}
                            </button>
                          </th>
                        );
                      })}
                      <th scope="col" className="px-3 py-2 font-medium">Depends on</th>
                      <th scope="col" className="px-3 py-2 font-medium">Used by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleNodes.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                          No modules match "{filter}".
                        </td>
                      </tr>
                    )}
                    {visibleNodes.map((node) => {
                      const outgoing = edgesByModule.outgoing.get(node.id) ?? [];
                      const incoming = edgesByModule.incoming.get(node.id) ?? [];
                      return (
                        <tr
                          key={node.id}
                          className="border-b border-slate-100 align-top last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                        >
                          <td className="px-3 py-2 font-mono text-xs text-slate-900 dark:text-slate-100">{node.id}</td>
                          <td className="px-3 py-2 tabular-nums text-slate-700 dark:text-slate-200">{node.fileCount}</td>
                          <td className="px-3 py-2 tabular-nums text-slate-700 dark:text-slate-200">{node.testFileCount}</td>
                          <td className="min-w-[96px] px-3 py-2 text-slate-700 dark:text-slate-200">
                            <span className="tabular-nums">{node.totalLoc}</span>
                            <div className="mt-1">
                              <MeterBar value={node.totalLoc} max={totals.maxLoc} />
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                            <EdgeChips items={outgoing.map((e) => ({ name: e.to, weight: e.weight }))} />
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                            <EdgeChips items={incoming.map((e) => ({ name: e.from, weight: e.weight }))} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">External dependencies</h2>
              {view.externalDependencies.length === 0 ? (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">None detected.</p>
              ) : (
                <ul className="mt-2 space-y-2.5 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm dark:border-slate-700/70 dark:bg-slate-900">
                  {view.externalDependencies.map((dep) => (
                    <li key={dep.specifier}>
                      <div className="flex justify-between gap-2">
                        <span className="truncate font-mono text-xs text-slate-700 dark:text-slate-200" title={dep.specifier}>
                          {dep.specifier}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">{dep.referenceCount}</span>
                      </div>
                      <div className="mt-1">
                        <MeterBar value={dep.referenceCount} max={maxExternal} className="bg-indigo-400" />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function EdgeChips({ items }: { items: { name: string; weight: number }[] }) {
  if (items.length === 0) return <span>—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span
          key={item.name}
          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          {`${item.name} (${item.weight})`}
        </span>
      ))}
    </span>
  );
}
