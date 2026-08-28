# Codebase Engineer — Frontend

The React + TypeScript + Vite + Tailwind single-page app for Codebase
Engineer: Dashboard, Repositories, Architecture explorer, Findings, Tests,
Audit, AI Mode configuration, and Billing/Settings.

This folder is its own git repository, separate from the project root and
from `../backend/` — see the root [`README.md`](../README.md#version-control-layout)
for why. This file only covers working inside this folder.

## Requirements

Node.js 18+. A running backend to talk to — either `../backend`'s dev
server (`npm run dev`, http://localhost:4000) via this project's Vite dev
proxy, or the packaged single-process build.

## Setup

```bash
npm install
```

## Scripts

```bash
npm run dev       # start the Vite dev server, http://localhost:5173 (proxies /api to the backend)
npm run build      # tsc -b, then vite build → dist/
npm run preview     # serve the production build locally, for a final check before packaging
npm test              # vitest run — the full frontend test suite
```

`npm run build`'s output (`dist/`) is what `backend`'s own build copies
into itself to serve as a single process.

## Layout

```
src/
  components/   Shared UI shell (NavShell — the top-level navigation)
  context/      React context providers (current-project selection, persisted across pages)
  lib/          api.ts (thin typed fetch wrapper around the backend's /api/v1/* routes), types.ts
  pages/        One component per top-level route: Dashboard, Repositories, Architecture,
                Findings, Tests, Audit, AiMode, Billing (served at /settings), Placeholder
  App.tsx       Route table (react-router-dom)
  main.tsx      Entry point
  setupTests.ts Vitest + Testing Library setup
```

Every `pages/*.tsx` file has a co-located `*.test.tsx` — React Testing
Library, mocking `lib/api.ts` per test rather than hitting a real network
call, following the conventions in `pages/AiMode.test.tsx`/`Billing.test.tsx`.

## Conventions worth knowing before adding a page

- AI-Mode-gated actions are always visibly rendered, not hidden, with an
  explanation of why they're disabled (no configured/enabled provider,
  over the optional billing usage limit, etc.) — never a silent no-op.
- Every AI action button fires only on an explicit user click; nothing
  calls an AI provider automatically on page load.
- API errors surface via `ApiError` (`lib/api.ts`) and are rendered as
  plain text, not swallowed.
- Styling is Tailwind utility classes directly in JSX, no separate
  stylesheet per component; see any existing page for the established
  spacing/color conventions (e.g. `rounded border border-slate-200 bg-white p-4`
  containers, `disabled:opacity-50` busy-state buttons).

## Testing

```bash
npm test
```

Tests live beside the code they cover.
