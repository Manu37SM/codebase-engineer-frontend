import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useProjects } from "../context/ProjectContext";
import { getArchitecture } from "../lib/api";
import type { ArchitectureView } from "../lib/types";

const DEPTH_OPTIONS = [1, 2, 3] as const;

export default function ArchitecturePage() {
  const { selectedProject } = useProjects();
  const [depth, setDepth] = useState<number>(2);
  const [view, setView] = useState<ArchitectureView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (!selectedProject) {
    return (
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Architecture</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          No repository selected yet. Go to{" "}
          <Link to="/repositories" className="underline">
            Repositories
          </Link>{" "}
          to register and scan one.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Architecture</h1>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-slate-500">Depth</span>
          {DEPTH_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDepth(d)}
              className={`rounded px-2 py-1 font-medium ${
                depth === d ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Files are grouped into modules by directory (depth {depth}). This is an aggregated summary,
        not a raw per-file graph — increase depth for a finer-grained module breakdown.
      </p>

      {loading && <p className="mt-4 text-sm text-slate-500">Loading…</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {!loading && !error && view?.empty && (
        <p className="mt-4 text-sm text-slate-500">
          This repository hasn't been indexed yet. Go to{" "}
          <Link to="/repositories" className="underline">
            Repositories
          </Link>{" "}
          and click Scan.
        </p>
      )}

      {!loading && !error && view && !view.empty && (
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <table className="w-full border-collapse overflow-hidden rounded border border-slate-200 bg-white text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-3 py-2 font-medium">Module</th>
                  <th className="px-3 py-2 font-medium">Files</th>
                  <th className="px-3 py-2 font-medium">Tests</th>
                  <th className="px-3 py-2 font-medium">LOC</th>
                  <th className="px-3 py-2 font-medium">Depends on</th>
                  <th className="px-3 py-2 font-medium">Used by</th>
                </tr>
              </thead>
              <tbody>
                {view.nodes.map((node) => (
                  <tr key={node.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 font-mono text-xs text-slate-900">{node.id}</td>
                    <td className="px-3 py-2 text-slate-700">{node.fileCount}</td>
                    <td className="px-3 py-2 text-slate-700">{node.testFileCount}</td>
                    <td className="px-3 py-2 text-slate-700">{node.totalLoc}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {(edgesByModule.outgoing.get(node.id) ?? [])
                        .map((e) => `${e.to} (${e.weight})`)
                        .join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {(edgesByModule.incoming.get(node.id) ?? [])
                        .map((e) => `${e.from} (${e.weight})`)
                        .join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-slate-900">External dependencies</h2>
            {view.externalDependencies.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">None detected.</p>
            ) : (
              <ul className="mt-2 space-y-1 rounded border border-slate-200 bg-white p-3 text-sm">
                {view.externalDependencies.map((dep) => (
                  <li key={dep.specifier} className="flex justify-between">
                    <span className="font-mono text-xs text-slate-700">{dep.specifier}</span>
                    <span className="text-slate-500">{dep.referenceCount}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
