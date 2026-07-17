import { Link } from "react-router-dom";
import { usePickRace } from "../hooks/usePickRace";
import { useTeams } from "../hooks/useTeams";
import { useAsPlayedSeasonResult } from "../hooks/useAsPlayedSeasonResult";
import { useSeasonContext, getSeasonMode } from "../context/SeasonContext";
import { ordinal } from "../domain/asPlayed";
import { Card } from "../components/common/Card";
import { Avatar } from "../components/common/Avatar";
import { Skeleton } from "../components/common/Skeleton";
import { ErrorCard } from "../components/common/ErrorCard";
import { Chip } from "../components/common/Chip";
import { SeasonNotStartedNotice } from "../components/common/SeasonNotStartedNotice";
import { PotentialPointsTable } from "../components/tables/PotentialPointsTable";
import { PickRaceGroupBracket } from "../components/bracket/PickRaceGroupBracket";
import { DraftOrderBoard } from "../components/tables/DraftOrderBoard";
import styles from "./PickRace.module.css";

function CustomRulesPickRace({ leagueId }: { leagueId: string }) {
  const { pickRace, draftOrder, isLoading, error } = usePickRace(leagueId);
  const teamsResult = useTeams(leagueId);

  if (error) {
    return <ErrorCard message="Couldn't load the pick race." />;
  }

  if (isLoading || !pickRace || !draftOrder || !teamsResult.data) {
    return <Skeleton height={480} />;
  }

  // Every team is still tied 0-0-0 before Week 1 is played — Potential
  // Points and the pick-race groups are meaningless at that point, so show
  // a placeholder instead.
  if (teamsResult.data.currentWeek < 1) {
    return <SeasonNotStartedNotice subject="The pick race" />;
  }

  const teamsById = new Map(teamsResult.data.teams.map((t) => [t.rosterId, t]));
  const nonPlayoffTeams = [...pickRace.groupA.rosterIds, ...pickRace.groupB.rosterIds]
    .map((id) => teamsById.get(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const seasonIsUnderway = [...pickRace.groupA.games, ...pickRace.groupB.games].some(
    (g) => g.status !== "upcoming"
  );

  return (
    <div>
      {!seasonIsUnderway && (
        <Chip tone="gold" className={styles.projectionChip}>
          Projection — based on Potential Points so far
        </Chip>
      )}

      <div className={styles.section}>
        <h2>Potential Points</h2>
        <Card className={styles.card}>
          <PotentialPointsTable teams={nonPlayoffTeams} />
        </Card>
      </div>

      <div className={styles.section}>
        <h2>Pick Race Brackets</h2>
        <div className={styles.groupGrid}>
          <div>
            <h3>Group A — Picks 1.01–1.03</h3>
            <PickRaceGroupBracket
              group={pickRace.groupA}
              picks={["1.01", "1.02", "1.03"]}
              teamsById={teamsById}
            />
          </div>
          <div>
            <h3>Group B — Picks 1.04–1.06</h3>
            <PickRaceGroupBracket
              group={pickRace.groupB}
              picks={["1.04", "1.05", "1.06"]}
              teamsById={teamsById}
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2>Draft Order</h2>
        <Card className={styles.card}>
          <DraftOrderBoard draftOrder={draftOrder} teamsById={teamsById} />
        </Card>
      </div>

      <details className={styles.explainer}>
        <summary>What are Potential Points?</summary>
        <p>
          Potential Points is the total your team would have scored every week if you'd started the
          best possible lineup from your full roster, bench included. It measures how well you've set
          your lineup, not just how good your roster is.
        </p>
        <p>
          For the 6 teams that miss the playoffs, the pick race flips the usual incentive: winning your
          bracket gets you a <em>better</em> (earlier) draft pick, not a worse one. The 3 teams with the
          lowest Potential Points play for picks 1.01–1.03; the other 3 play for 1.04–1.06. Win for the
          1.01!
        </p>
      </details>
    </div>
  );
}

function AsPlayedSeasonResult({ leagueId }: { leagueId: string }) {
  const { placements, teams, draftOrder, nextSeason, isLoading, error } =
    useAsPlayedSeasonResult(leagueId);

  if (error) {
    return <ErrorCard message="Couldn't load the season result." />;
  }

  if (isLoading || !placements || !teams) {
    return <Skeleton height={480} />;
  }

  const teamsById = new Map(teams.map((t) => [t.rosterId, t]));

  return (
    <div>
      <div className={styles.section}>
        <h2>Final Standings</h2>
        <Card className={styles.card}>
          <ol className={styles.placementList}>
            {placements.map((p) => {
              const team = teamsById.get(p.rosterId);
              return (
                <li key={p.rosterId} className={styles.placementRow}>
                  <span className={styles.placementRank}>{ordinal(p.place)}</span>
                  <Avatar url={team?.avatarUrl ?? null} name={team?.teamName ?? "?"} size={28} />
                  <Link to={`../team/${p.rosterId}`} className={styles.placementName}>
                    {team?.teamName ?? "Unknown"}
                  </Link>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>

      <div className={styles.section}>
        <h2>Draft Order</h2>
        {draftOrder ? (
          <Card className={styles.card}>
            <DraftOrderBoard draftOrder={draftOrder} teamsById={teamsById} />
          </Card>
        ) : (
          <p className={styles.emptyState}>
            {nextSeason
              ? "Draft data not available for the following season yet."
              : "Next season not created yet."}
          </p>
        )}
      </div>
    </div>
  );
}

export function PickRace() {
  const { selectedSeason } = useSeasonContext();
  const leagueId = selectedSeason?.leagueId ?? "";
  const isAsPlayed = selectedSeason && getSeasonMode(selectedSeason) === "as-played";

  return (
    <div>
      <h1>{isAsPlayed ? "Season Result & Draft Order" : "Pick Race"}</h1>
      {isAsPlayed ? (
        <AsPlayedSeasonResult leagueId={leagueId} />
      ) : (
        <CustomRulesPickRace leagueId={leagueId} />
      )}
    </div>
  );
}
