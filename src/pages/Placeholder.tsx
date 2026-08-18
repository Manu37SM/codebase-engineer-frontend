interface PlaceholderPageProps {
  title: string;
  note?: string;
}

export default function PlaceholderPage({ title, note }: PlaceholderPageProps) {
  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-500">
        {note ??
          "Not implemented yet. This section is part of the Phase 0 scaffold; see /docs/ROADMAP.md for the phase that implements it."}
      </p>
    </div>
  );
}
