import { Fragment, useState } from "react";
import { useParams } from "react-router-dom";
import { useTeamDetail } from "../hooks/useTeamDetail";
import { usePlayoffBracket } from "../hooks/usePlayoffBracket";
import { usePickRace } from "../hooks/usePickRace";
import { useAsPlayedSeasonResult } from "../hooks/useAsPlayedSeasonResult";
import { useSeasonContext, getSeasonMode } from "../context/SeasonContext";
import { ordinal } from "../domain/asPlayed";
import { Chip } from "../components/common/Chip";
import type { SlotAssignment } from "../domain/potentialPoints";
import type { SleeperPlayer } from "../api/types";
import { Avatar } from "../components/common/Avatar";
import { Card } from "../components/common/Card";
import { Skeleton } from "../components/common/Skeleton";
import { ErrorCard } from "../components/common/ErrorCard";
import { Sparkline } from "../components/tables/Sparkline";
import styles from "./Team.module.css";

function playerName(players: Record<string, SleeperPlayer> | undefined, playerId: string | null): string {
  if (!playerId) return "—";
  const player = players?.[playerId];
  return player?.full_name ?? playerId;
}

function LineupColumn({
  title,
  lineup,
  players,
  highlightMissedStarters,
}: {
  title: string;
  lineup: SlotAssignment[];
  players: Record<string, SleeperPlayer> | undefined;
  highlightMissedStarters?: Set<string>;
}) {
  return (
    <div className={styles.lineupColumn}>
      <h4>{title}</h4>
      {lineup.map((slot, i) => {
        const shouldHaveStarted = slot.playerId ? highlightMissedStarters?.has(slot.playerId) : false;
        return (
          <div className={styles.lineupRow} key={`${slot.slot}-${i}`}>
            <span className={styles.slotLabel}>{slot.slot}</span>
            <span className={`${styles.playerName} ${shouldHaveStarted ? styles.shouldHaveStarted : ""}`}>
              {playerName(players, slot.playerId)}
            </span>
            <span className="tabular-nums">{slot.points.toFixed(1)}</span>
          </div>
        );
      })}
    </div>
  );
}

function CustomRulesTeamStatus({ leagueId, rosterId }: { leagueId: string; rosterId: number }) {
  const bracketResult = usePlayoffBracket(leagueId);
  const pickRaceResult = usePickRace(leagueId);

  const seed = bracketResult.bracket?.seeds.find((s) => s.rosterId === rosterId);
  const inGroupA = pickRaceResult.pickRace?.groupA.rosterIds.includes(rosterId);
  const inGroupB = pickRaceResult.pickRace?.groupB.rosterIds.includes(rosterId);
  const label = seed
    ? `Playoff Seed ${seed.seed}`
    : inGroupA
      ? "Pick Race — Group A (1.01–1.03)"
      : inGroupB
        ? "Pick Race — Group B (1.04–1.06)"
        : null;

  return label ? <> · {label}</> : null;
}

function AsPlayedTeamStatus({ leagueId, rosterId }: { leagueId: string; rosterId: number }) {
  const { placements } = useAsPlayedSeasonResult(leagueId);
  const placement = placements?.find((p) => p.rosterId === rosterId);
  if (!placement) return null;
  const label =
    placement.place === 1
      ? "League Champion"
      : placement.place === 2
        ? "Runner-up"
        : `Finished ${ordinal(placement.place)}`;
  return <> · {label}</>;
}

export function Team() {
  const { rosterId } = useParams<{ rosterId: string }>();
  const rosterIdNum = Number(rosterId);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  const { selectedSeason } = useSeasonContext();
  const leagueId = selectedSeason?.leagueId ?? "";
  const isAsPlayed = selectedSeason && getSeasonMode(selectedSeason) === "as-played";
  const { team, weeks, teams, players, isLoading, error } = useTeamDetail(
    leagueId,
    rosterIdNum
  );

  if (error) {
    return <ErrorCard message="Couldn't load this team." />;
  }

  if (isLoading || !team) {
    return (
      <div>
        <Skeleton height={64} width={320} />
        <div className={styles.section}>
          <Skeleton height={300} />
        </div>
      </div>
    );
  }

  const opponentName = (opponentRosterId: number | null) =>
    teams?.find((t) => t.rosterId === opponentRosterId)?.teamName ?? "—";

  return (
    <div>
      <div className={styles.header}>
        <Avatar url={team.avatarUrl} name={team.teamName} size={56} />
        <div className={styles.headerInfo}>
          <h1>{team.teamName}</h1>
          <div className={styles.meta}>
            {team.displayName} · Division {team.division} · {team.wins}-{team.losses}-{team.ties}
            {isAsPlayed ? (
              <AsPlayedTeamStatus leagueId={leagueId} rosterId={rosterIdNum} />
            ) : (
              <CustomRulesTeamStatus leagueId={leagueId} rosterId={rosterIdNum} />
            )}
          </div>
        </div>
      </div>

      {isAsPlayed && (
        <Chip tone="accent" className={styles.retroChip}>
          Retro stat — pick rules did not apply in {selectedSeason.season}
        </Chip>
      )}

      <div className={styles.section}>
        <h2>Season Trend</h2>
        <Card className={styles.card}>
          {weeks && weeks.length > 0 ? (
            <Sparkline points={weeks.map((w) => ({ actual: w.actualPoints, optimal: w.optimalPoints }))} />
          ) : (
            <p>No completed weeks yet.</p>
          )}
        </Card>
      </div>

      <div className={styles.section}>
        <h2>Week by Week</h2>
        <Card className={styles.card}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Week</th>
                <th>Opponent</th>
                <th className={styles.numeric}>Actual</th>
                <th className={styles.numeric}>Optimal</th>
                <th className={styles.numeric}>Bench Lost</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {weeks?.map((week) => {
                const isExpanded = expandedWeek === week.week;
                const optimalIds = new Set(
                  week.optimalLineup.filter((s) => s.playerId).map((s) => s.playerId!)
                );
                const actualIds = new Set(
                  week.actualLineup.filter((s) => s.playerId).map((s) => s.playerId!)
                );
                const shouldHaveStarted = new Set(
                  [...optimalIds].filter((id) => !actualIds.has(id))
                );

                return (
                  <Fragment key={week.week}>
                    <tr
                      className={styles.weekRow}
                      onClick={() => setExpandedWeek(isExpanded ? null : week.week)}
                      aria-expanded={isExpanded}
                    >
                      <td>{week.week}</td>
                      <td>{opponentName(week.opponentRosterId)}</td>
                      <td className={`${styles.numeric} tabular-nums`}>{week.actualPoints.toFixed(1)}</td>
                      <td className={`${styles.numeric} tabular-nums`}>{week.optimalPoints.toFixed(1)}</td>
                      <td className={`${styles.numeric} tabular-nums`}>{week.benchPointsLost.toFixed(1)}</td>
                      <td>{week.result ?? "—"}</td>
                    </tr>
                    {isExpanded && (
                      <tr className={styles.lineupDetail}>
                        <td colSpan={6}>
                          <div className={styles.lineupGrid}>
                            <LineupColumn title="Actual Lineup" lineup={week.actualLineup} players={players} />
                            <LineupColumn
                              title="Optimal Lineup"
                              lineup={week.optimalLineup}
                              players={players}
                              highlightMissedStarters={shouldHaveStarted}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
