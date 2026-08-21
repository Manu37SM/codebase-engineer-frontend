/**
 * Small local-only UI preferences — not real user "settings" persisted on
 * the server (this app has no per-user settings table, and doesn't need
 * one for a single toggle), just a `localStorage` flag scoped to this
 * browser. Added alongside the fix for the "registering a repo doesn't
 * take you anywhere" bug: when this is on (the default), registering a
 * repository through any of the Register-a-repository form's tabs
 * (Zip URL/Git URL/GitHub/Google Drive) automatically runs discover+index
 * right after registering, instead of leaving the user to find and click
 * "Scan" themselves.
 */

const AUTO_SCAN_STORAGE_KEY = "codebase-engineer.autoScanOnRegister";

export function getAutoScanOnRegister(): boolean {
  try {
    const raw = window.localStorage.getItem(AUTO_SCAN_STORAGE_KEY);
    // Unset (first run) defaults to on.
    return raw === null ? true : raw === "true";
  } catch {
    return true;
  }
}

export function setAutoScanOnRegister(value: boolean): void {
  try {
    window.localStorage.setItem(AUTO_SCAN_STORAGE_KEY, String(value));
  } catch {
    // localStorage unavailable — the toggle just won't persist across reloads.
  }
}
