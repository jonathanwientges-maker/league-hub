import { useTheme, type ThemePreference } from "../../hooks/useTheme";
import styles from "./ThemeToggle.module.css";

const LABEL: Record<ThemePreference, string> = { system: "Auto", light: "Light", dark: "Dark" };
const GLYPH: Record<ThemePreference, string> = { system: "◐", light: "☀", dark: "☾" };

export function ThemeToggle() {
  const { preference, cycle } = useTheme();
  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={cycle}
      aria-label={`Theme: ${LABEL[preference]}. Tap to change.`}
      title={`Theme: ${LABEL[preference]}`}
    >
      <span aria-hidden="true">{GLYPH[preference]}</span>
    </button>
  );
}

/** Segmented control used inside the "More" sheet. */
export function ThemeSegmented() {
  const { preference, set } = useTheme();
  return (
    <div className={styles.segmented} role="radiogroup" aria-label="Theme">
      {(Object.keys(LABEL) as ThemePreference[]).map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={preference === key}
          className={styles.segment}
          data-active={preference === key}
          onClick={() => set(key)}
        >
          {LABEL[key]}
        </button>
      ))}
    </div>
  );
}
