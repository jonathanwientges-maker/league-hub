import { Link } from "react-router-dom";
import clsx from "clsx";
import { isMediaDayOpen } from "../../media/schedule";
import { useIdentity } from "../../media/useIdentity";
import { useMediaDayStatus } from "../../media/roomData";
import styles from "./MediaDayBanner.module.css";

export function MediaDayBanner() {
  const open = isMediaDayOpen();
  const { rosterId } = useIdentity();
  const { hasSubmitted, isLoading } = useMediaDayStatus(rosterId);

  if (!open || isLoading) return null;

  if (rosterId === null) {
    return (
      <Link to="/media-room" className={clsx(styles.banner, styles.pulse)}>
        <p className={styles.headline}>🎙️ Die Pressekonferenz läuft!</p>
        <p className={styles.subline}>Akkreditieren Sie sich, um Ihr Statement abzugeben.</p>
        <span className={styles.cta}>Zur Pressekonferenz</span>
      </Link>
    );
  }

  if (hasSubmitted) {
    return (
      <p className={styles.confirmed}>
        ✅ Statement liegt der Redaktion vor. Änderungen bis 24:00 möglich.
      </p>
    );
  }

  return (
    <Link to="/media-room" className={clsx(styles.banner, styles.pulse)}>
      <p className={styles.headline}>🎙️ Du wurdest zur PK geladen!</p>
      <p className={styles.subline}>Die Presse wartet auf dein Statement — bis 24:00 Uhr.</p>
      <span className={styles.cta}>Zur Pressekonferenz</span>
    </Link>
  );
}
