import styles from "./LiveState.module.css";

interface LiveStateProps {
  leagueName: string;
}

export function LiveState({ leagueName }: LiveStateProps) {
  return (
    <div className={styles.content}>
      <p className={styles.eyebrow}>
        <span className={styles.liveDot} aria-hidden="true" />
        {leagueName ? `${leagueName} · ` : ""}DYNASTY · SEASON 2026
      </p>
      <h1 className={styles.headline}>WE ARE LIVE</h1>
      <p className={styles.subline}>The season starts now.</p>
      <button
        type="button"
        className={styles.button}
        onClick={() => window.location.reload()}
      >
        Enter the league →
      </button>
    </div>
  );
}
