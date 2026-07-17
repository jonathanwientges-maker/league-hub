import clsx from "clsx";
import type { Team } from "../../domain/types";
import { Avatar } from "../common/Avatar";
import { Chip } from "../common/Chip";
import styles from "./GameCard.module.css";

export interface GameCardParticipant {
  rosterId: number;
  seed?: number | null;
}

export interface GameCardPlaceholder {
  from: "winner" | "loser";
  gameId: string;
}

export type GameCardSide = GameCardParticipant | GameCardPlaceholder;

function isResolved(side: GameCardSide): side is GameCardParticipant {
  return "rosterId" in side;
}

interface GameCardProps {
  label: string;
  home: GameCardSide;
  away: GameCardSide;
  homeScore: number | null;
  awayScore: number | null;
  winnerRosterId: number | null;
  status: "upcoming" | "live" | "final";
  teamsById: Map<number, Team>;
  pairingFoundInSleeper?: boolean;
  byeHome?: boolean;
  byeAway?: boolean;
  goldWinner?: boolean;
  placeholderText?: (side: GameCardPlaceholder) => string;
  className?: string;
}

function defaultPlaceholderText(side: GameCardPlaceholder): string {
  return `${side.from === "winner" ? "Winner" : "Loser"} of ${side.gameId}`;
}

function ParticipantRow({
  side,
  score,
  isWinner,
  isLoser,
  isBye,
  goldWinner,
  teamsById,
  placeholderText,
}: {
  side: GameCardSide;
  score: number | null;
  isWinner: boolean;
  isLoser: boolean;
  isBye?: boolean;
  goldWinner?: boolean;
  teamsById: Map<number, Team>;
  placeholderText: (side: GameCardPlaceholder) => string;
}) {
  if (!isResolved(side)) {
    return <div className={clsx(styles.row, styles.rowGhost)}>{placeholderText(side)}</div>;
  }

  const team = teamsById.get(side.rosterId);

  return (
    <div
      className={clsx(
        styles.row,
        isWinner && (goldWinner ? styles.rowWinnerGold : styles.rowWinner),
        isLoser && styles.rowLoser
      )}
    >
      {side.seed != null && <span className={styles.seedChip}>{side.seed}</span>}
      <Avatar url={team?.avatarUrl ?? null} name={team?.teamName ?? "?"} size={22} />
      <span className={styles.name}>{team?.teamName ?? "Unknown"}</span>
      {isBye && <span className={styles.byeBadge}>BYE</span>}
      {score !== null && <span className={`${styles.score} tabular-nums`}>{score.toFixed(1)}</span>}
    </div>
  );
}

export function GameCard({
  label,
  home,
  away,
  homeScore,
  awayScore,
  winnerRosterId,
  status,
  teamsById,
  pairingFoundInSleeper = true,
  byeHome = false,
  byeAway = false,
  goldWinner = false,
  placeholderText = defaultPlaceholderText,
  className,
}: GameCardProps) {
  const homeIsWinner = isResolved(home) && home.rosterId === winnerRosterId;
  const awayIsWinner = isResolved(away) && away.rosterId === winnerRosterId;

  return (
    <div className={clsx(styles.card, !pairingFoundInSleeper && styles.warning, className)}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <Chip tone={status === "live" ? "live" : status === "final" ? "final" : "upcoming"} dot={status === "live"}>
          {status}
        </Chip>
      </div>
      <ParticipantRow
        side={home}
        score={homeScore}
        isWinner={homeIsWinner}
        isLoser={awayIsWinner}
        isBye={byeHome}
        goldWinner={goldWinner}
        teamsById={teamsById}
        placeholderText={placeholderText}
      />
      <ParticipantRow
        side={away}
        score={awayScore}
        isWinner={awayIsWinner}
        isLoser={homeIsWinner}
        isBye={byeAway}
        goldWinner={goldWinner}
        teamsById={teamsById}
        placeholderText={placeholderText}
      />
      {!pairingFoundInSleeper && (
        <p className={styles.warningNote}>⚠ Pairing not found in Sleeper data</p>
      )}
    </div>
  );
}
