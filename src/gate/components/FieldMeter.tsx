import { useEffect, useState } from "react";
import { CAMPAIGN_START_UTC, RELEASE_DATE_UTC } from "../../config/release";
import { computeFieldPosition } from "../fieldPosition";
import styles from "./FieldMeter.module.css";

const YARD_MARKS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

function FootballMarker() {
  return (
    <svg viewBox="0 0 24 14" className={styles.ball} aria-hidden="true">
      <ellipse cx="12" cy="7" rx="11" ry="6.5" fill="var(--gold)" />
      <line x1="4" y1="7" x2="20" y2="7" stroke="var(--night)" strokeWidth="1" />
      <line x1="9" y1="4.5" x2="9" y2="9.5" stroke="var(--night)" strokeWidth="1" />
      <line x1="15" y1="4.5" x2="15" y2="9.5" stroke="var(--night)" strokeWidth="1" />
    </svg>
  );
}

export function FieldMeter() {
  const startMs = Date.parse(CAMPAIGN_START_UTC);
  const releaseMs = Date.parse(RELEASE_DATE_UTC);
  const finalFraction = computeFieldPosition(Date.now(), startMs, releaseMs);

  // Eases to position once on mount, no looping — starts at 0 and animates
  // to the real fraction via a CSS transition on `left`.
  const [fraction, setFraction] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setFraction(finalFraction));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const yardsOut = Math.round((1 - finalFraction) * 100);

  return (
    <div className={styles.wrap}>
      <p className={styles.label}>DRIVE TO LAUNCH</p>
      <div className={styles.track}>
        <div className={styles.endzone} aria-hidden="true">
          <span>LAUNCH</span>
        </div>
        {YARD_MARKS.map((yard) => (
          <div key={yard} className={styles.yardLine} style={{ left: `${yard}%` }}>
            <span className={styles.yardNumber}>{yard === 100 ? "" : yard}</span>
          </div>
        ))}
        <div className={styles.marker} style={{ left: `${fraction * 100}%` }}>
          <FootballMarker />
        </div>
      </div>
      <p className={styles.caption}>DRIVE TO LAUNCH — {yardsOut} yards out</p>
    </div>
  );
}
