import type { ReactNode } from "react";
import { usePushNotifications } from "../../push/usePushNotifications";
import { BellIcon } from "./icons";
import styles from "./NotificationToggle.module.css";

export function NotificationToggle({ rosterId }: { rosterId: number | null }) {
  const { status, error, enable, disable } = usePushNotifications(rosterId);

  let content: ReactNode = null;
  if (status === "needs-install") {
    content = (
      <p className={styles.hint}>
        Push-Benachrichtigungen gibt es nur in der installierten App: In Safari „Teilen“ → „Zum
        Home-Bildschirm“ und die App von dort öffnen.
      </p>
    );
  } else if (status === "denied") {
    content = (
      <p className={styles.hint}>
        Benachrichtigungen sind blockiert. Bitte in den Browser- bzw. System-Einstellungen erlauben.
      </p>
    );
  } else if (status === "off") {
    content = (
      <div className={styles.row}>
        <span className={styles.rowIcon}><BellIcon size={20} /></span>
        <div className={styles.rowText}>
          <span className={styles.rowTitle}>Benachrichtigungen</span>
          <span className={styles.subline}>Pressekonferenz, letzter Aufruf, Pressespiegel</span>
        </div>
        <button type="button" className={styles.primary} onClick={enable}>
          Aktivieren
        </button>
      </div>
    );
  } else if (status === "on") {
    content = (
      <div className={styles.row}>
        <span className={`${styles.rowIcon} ${styles.rowIconOn}`}><BellIcon size={20} /></span>
        <div className={styles.rowText}>
          <span className={styles.rowTitle}>Benachrichtigungen aktiv</span>
          <span className={styles.subline}>Pressekonferenz, letzter Aufruf, Pressespiegel</span>
        </div>
        <button type="button" className={styles.secondary} onClick={disable}>
          Deaktivieren
        </button>
      </div>
    );
  }

  if (!content && !error) return null;

  return (
    <div className={styles.wrap}>
      {content}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
