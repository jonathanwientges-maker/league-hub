import type { ReactNode } from "react";
import { usePushNotifications } from "../../push/usePushNotifications";
import { useCountdown } from "../../media/useCountdown";
import { formatBerlinDateTime } from "../../media/berlinTime";
import { BellIcon, CheckIcon } from "./icons";
import styles from "./WaitingCard.module.css";

interface WaitingCardProps {
  icon: ReactNode;
  headline: string;
  target: Date;
  /** How long the wait nominally lasts — only drives the progress bar. */
  windowMs: number;
  rosterId: number | null;
  verb: string;
}

function Reminder({ rosterId }: { rosterId: number | null }) {
  const { status, error, enable } = usePushNotifications(rosterId);
  if (status === "on") {
    return (
      <p className={styles.reminderOn}>
        <CheckIcon size={16} /> Erinnerung aktiv
      </p>
    );
  }
  if (status !== "off") return null;
  return (
    <>
      <button type="button" className={styles.reminder} onClick={enable}>
        <BellIcon size={18} /> Erinnere mich
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </>
  );
}

export function WaitingCard({ icon, headline, target, windowMs, rosterId, verb }: WaitingCardProps) {
  const countdown = useCountdown(target);
  const [h, m, s] = countdown.split(":");
  const progress = Math.min(1, Math.max(0, 1 - (target.getTime() - Date.now()) / windowMs));

  return (
    <div className={styles.card}>
      <span className={styles.icon}>{icon}</span>
      <h2 className={styles.headline}>{headline}</h2>
      <p className={styles.sub}>
        {verb} {formatBerlinDateTime(target)}
      </p>
      <div className={styles.clock} role="timer" aria-label={`Noch ${h} Stunden, ${m} Minuten, ${s} Sekunden`}>
        {[
          [h, "Std"],
          [m, "Min"],
          [s, "Sek"],
        ].map(([value, unit]) => (
          <div key={unit} className={styles.unitBox} aria-hidden="true">
            <span className={styles.num}>{value}</span>
            <span className={styles.unit}>{unit}</span>
          </div>
        ))}
      </div>
      <div className={styles.track} aria-hidden="true">
        <div className={styles.fill} style={{ transform: `scaleX(${progress})` }} />
      </div>
      <Reminder rosterId={rosterId} />
    </div>
  );
}
