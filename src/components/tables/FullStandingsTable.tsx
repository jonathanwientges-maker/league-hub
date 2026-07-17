import { useState } from "react";
import { Link } from "react-router-dom";
import type { Team } from "../../domain/types";
import { Avatar } from "../common/Avatar";
import styles from "./FullStandingsTable.module.css";

interface FullStandingsTableProps {
  teams: Team[];
}

type SortKey = "team" | "division" | "record" | "pointsFor" | "pointsAgainst" | "potentialPoints" | "efficiency";

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "team", label: "Team" },
  { key: "division", label: "Div", numeric: true },
  { key: "record", label: "W-L-T", numeric: true },
  { key: "pointsFor", label: "PF", numeric: true },
  { key: "pointsAgainst", label: "PA", numeric: true },
  { key: "potentialPoints", label: "PP", numeric: true },
  { key: "efficiency", label: "Eff%", numeric: true },
];

function sortValue(team: Team, key: SortKey): number | string {
  switch (key) {
    case "team":
      return team.teamName.toLowerCase();
    case "division":
      return team.division;
    case "record": {
      const games = team.wins + team.losses + team.ties;
      return games === 0 ? 0 : (team.wins + team.ties * 0.5) / games;
    }
    case "pointsFor":
      return team.pointsFor;
    case "pointsAgainst":
      return team.pointsAgainst;
    case "potentialPoints":
      return team.potentialPointsTotal;
    case "efficiency":
      return team.potentialPointsTotal > 0 ? team.pointsFor / team.potentialPointsTotal : 0;
  }
}

export function FullStandingsTable({ teams }: FullStandingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("record");
  const [descending, setDescending] = useState(true);

  const sorted = [...teams].sort((a, b) => {
    const va = sortValue(a, sortKey);
    const vb = sortValue(b, sortKey);
    const cmp = typeof va === "string" ? va.localeCompare(vb as string) : va - (vb as number);
    return descending ? -cmp : cmp;
  });

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setDescending((d) => !d);
    } else {
      setSortKey(key);
      setDescending(true);
    }
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {COLUMNS.map((col) => (
            <th key={col.key} className={col.numeric ? styles.numeric : undefined}>
              <button
                type="button"
                className={styles.sortButton}
                onClick={() => handleSort(col.key)}
                aria-sort={sortKey === col.key ? (descending ? "descending" : "ascending") : "none"}
              >
                {col.label}
                {sortKey === col.key ? (descending ? " ↓" : " ↑") : ""}
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((team) => {
          const effPct = team.potentialPointsTotal > 0 ? Math.round((team.pointsFor / team.potentialPointsTotal) * 100) : 0;
          return (
            <tr key={team.rosterId}>
              <td>
                <Link to={`/team/${team.rosterId}`} className={styles.teamCell}>
                  <Avatar url={team.avatarUrl} name={team.teamName} size={24} />
                  <span className={styles.teamName}>{team.teamName}</span>
                </Link>
              </td>
              <td className={styles.numeric}>{team.division}</td>
              <td className={`${styles.numeric} tabular-nums`}>
                {team.wins}-{team.losses}-{team.ties}
              </td>
              <td className={`${styles.numeric} tabular-nums`}>{team.pointsFor.toFixed(1)}</td>
              <td className={`${styles.numeric} tabular-nums`}>{team.pointsAgainst.toFixed(1)}</td>
              <td className={`${styles.numeric} tabular-nums`}>{team.potentialPointsTotal.toFixed(1)}</td>
              <td className={`${styles.numeric} tabular-nums`}>{effPct}%</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
