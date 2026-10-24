import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:4000",
    },
  },
  build: {
    rollupOptions: {
      output: {
        // `recharts` (added for the Dashboard's real-data charts) pulls in
        // d3 internals and is the single biggest contributor to bundle
        // size — splitting it into its own chunk means every other page
        // (which never imports Charts.tsx) doesn't pay for it on first
        // load.
        // Function form: Vite 8 (Rolldown) rejects the object form of
        // `manualChunks`. Also pulls in recharts' d3/victory-vendor deps so
        // the chunk matches what the old object form produced.
        manualChunks(id: string) {
          if (/node_modules\/(recharts|d3-[^/]+|victory-vendor|internmap)\//.test(id)) {
            return "charts";
          }
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/setupTests.ts"],
  },
});
