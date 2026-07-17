import type { ReactNode } from "react";
import clsx from "clsx";
import styles from "./Chip.module.css";

type Tone = "live" | "final" | "upcoming" | "accent" | "gold";

interface ChipProps {
  tone: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

export function Chip({ tone, dot = false, children, className }: ChipProps) {
  return (
    <span className={clsx(styles.chip, styles[`tone-${tone}`], className)}>
      {dot && (
        <span className={clsx(styles.dot, tone === "live" && styles.pulse)} aria-hidden="true" />
      )}
      {children}
    </span>
  );
}
