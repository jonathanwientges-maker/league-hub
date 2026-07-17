import type { Team } from "../../domain/types";
import styles from "./PointsBarChart.module.css";

interface PointsBarChartProps {
  teams: Team[];
}

/**
 * Actual points (solid fill) vs potential points (light track) per team, so
 * "points left on the bench" is the visible gap between fill and track end.
 * One hue throughout — actual/potential are two measures of the same team,
 * not a categorical comparison across teams, so a single accent color plus
 * two opacities is the right encoding (see dataviz skill: meter pattern).
 */
export function PointsBarChart({ teams }: PointsBarChartProps) {
  const sorted = [...teams].sort((a, b) => b.potentialPointsTotal - a.potentialPointsTotal);
  const maxPoints = Math.max(1, ...sorted.map((t) => t.potentialPointsTotal));

  return (
    <div className={styles.chart}>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.actual}`} />
          Actual points
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.potential}`} />
          Potential points (optimal lineup)
        </span>
      </div>
      {sorted.map((team) => {
        const actualPct = Math.min(100, (team.pointsFor / maxPoints) * 100);
        const potentialPct = Math.min(100, (team.potentialPointsTotal / maxPoints) * 100);
        const benchLost = team.potentialPointsTotal - team.pointsFor;
        return (
          <div
            key={team.rosterId}
            className={styles.row}
            title={`${team.teamName} — actual ${team.pointsFor.toFixed(1)}, potential ${team.potentialPointsTotal.toFixed(1)} (${benchLost.toFixed(1)} left on the bench)`}
          >
            <span className={styles.teamLabel}>{team.teamName}</span>
            <div className={styles.barTrack} style={{ width: `${potentialPct}%`, minWidth: "2%" }}>
              <div
                className={`${styles.barFill} tabular-nums`}
                style={{ width: actualPct >= potentialPct - 0.01 ? "100%" : `${(actualPct / potentialPct) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
