import { Link } from "react-router-dom";
import { useSeasonContext, getSeasonMode } from "../context/SeasonContext";
import { useAsPlayedSeasonResult } from "../hooks/useAsPlayedSeasonResult";
import { useCustomRulesSeasonSummary } from "../hooks/useCustomRulesSeasonSummary";
import { Card } from "../components/common/Card";
import { Avatar } from "../components/common/Avatar";
import { Skeleton } from "../components/common/Skeleton";
import { ErrorCard } from "../components/common/ErrorCard";
import type { SeasonRef } from "../domain/seasonChain";
import styles from "./HistorySeason.module.css";

function SeasonOverviewView({
  isComplete,
  isLoading,
  error,
  teams,
  placements,
}: {
  isComplete: boolean;
  isLoading: boolean;
  error: Error | null;
  teams: ReturnType<typeof useAsPlayedSeasonResult>["teams"];
  placements: ReturnType<typeof useAsPlayedSeasonResult>["placements"];
}) {
  if (error) return <ErrorCard message="Couldn't load this season." />;
  if (isLoading || !teams || !placements) return <Skeleton height={300} />;

  const teamsById = new Map(teams.map((t) => [t.rosterId, t]));

  return (
    <div>
      <h2>{isComplete ? "Final Standings" : "Current Standings"}</h2>
      <Card className={styles.card}>
        <ol className={styles.placementList}>
          {placements.slice(0, 6).map((p) => {
            const team = teamsById.get(p.rosterId);
            return (
              <li key={p.rosterId} className={styles.placementRow}>
                <span className={styles.placementRank}>{p.place}</span>
                <Avatar url={team?.avatarUrl ?? null} name={team?.teamName ?? "?"} size={26} />
                <Link to="teams" className={styles.placementName}>
                  {team?.teamName ?? "Unknown"}
                </Link>
              </li>
            );
          })}
        </ol>
      </Card>
      <p className={styles.links}>
        <Link to="standings">Full standings →</Link> · <Link to="playoffs">Playoff bracket →</Link>{" "}
        · <Link to="teams">All teams →</Link>
      </p>
    </div>
  );
}

// Mode-branching by MOUNTING a different component (not by calling both
// hooks and discarding one) — custom-rules-only logic like buildPlayoffBracket
// must never even be invoked for an as-played season, per the policy table.
function AsPlayedSeasonOverview({ season }: { season: SeasonRef }) {
  const { teams, placements, isLoading, error } = useAsPlayedSeasonResult(season.leagueId);
  return (
    <SeasonOverviewView
      isComplete={season.status === "complete"}
      teams={teams}
      placements={placements}
      isLoading={isLoading}
      error={error as Error | null}
    />
  );
}

function CustomRulesSeasonOverview({ season }: { season: SeasonRef }) {
  const { teams, placements, isLoading, error } = useCustomRulesSeasonSummary(season.leagueId);
  return (
    <SeasonOverviewView
      isComplete={season.status === "complete"}
      teams={teams}
      placements={placements}
      isLoading={isLoading}
      error={error as Error | null}
    />
  );
}

function SeasonOverview({ season }: { season: SeasonRef }) {
  return getSeasonMode(season) === "as-played" ? (
    <AsPlayedSeasonOverview season={season} />
  ) : (
    <CustomRulesSeasonOverview season={season} />
  );
}

export function HistorySeason() {
  const { selectedSeason, isLoading, error } = useSeasonContext();

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p>Couldn't load this season: {error.message}</p>;
  if (!selectedSeason) return <p>Season not found.</p>;

  return <SeasonOverview season={selectedSeason} />;
}
