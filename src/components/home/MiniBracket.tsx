import clsx from "clsx";
import type { Team } from "../../domain/types";
import type { PlayoffBracket } from "../../domain/playoffBracket";
import type { PickRaceGroup, PickRaceResult } from "../../domain/pickPlacement";
import { Avatar } from "../common/Avatar";
import styles from "./MiniBracket.module.css";

type Slot = { rosterId: number } | { from: string; gameId: string };

interface MiniGameProps {
  home: Slot;
  away: Slot;
  winnerRosterId: number | null;
  teamsById: Map<number, Team>;
  bye?: boolean;
}

function MiniSlot({
  slot,
  winnerRosterId,
  teamsById,
}: {
  slot: Slot;
  winnerRosterId: number | null;
  teamsById: Map<number, Team>;
}) {
  if (!("rosterId" in slot)) return <span className={styles.empty} aria-hidden="true" />;
  const team = teamsById.get(slot.rosterId);
  return (
    <span
      className={clsx(
        styles.slot,
        winnerRosterId !== null && winnerRosterId === slot.rosterId && styles.winner,
        winnerRosterId !== null && winnerRosterId !== slot.rosterId && styles.loser
      )}
      title={team?.teamName}
    >
      <Avatar url={team?.avatarUrl ?? null} name={team?.teamName ?? "?"} size={22} />
    </span>
  );
}

function MiniGame({ home, away, winnerRosterId, teamsById }: MiniGameProps) {
  return (
    <div className={styles.game}>
      <MiniSlot slot={home} winnerRosterId={winnerRosterId} teamsById={teamsById} />
      <MiniSlot slot={away} winnerRosterId={winnerRosterId} teamsById={teamsById} />
    </div>
  );
}

/** Wildcard -> semifinal -> final, logos only. Third-place/consolation games are left out. */
export function MiniPlayoffBracket({
  bracket,
  teamsById,
}: {
  bracket: PlayoffBracket;
  teamsById: Map<number, Team>;
}) {
  const game = (id: string) => bracket.games.find((g) => g.id === id)!;
  const column = (ids: string[]) =>
    ids.map((id) => {
      const g = game(id);
      return (
        <MiniGame
          key={id}
          home={g.home}
          away={g.away}
          winnerRosterId={g.winnerRosterId}
          teamsById={teamsById}
        />
      );
    });

  return (
    <div className={styles.bracket} role="img" aria-label="Playoff bracket">
      <div className={styles.col}>{column(["W1", "W2"])}</div>
      <div className={styles.gap} />
      <div className={styles.col}>{column(["S1", "S2"])}</div>
      <div className={styles.joinPair} />
      <div className={clsx(styles.col, styles.colCenter)}>{column(["FINAL"])}</div>
    </div>
  );
}

function MiniPickGroup({
  group,
  label,
  teamsById,
}: {
  group: PickRaceGroup;
  label: string;
  teamsById: Map<number, Team>;
}) {
  const semi = group.games.find((g) => g.id === "SEMI")!;
  const final = group.games.find((g) => g.id === "FINAL")!;
  return (
    <div className={styles.pickGroup}>
      <div className={styles.pickLabel}>{label}</div>
      <div className={styles.pickBracket}>
        <div className={styles.pickSemi}>
          <MiniGame
            home={semi.home}
            away={semi.away}
            winnerRosterId={semi.winnerRosterId}
            teamsById={teamsById}
          />
        </div>
        <div className={styles.stub} />
        <MiniGame
          home={final.home}
          away={final.away}
          winnerRosterId={final.winnerRosterId}
          teamsById={teamsById}
        />
      </div>
    </div>
  );
}

/** Both pick-race brackets side by side: semi feeds the final's second seat, the bye team starts in the final. */
export function MiniPickRaceBrackets({
  pickRace,
  teamsById,
}: {
  pickRace: PickRaceResult;
  teamsById: Map<number, Team>;
}) {
  return (
    <div className={styles.pickWrap} role="img" aria-label="Pick race brackets">
      <MiniPickGroup group={pickRace.groupA} label="1.01–1.03" teamsById={teamsById} />
      <MiniPickGroup group={pickRace.groupB} label="1.04–1.06" teamsById={teamsById} />
    </div>
  );
}
