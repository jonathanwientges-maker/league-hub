import type { PickRaceGroup } from "../../domain/pickPlacement";
import type { Team } from "../../domain/types";
import { Card } from "../common/Card";
import { Avatar } from "../common/Avatar";
import { GameCard } from "./GameCard";
import styles from "./PickRaceGroupBracket.module.css";

interface PickRaceGroupBracketProps {
  group: PickRaceGroup;
  picks: [string, string, string]; // e.g. ["1.01", "1.02", "1.03"]
  teamsById: Map<number, Team>;
}

export function PickRaceGroupBracket({ group, picks, teamsById }: PickRaceGroupBracketProps) {
  const semi = group.games.find((g) => g.id === "SEMI")!;
  const final = group.games.find((g) => g.id === "FINAL")!;
  const byeTeam = teamsById.get(group.byeRosterId);

  const finalWinner = final.winnerRosterId;
  const finalLoser =
    finalWinner !== null
      ? ("rosterId" in final.home && final.home.rosterId === finalWinner
          ? ("rosterId" in final.away ? final.away.rosterId : null)
          : ("rosterId" in final.home ? final.home.rosterId : null))
      : null;
  const semiLoser =
    semi.winnerRosterId !== null
      ? ("rosterId" in semi.home && semi.home.rosterId === semi.winnerRosterId
          ? ("rosterId" in semi.away ? semi.away.rosterId : null)
          : ("rosterId" in semi.home ? semi.home.rosterId : null))
      : null;

  const [pick1, pick2, pick3] = picks;
  const pickAssignments: Array<{ pick: string; rosterId: number | null; gold: boolean }> = [
    { pick: pick1, rosterId: finalWinner, gold: pick1 === "1.01" },
    { pick: pick2, rosterId: finalLoser, gold: false },
    { pick: pick3, rosterId: semiLoser, gold: false },
  ];

  return (
    <div className={styles.wrap}>
      <Card className={styles.byeCard}>
        <Avatar url={byeTeam?.avatarUrl ?? null} name={byeTeam?.teamName ?? "?"} size={28} />
        <span className={styles.byeName}>{byeTeam?.teamName ?? "Unknown"}</span>
        <span className={styles.byeBadge} title="Best actual regular-season record in this group">
          BYE — BEST RECORD
        </span>
      </Card>

      <Card>
        <GameCard
          label="Semifinal"
          home={semi.home}
          away={semi.away}
          homeScore={semi.homeScore}
          awayScore={semi.awayScore}
          winnerRosterId={semi.winnerRosterId}
          status={semi.status}
          teamsById={teamsById}
          pairingFoundInSleeper={semi.pairingFoundInSleeper}
        />
      </Card>

      <Card>
        <GameCard
          label="Final — win for the better pick!"
          home={final.home}
          away={final.away}
          homeScore={final.homeScore}
          awayScore={final.awayScore}
          winnerRosterId={final.winnerRosterId}
          status={final.status}
          teamsById={teamsById}
          pairingFoundInSleeper={final.pairingFoundInSleeper}
        />
      </Card>

      <div className={styles.pickRow}>
        {pickAssignments.map(({ pick, rosterId, gold }) => (
          <div key={pick} className={`${styles.pickChip} ${gold ? styles.pickChipGold : ""}`}>
            <div className={styles.pickNumber}>{pick}</div>
            <div className={styles.pickTeam}>
              {rosterId !== null ? teamsById.get(rosterId)?.teamName ?? "Unknown" : "TBD"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
