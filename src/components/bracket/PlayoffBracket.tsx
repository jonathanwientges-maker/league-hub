import { motion, useReducedMotion } from "framer-motion";
import type { PlayoffBracket as PlayoffBracketData, BracketGame } from "../../domain/playoffBracket";
import { isTeamRef } from "../../domain/playoffBracket";
import type { Team } from "../../domain/types";
import { GameCard } from "./GameCard";
import styles from "./PlayoffBracket.module.css";

interface PlayoffBracketProps {
  bracket: PlayoffBracketData;
  teamsById: Map<number, Team>;
}

// Fixed-grid percentage coordinates (see Step 6.4's "fixed grid is simpler
// and acceptable" note) — these line up with the CSS grid's 4 equal rows.
const W1_Y = 25;
const W2_Y = 75;
const S1_Y = 25;
const S2_Y = 75;
const FINAL_Y = 50;
const BYE_STUB_X = 8;
const COL1_RIGHT_X = 31;
const COL2_LEFT_X = 35;
const COL2_RIGHT_X = 65;
const COL3_LEFT_X = 69;

interface Connector {
  id: string;
  path: string;
  tone: "gold" | "accent" | "dim";
}

function curve(x1: number, y1: number, x2: number, y2: number): string {
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${midX} ${y1} ${midX} ${y2} ${x2} ${y2}`;
}

/** Which of S1/S2's resolved seats (if any) this rosterId occupies, for tracing a connector's destination. */
function destinationY(rosterId: number, s1: BracketGame, s2: BracketGame): number | null {
  const inGame = (g: BracketGame) =>
    (isTeamRef(g.home) && g.home.rosterId === rosterId) ||
    (isTeamRef(g.away) && g.away.rosterId === rosterId);
  if (inGame(s1)) return S1_Y;
  if (inGame(s2)) return S2_Y;
  return null;
}

function computeConnectors(bracket: PlayoffBracketData): Connector[] {
  const w1 = bracket.games.find((g) => g.id === "W1")!;
  const w2 = bracket.games.find((g) => g.id === "W2")!;
  const s1 = bracket.games.find((g) => g.id === "S1")!;
  const s2 = bracket.games.find((g) => g.id === "S2")!;
  const final = bracket.games.find((g) => g.id === "FINAL")!;

  const championId = final.winnerRosterId;
  const isChampionPath = (rosterId: number | null) => rosterId !== null && rosterId === championId;

  const connectors: Connector[] = [];

  const seed1 = bracket.seeds.find((s) => s.seed === 1)?.rosterId ?? null;
  const seed2 = bracket.seeds.find((s) => s.seed === 2)?.rosterId ?? null;

  for (const [id, rosterId] of [
    ["bye1", seed1],
    ["bye2", seed2],
  ] as const) {
    if (rosterId === null) continue;
    const y = destinationY(rosterId, s1, s2);
    if (y === null) continue;
    connectors.push({
      id,
      path: curve(BYE_STUB_X, y, COL2_LEFT_X, y),
      tone: isChampionPath(rosterId) ? "gold" : "accent",
    });
  }

  for (const [id, game, sourceY] of [
    ["w1", w1, W1_Y],
    ["w2", w2, W2_Y],
  ] as const) {
    const winnerId = game.winnerRosterId;
    const destY = winnerId !== null ? destinationY(winnerId, s1, s2) : null;
    connectors.push({
      id,
      path: curve(COL1_RIGHT_X, sourceY, COL2_LEFT_X, destY ?? sourceY),
      tone: destY !== null ? (isChampionPath(winnerId) ? "gold" : "accent") : "dim",
    });
  }

  for (const [id, game, sourceY] of [
    ["s1", s1, S1_Y],
    ["s2", s2, S2_Y],
  ] as const) {
    connectors.push({
      id: `${id}-final`,
      path: curve(COL2_RIGHT_X, sourceY, COL3_LEFT_X, FINAL_Y),
      tone: game.winnerRosterId !== null ? (isChampionPath(game.winnerRosterId) ? "gold" : "accent") : "dim",
    });
  }

  return connectors;
}

function ConnectorLayer({ bracket }: { bracket: PlayoffBracketData }) {
  const shouldReduceMotion = useReducedMotion();
  const connectors = computeConnectors(bracket);

  return (
    <svg className={styles.connectorLayer} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {connectors.map((c, i) => (
        <motion.path
          key={c.id}
          d={c.path}
          fill="none"
          stroke={
            c.tone === "gold" ? "var(--gold)" : c.tone === "accent" ? "var(--accent)" : "var(--line)"
          }
          strokeWidth={c.tone === "gold" ? 0.6 : 0.4}
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: shouldReduceMotion ? 1 : 0, opacity: c.tone === "dim" ? 0.5 : 1 }}
          animate={{ pathLength: 1, opacity: c.tone === "dim" ? 0.5 : 1 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.6, delay: shouldReduceMotion ? 0 : i * 0.08, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </svg>
  );
}

function gameById(bracket: PlayoffBracketData, id: string): BracketGame {
  return bracket.games.find((g) => g.id === id)!;
}

export function PlayoffBracket({ bracket, teamsById }: PlayoffBracketProps) {
  const w1 = gameById(bracket, "W1");
  const w2 = gameById(bracket, "W2");
  const s1 = gameById(bracket, "S1");
  const s2 = gameById(bracket, "S2");
  const final = gameById(bracket, "FINAL");

  const seed1 = bracket.seeds.find((s) => s.seed === 1)?.rosterId;
  const seed2 = bracket.seeds.find((s) => s.seed === 2)?.rosterId;
  const isBye = (game: BracketGame, side: "home" | "away", rosterId: number | undefined) =>
    isTeamRef(game[side]) && (game[side] as { rosterId: number }).rosterId === rosterId;

  return (
    <div className={styles.wrap}>
      <div className={styles.columnHeaders}>
        <span>Wildcard</span>
        <span>Semifinals</span>
        <span>Championship</span>
      </div>
      <div className={styles.grid}>
        <ConnectorLayer bracket={bracket} />

        <div className={styles.round}>
          <span className={styles.roundLabel}>Wildcard</span>
          <div className={styles.roundCards}>
            <GameCard
              label="Wildcard · W1"
              className={styles.w1}
              home={w1.home}
              away={w1.away}
              homeScore={w1.homeScore}
              awayScore={w1.awayScore}
              winnerRosterId={w1.winnerRosterId}
              status={w1.status}
              teamsById={teamsById}
              pairingFoundInSleeper={w1.pairingFoundInSleeper}
            />
            <GameCard
              label="Wildcard · W2"
              className={styles.w2}
              home={w2.home}
              away={w2.away}
              homeScore={w2.homeScore}
              awayScore={w2.awayScore}
              winnerRosterId={w2.winnerRosterId}
              status={w2.status}
              teamsById={teamsById}
              pairingFoundInSleeper={w2.pairingFoundInSleeper}
            />
          </div>
        </div>

        <div className={styles.round}>
          <span className={styles.roundLabel}>Semifinals</span>
          <div className={styles.roundCards}>
            <div className={styles.s1}>
              <GameCard
                label="Semifinal · S1"
                home={s1.home}
                away={s1.away}
                homeScore={s1.homeScore}
                awayScore={s1.awayScore}
                winnerRosterId={s1.winnerRosterId}
                status={s1.status}
                teamsById={teamsById}
                pairingFoundInSleeper={s1.pairingFoundInSleeper}
                byeHome={isBye(s1, "home", seed1) || isBye(s1, "home", seed2)}
                byeAway={isBye(s1, "away", seed1) || isBye(s1, "away", seed2)}
              />
              {s1.reseeded && (
                <span className={styles.reseededTag} title="Best remaining record plays worst remaining record">
                  Reseeded
                </span>
              )}
            </div>
            <div className={styles.s2}>
              <GameCard
                label="Semifinal · S2"
                home={s2.home}
                away={s2.away}
                homeScore={s2.homeScore}
                awayScore={s2.awayScore}
                winnerRosterId={s2.winnerRosterId}
                status={s2.status}
                teamsById={teamsById}
                pairingFoundInSleeper={s2.pairingFoundInSleeper}
                byeHome={isBye(s2, "home", seed1) || isBye(s2, "home", seed2)}
                byeAway={isBye(s2, "away", seed1) || isBye(s2, "away", seed2)}
              />
              {s2.reseeded && (
                <span className={styles.reseededTag} title="Best remaining record plays worst remaining record">
                  Reseeded
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={styles.round}>
          <span className={styles.roundLabel}>Championship</span>
          <div className={styles.roundCards}>
            <GameCard
              label="Championship"
              className={styles.final}
              home={final.home}
              away={final.away}
              homeScore={final.homeScore}
              awayScore={final.awayScore}
              winnerRosterId={final.winnerRosterId}
              status={final.status}
              teamsById={teamsById}
              pairingFoundInSleeper={final.pairingFoundInSleeper}
              goldWinner
            />
          </div>
        </div>
      </div>
    </div>
  );
}
