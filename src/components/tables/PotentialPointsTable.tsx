import type { Team } from "../../domain/types";
import { sortByPotentialPointsAscending } from "../../domain/pickPlacement";
import { Avatar } from "../common/Avatar";
import styles from "./PotentialPointsTable.module.css";

interface PotentialPointsTableProps {
  teams: Team[]; // the 6 non-playoff teams
}

function TeamRow({ team }: { team: Team }) {
  const effPct = team.potentialPointsTotal > 0 ? Math.round((team.pointsFor / team.potentialPointsTotal) * 100) : 0;
  return (
    <tr>
      <td>
        <div className={styles.teamCell}>
          <Avatar url={team.avatarUrl} name={team.teamName} size={24} />
          <span className={styles.teamName}>{team.teamName}</span>
        </div>
      </td>
      <td className={`${styles.numeric} tabular-nums`}>
        {team.wins}-{team.losses}-{team.ties}
      </td>
      <td className={`${styles.numeric} tabular-nums`}>{team.pointsFor.toFixed(1)}</td>
      <td className={`${styles.numeric} tabular-nums`}>{team.potentialPointsTotal.toFixed(1)}</td>
      <td className={`${styles.numeric} tabular-nums`}>{effPct}%</td>
    </tr>
  );
}

/** Sorted worst-PP-first; the 3 lowest (Group A) and 3 highest (Group B) are visually grouped. */
export function PotentialPointsTable({ teams }: PotentialPointsTableProps) {
  const sorted = sortByPotentialPointsAscending(teams);
  const groupA = sorted.slice(0, 3);
  const groupB = sorted.slice(3, 6);

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Team</th>
          <th className={styles.numeric}>Record</th>
          <th className={styles.numeric}>Actual PF</th>
          <th className={styles.numeric}>Potential Points</th>
          <th className={styles.numeric}>Eff%</th>
        </tr>
      </thead>
      <tbody>
        <tr className={styles.groupHeaderRow}>
          <td colSpan={5}>Pick 1.01 Bracket — lowest Potential Points</td>
        </tr>
        {groupA.map((team) => (
          <TeamRow key={team.rosterId} team={team} />
        ))}
        <tr className={styles.groupHeaderRow}>
          <td colSpan={5}>Pick 1.04 Bracket</td>
        </tr>
        {groupB.map((team) => (
          <TeamRow key={team.rosterId} team={team} />
        ))}
      </tbody>
    </table>
  );
}
