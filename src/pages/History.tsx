import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSeasonContext, getSeasonMode } from "../context/SeasonContext";
import { useAsPlayedSeasonResult } from "../hooks/useAsPlayedSeasonResult";
import { useCustomRulesSeasonSummary } from "../hooks/useCustomRulesSeasonSummary";
import { computeAllTimeRecords, type SeasonRecordInput } from "../domain/allTimeRecords";
import type { SeasonRef } from "../domain/seasonChain";
import type { SeasonPlacement } from "../domain/asPlayed";
import type { Team } from "../domain/types";
import { Card } from "../components/common/Card";
import { Avatar } from "../components/common/Avatar";
import { Chip } from "../components/common/Chip";
import { Skeleton } from "../components/common/Skeleton";
import { RevealGroup, RevealItem } from "../components/common/Reveal";
import styles from "./History.module.css";

function findHighestOptimalWeek(teams: Team[]): { team: Team; week: number; points: number } | null {
  let best: { team: Team; week: number; points: number } | null = null;
  for (const team of teams) {
    for (const w of team.weeklyScores) {
      if (!best || w.optimalPoints > best.points) {
        best = { team, week: w.week, points: w.optimalPoints };
      }
    }
  }
  return best;
}

function SeasonHallCardView({
  season,
  teams,
  placements,
  isLoading,
  error,
  isLive,
}: {
  season: SeasonRef;
  teams: Team[] | undefined;
  placements: SeasonPlacement[] | undefined;
  isLoading: boolean;
  error: Error | null;
  isLive: boolean;
}) {
  if (error) {
    return (
      <Card className={styles.card}>
        <p className={styles.emptyState}>Couldn't load {season.season}.</p>
      </Card>
    );
  }

  if (isLoading || !teams || !placements) {
    return <Skeleton height={220} />;
  }

  // Placements are computed off the current (possibly projected/in-progress)
  // bracket — a champion/runner-up/3rd claim is only real once Sleeper
  // marks the season complete, so those badges are withheld until then.
  // The all-time career-record/points stats below are fine to show live,
  // since they're not claiming anything is final.
  const isComplete = season.status === "complete";
  const teamsById = new Map(teams.map((t) => [t.rosterId, t]));
  const champion = isComplete ? placements.find((p) => p.place === 1) : undefined;
  const runnerUp = isComplete ? placements.find((p) => p.place === 2) : undefined;
  const third = isComplete ? placements.find((p) => p.place === 3) : undefined;

  const bestRecord = [...teams].sort(
    (a, b) =>
      b.wins / Math.max(1, b.wins + b.losses + b.ties) -
      a.wins / Math.max(1, a.wins + a.losses + a.ties)
  )[0];
  const pointsLeader = [...teams].sort((a, b) => b.pointsFor - a.pointsFor)[0];
  const highestOptimal = findHighestOptimalWeek(teams);

  return (
    <Card className={styles.card} as={Link} to={`/history/${season.season}`} interactive>
      <div className={styles.cardHeader}>
        <span className={styles.year}>
          {season.season}
          {isLive && (
            <Chip tone="live" dot className={styles.liveChip}>
              Live
            </Chip>
          )}
        </span>
        {champion ? (
          <div className={styles.championRow}>
            <Avatar
              url={teamsById.get(champion.rosterId)?.avatarUrl ?? null}
              name={teamsById.get(champion.rosterId)?.teamName ?? "?"}
              size={36}
            />
            <div>
              <div className={styles.championName}>
                {teamsById.get(champion.rosterId)?.teamName ?? "Unknown"}
              </div>
              <div className={styles.championLabel}>League Champion</div>
            </div>
          </div>
        ) : (
          !isComplete && <p className={styles.inProgressLabel}>Season in progress</p>
        )}
      </div>

      {isComplete && (
        <div className={styles.placementsRow}>
          {runnerUp && (
            <span>Runner-up: {teamsById.get(runnerUp.rosterId)?.teamName ?? "Unknown"}</span>
          )}
          {third && <span>3rd: {teamsById.get(third.rosterId)?.teamName ?? "Unknown"}</span>}
        </div>
      )}

      <div className={styles.statsRow}>
        {bestRecord && (
          <span>
            Best record{!isComplete && " so far"}: {bestRecord.teamName} ({bestRecord.wins}-
            {bestRecord.losses}-{bestRecord.ties})
          </span>
        )}
        {pointsLeader && (
          <span>
            Points leader{!isComplete && " so far"}: {pointsLeader.teamName} (
            {pointsLeader.pointsFor.toFixed(1)})
          </span>
        )}
      </div>

      {highestOptimal && (
        <Chip tone="accent" className={styles.retroChip}>
          Highest optimal week: {highestOptimal.team.teamName}, Wk {highestOptimal.week} (
          {highestOptimal.points.toFixed(1)})
        </Chip>
      )}
    </Card>
  );
}

function AsPlayedSeasonHallCard({
  season,
  isLive,
  onLoaded,
}: {
  season: SeasonRef;
  isLive: boolean;
  onLoaded: (input: SeasonRecordInput) => void;
}) {
  const { teams, placements, isLoading, error } = useAsPlayedSeasonResult(season.leagueId);
  const reported = useRef(false);

  useEffect(() => {
    if (teams && placements && !reported.current) {
      reported.current = true;
      onLoaded({
        season,
        teams,
        // Never credit a championship until Sleeper marks the season
        // complete — the current #1 in an in-progress bracket isn't champion yet.
        championRosterId:
          season.status === "complete" ? (placements.find((p) => p.place === 1)?.rosterId ?? null) : null,
      });
    }
  }, [teams, placements, season, onLoaded]);

  return (
    <SeasonHallCardView
      season={season}
      teams={teams}
      placements={placements}
      isLoading={isLoading}
      error={error as Error | null}
      isLive={isLive}
    />
  );
}

function CustomRulesSeasonHallCard({
  season,
  isLive,
  onLoaded,
}: {
  season: SeasonRef;
  isLive: boolean;
  onLoaded: (input: SeasonRecordInput) => void;
}) {
  const { teams, placements, isLoading, error } = useCustomRulesSeasonSummary(season.leagueId);
  const reported = useRef(false);

  useEffect(() => {
    if (teams && placements && !reported.current) {
      reported.current = true;
      onLoaded({
        season,
        teams,
        // Never credit a championship until Sleeper marks the season
        // complete — the current #1 in an in-progress bracket isn't champion yet.
        championRosterId:
          season.status === "complete" ? (placements.find((p) => p.place === 1)?.rosterId ?? null) : null,
      });
    }
  }, [teams, placements, season, onLoaded]);

  return (
    <SeasonHallCardView
      season={season}
      teams={teams}
      placements={placements}
      isLoading={isLoading}
      error={error as Error | null}
      isLive={isLive}
    />
  );
}

function SeasonHallCard({
  season,
  isLive,
  onLoaded,
}: {
  season: SeasonRef;
  isLive: boolean;
  onLoaded: (input: SeasonRecordInput) => void;
}) {
  return getSeasonMode(season) === "as-played" ? (
    <AsPlayedSeasonHallCard season={season} isLive={isLive} onLoaded={onLoaded} />
  ) : (
    <CustomRulesSeasonHallCard season={season} isLive={isLive} onLoaded={onLoaded} />
  );
}

function AllTimeRecordsBlock({ seasonRecords }: { seasonRecords: SeasonRecordInput[] }) {
  const records = useMemo(
    () =>
      computeAllTimeRecords(
        [...seasonRecords].sort((a, b) => a.season.season.localeCompare(b.season.season))
      ),
    [seasonRecords]
  );

  return (
    <div className={styles.allTimeSection}>
      <h2>All-Time Records</h2>
      <Card className={styles.allTimeCard}>
        <div className={styles.allTimeGrid}>
          <div>
            <h3>Career Record</h3>
            <ul className={styles.recordList}>
              {records.managers.map((m) => (
                <li key={m.ownerId} className={styles.recordRow}>
                  <span>{m.displayName}</span>
                  <span className="tabular-nums">
                    {m.wins}-{m.losses}-{m.ties}
                    {m.championships > 0 ? ` · 🏆 ×${m.championships}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.statStrip}>
            {records.highestActualWeek && (
              <div className={styles.statTile}>
                <span className={styles.statLabel}>Highest actual week</span>
                <span className={styles.statValue}>
                  {records.highestActualWeek.points.toFixed(1)}
                </span>
                <span className={styles.statNote}>
                  {records.highestActualWeek.displayName} · {records.highestActualWeek.season} Wk{" "}
                  {records.highestActualWeek.week}
                </span>
              </div>
            )}
            {records.highestOptimalWeek && (
              <div className={styles.statTile}>
                <span className={styles.statLabel}>Highest optimal week</span>
                <span className={styles.statValue}>
                  {records.highestOptimalWeek.points.toFixed(1)}
                </span>
                <span className={styles.statNote}>
                  {records.highestOptimalWeek.displayName} · {records.highestOptimalWeek.season} Wk{" "}
                  {records.highestOptimalWeek.week}
                </span>
              </div>
            )}
            {records.bestSeasonEfficiency && (
              <div className={styles.statTile}>
                <span className={styles.statLabel}>Best season efficiency</span>
                <span className={styles.statValue}>
                  {records.bestSeasonEfficiency.efficiencyPct.toFixed(1)}%
                </span>
                <span className={styles.statNote}>
                  {records.bestSeasonEfficiency.displayName} · {records.bestSeasonEfficiency.season}
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

export function History() {
  const { chain, isAwaitingNewSeason, currentSeason, isLoading, error } = useSeasonContext();
  const [seasonRecords, setSeasonRecords] = useState<Map<string, SeasonRecordInput>>(new Map());

  const handleLoaded = useCallback((input: SeasonRecordInput) => {
    setSeasonRecords((prev) => {
      if (prev.has(input.season.leagueId)) return prev;
      const next = new Map(prev);
      next.set(input.season.leagueId, input);
      return next;
    });
  }, []);

  if (isLoading) return <p>Loading season history…</p>;
  if (error) return <p>Couldn't load season history: {error.message}</p>;

  return (
    <div>
      <h1>History</h1>

      {isAwaitingNewSeason && (
        <p className={styles.banner}>
          The next league hasn't been created on Sleeper yet — showing the latest completed season
          on the main pages.
        </p>
      )}

      <RevealGroup className={styles.cardGrid}>
        {[...chain].reverse().map((season) => (
          <RevealItem key={season.leagueId}>
            <SeasonHallCard
              season={season}
              isLive={season.leagueId === currentSeason?.leagueId}
              onLoaded={handleLoaded}
            />
          </RevealItem>
        ))}
      </RevealGroup>

      {seasonRecords.size > 0 && (
        <AllTimeRecordsBlock seasonRecords={[...seasonRecords.values()]} />
      )}
    </div>
  );
}
