import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "theme";
const THEME_COLOR = { dark: "#0b1220", light: "#f4f6fb" } as const;

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* storage can be blocked (private mode) — fall back to system */
  }
  return "system";
}

function systemTheme(): "light" | "dark" {
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/** Sets `data-theme` (tokens.css already honors it) and keeps the browser/PWA
 * chrome color in step. "system" removes the attribute so the OS wins. */
function applyTheme(pref: ThemePreference) {
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
  const resolved = pref === "system" ? systemTheme() : pref;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[resolved]);
}

// Apply as early as the module loads so a saved choice doesn't flash.
if (typeof document !== "undefined") applyTheme(readPreference());

const ORDER: ThemePreference[] = ["system", "light", "dark"];

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);

  useEffect(() => {
    applyTheme(preference);
    if (preference !== "system" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyTheme("system");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [preference]);

  const set = useCallback((next: ThemePreference) => {
    setPreference(next);
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* non-fatal */
    }
  }, []);

  const cycle = useCallback(() => set(ORDER[(ORDER.indexOf(preference) + 1) % ORDER.length]), [preference, set]);

  return { preference, set, cycle };
}
