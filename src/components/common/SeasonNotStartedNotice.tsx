import styles from "./SeasonNotStartedNotice.module.css";

interface SeasonNotStartedNoticeProps {
  subject: string;
}

/**
 * Placeholder for the playoff bracket / pick race before Week 1 has any
 * real matchup data — showing a computed bracket off an all-0-0-0 season
 * is meaningless (every team is tied), so this replaces it until there's
 * real data to seed from.
 */
export function SeasonNotStartedNotice({ subject }: SeasonNotStartedNoticeProps) {
  return (
    <div className={styles.notice}>
      <p className={styles.message}>{subject} will appear once Week 1 has been played.</p>
      <p className={styles.subnote}>
        This updates automatically after each week — no need to check back manually.
      </p>
    </div>
  );
}
