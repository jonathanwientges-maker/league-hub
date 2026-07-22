const STORAGE_KEY = "mediaroom.rosterId";

export function getIdentity(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function setIdentity(rosterId: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(rosterId));
  } catch {
    // localStorage unavailable — identity just won't persist across reloads.
  }
}

export function clearIdentity(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable — nothing to clear.
  }
}
