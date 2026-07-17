import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { CountdownParts } from "../../domain/countdown";
import styles from "./Scoreboard.module.css";

function pad2(n: number): string {
  return String(Math.max(0, Math.min(99, n))).padStart(2, "0");
}

function DigitCell({ digit }: { digit: string }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className={styles.cell}>
      <div className={styles.seam} aria-hidden="true" />
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={digit}
          className={styles.face}
          initial={shouldReduceMotion ? { opacity: 0 } : { rotateX: -90, opacity: 0.4 }}
          animate={{ rotateX: 0, opacity: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { rotateX: 90, opacity: 0.4 }}
          transition={{
            duration: shouldReduceMotion ? 0.15 : 0.3,
            ease: shouldReduceMotion ? "linear" : "easeIn",
          }}
        >
          {digit}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

function FlapGroup({ value, label }: { value: number; label: string }) {
  const [tens, ones] = pad2(value).split("");
  return (
    <div className={styles.group}>
      <div className={styles.digits}>
        <DigitCell digit={tens} />
        <DigitCell digit={ones} />
      </div>
      <span className={styles.groupLabel}>{label}</span>
    </div>
  );
}

interface ScoreboardProps {
  parts: CountdownParts;
  releaseMs: number;
}

export function Scoreboard({ parts, releaseMs }: ScoreboardProps) {
  const localKickoff = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(releaseMs);

  return (
    <div className={styles.board}>
      <div className={styles.groups}>
        <FlapGroup value={parts.days} label="DAYS" />
        <span className={styles.colon}>:</span>
        <FlapGroup value={parts.hours} label="HRS" />
        <span className={styles.colon}>:</span>
        <FlapGroup value={parts.minutes} label="MIN" />
        <span className={styles.colon}>:</span>
        <FlapGroup value={parts.seconds} label="SEC" />
      </div>
      <p className={styles.kickoffLine}>Kickoff: {localKickoff}</p>
    </div>
  );
}
