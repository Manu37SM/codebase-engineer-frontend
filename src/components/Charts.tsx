import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalysisRun, FileChurn, FindingRecord, LanguageStat } from "../lib/types";

/**
 * Real-data charts (Task #76) — every chart here is derived directly from
 * data this app already computes and stores; nothing is synthesized or
 * randomly generated for visual effect. Where the underlying data can be
 * honestly unknown (e.g. an analysis run from before the severity-snapshot
 * migration — see backend/src/db/migrations/013_*.sql), the chart shows a
 * gap rather than plotting a fabricated zero, matching this project's
 * "never fabricate" convention elsewhere (test counts, self-review
 * statuses, etc.).
 */

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#dc2626", // red-600
  high: "#ea580c", // orange-600
  medium: "#d97706", // amber-600
  low: "#64748b", // slate-500
};

const SEVERITY_ORDER = ["critical", "high", "medium", "low"] as const;

export function SeverityBreakdownChart({ findings }: { findings: FindingRecord[] }) {
  const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    if (f.severity in counts) counts[f.severity]++;
  }
  const data = SEVERITY_ORDER.map((severity) => ({ severity, count: counts[severity] }));
  const total = findings.length;

  if (total === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No findings from the latest analysis run.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <ResponsiveContainer width={160} height={160}>
        <PieChart>
          <Pie
            data={data.filter((d) => d.count > 0)}
            dataKey="count"
            nameKey="severity"
            innerRadius={35}
            outerRadius={70}
          >
            {data
              .filter((d) => d.count > 0)
              .map((d) => (
                <Cell key={d.severity} fill={SEVERITY_COLORS[d.severity]} />
              ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <ul className="space-y-1 text-sm">
        {data.map((d) => (
          <li key={d.severity} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: SEVERITY_COLORS[d.severity] }}
            />
            <span className="w-16 capitalize text-slate-600 dark:text-slate-300">{d.severity}</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">{d.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FindingsTrendChart({ runs }: { runs: AnalysisRun[] }) {
  const completed = runs.filter((r) => r.status === "completed");
  if (completed.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No completed analysis runs yet — run analysis from the Findings page to start building history.
      </p>
    );
  }

  const hasAnySnapshot = completed.some((r) => r.critical_count !== null);
  if (!hasAnySnapshot) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No runs with a recorded severity snapshot yet (this data started being recorded after this
        feature shipped). Run analysis again to start building trend history.
      </p>
    );
  }

  const data = completed.map((r, i) => ({
    label: `#${i + 1}`,
    date: new Date(r.started_at).toLocaleDateString(),
    critical: r.critical_count,
    high: r.high_count,
    medium: r.medium_count,
    low: r.low_count,
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip
            labelFormatter={(label, payload) => (payload?.[0]?.payload?.date ? `${label} — ${payload[0].payload.date}` : label)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {SEVERITY_ORDER.map((severity) => (
            <Line
              key={severity}
              type="monotone"
              dataKey={severity}
              name={severity}
              stroke={SEVERITY_COLORS[severity]}
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {completed.some((r) => r.critical_count === null) && (
        <p className="mt-1 text-xs text-slate-400">
          Gaps mark runs from before severity history was recorded — shown as missing, not zero.
        </p>
      )}
    </div>
  );
}

export function LanguageBreakdownChart({ languages }: { languages: LanguageStat[] }) {
  if (languages.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No languages detected.</p>;
  }
  const data = [...languages]
    .sort((a, b) => b.fileCount - a.fileCount)
    .slice(0, 8)
    .map((l) => ({ language: l.language, files: l.fileCount }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 28)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="language" width={80} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="files" fill="#0f172a" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ChurnHotspotsChart({ churn }: { churn: FileChurn[] }) {
  if (churn.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No churn in this window.</p>;
  }
  const data = churn.slice(0, 8).map((c) => ({
    path: c.path.length > 28 ? `…${c.path.slice(-27)}` : c.path,
    fullPath: c.path,
    commits: c.commitCount,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 28)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="path" width={140} tick={{ fontSize: 10, fontFamily: "monospace" }} />
        <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.fullPath ?? ""} />
        <Bar dataKey="commits" fill="#334155" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
