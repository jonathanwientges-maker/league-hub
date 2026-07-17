import clsx from "clsx";
import type { DivisionStanding } from "../../domain/standings";
import { Avatar } from "../common/Avatar";
import styles from "./DivisionTable.module.css";

interface DivisionTableProps {
  title: string;
  standings: DivisionStanding[];
}

export function DivisionTable({ title, standings }: DivisionTableProps) {
  return (
    <div>
      <h3>{title}</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>Team</th>
            <th className={styles.numeric}>W-L-T</th>
            <th className={styles.numeric}>PF</th>
            <th className={styles.numeric}>PA</th>
            <th className={styles.numeric}>PP</th>
            <th className={styles.numeric}>Eff%</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((standing) => {
            const { team } = standing;
            const effPct = Math.min(100, Math.round((team.pointsFor / Math.max(1, team.potentialPointsTotal)) * 100));
            return (
              <tr
                key={team.rosterId}
                className={clsx(
                  standing.isPlayoffPosition ? styles.playoffRow : styles.pickRaceRow
                )}
              >
                <td>{standing.rank}</td>
                <td>
                  <div className={styles.teamCell}>
                    <Avatar url={team.avatarUrl} name={team.teamName} size={24} />
                    <span className={styles.teamName}>{team.teamName}</span>
                  </div>
                </td>
                <td className={clsx(styles.numeric, "tabular-nums")}>
                  {team.wins}-{team.losses}-{team.ties}
                </td>
                <td className={clsx(styles.numeric, "tabular-nums")}>{team.pointsFor.toFixed(1)}</td>
                <td className={clsx(styles.numeric, "tabular-nums")}>{team.pointsAgainst.toFixed(1)}</td>
                <td className={clsx(styles.numeric, "tabular-nums")}>{team.potentialPointsTotal.toFixed(1)}</td>
                <td className={styles.numeric}>
                  <span className={styles.effWrap}>
                    <span className="tabular-nums">{effPct}%</span>
                    <span className={styles.effBar}>
                      <span className={styles.effBarFill} style={{ width: `${effPct}%` }} />
                    </span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
