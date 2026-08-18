import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

// Raise the default findBy*/waitFor timeout (1000ms) — under this sandbox's
// shared CPU, parallel test workers occasionally push microtask scheduling
// past that default even for promises that resolve within a tick, causing
// intermittent false failures unrelated to component logic.
configure({ asyncUtilTimeout: 5000 });
