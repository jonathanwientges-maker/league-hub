import type { ReactNode } from "react";
import { usePushNotifications } from "../../push/usePushNotifications";
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
      <>
        <button type="button" className={styles.button} onClick={enable}>
          🔔 Benachrichtigungen aktivieren
        </button>
        <p className={styles.subline}>Pressekonferenz, letzter Aufruf, Pressespiegel</p>
      </>
    );
  } else if (status === "on") {
    content = (
      <>
        <span>🔔 Benachrichtigungen aktiv</span>{" "}
        <button type="button" className={styles.button} onClick={disable}>
          Deaktivieren
        </button>
      </>
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
