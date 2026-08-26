

const AUTO_SCAN_STORAGE_KEY = "codebase-engineer.autoScanOnRegister";

export function getAutoScanOnRegister(): boolean {
  try {
    const raw = window.localStorage.getItem(AUTO_SCAN_STORAGE_KEY);

    return raw === null ? true : raw === "true";
  } catch {
    return true;
  }
}

export function setAutoScanOnRegister(value: boolean): void {
  try {
    window.localStorage.setItem(AUTO_SCAN_STORAGE_KEY, String(value));
  } catch {

  }
}
