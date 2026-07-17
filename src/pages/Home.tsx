import { Link } from "react-router-dom";
import { useTeams } from "../hooks/useTeams";
import { usePlayoffBracket } from "../hooks/usePlayoffBracket";
import { usePickRace } from "../hooks/usePickRace";
import { useMatchups } from "../hooks/useMatchups";
import { useLeaguePhase } from "../hooks/useLeaguePhase";
import { useAsPlayedSeasonResult } from "../hooks/useAsPlayedSeasonResult";
import { useSeasonContext, getSeasonMode } from "../context/SeasonContext";
import { groupMatchupsByMatchupId } from "../domain/weeklyResults";
import { ordinal } from "../domain/asPlayed";
import type { Team } from "../domain/types";
import type { LeaguePhase } from "../domain/leaguePhase";
import { Card } from "../components/common/Card";
import { Avatar } from "../components/common/Avatar";
import { Skeleton } from "../components/common/Skeleton";
import { ErrorCard } from "../components/common/ErrorCard";
import { RevealGroup, RevealItem } from "../components/common/Reveal";
import { SeasonHero, type SeasonHeroProps } from "../components/layout/SeasonHero";
import styles from "./Home.module.css";

/** A brand-new season has no real Week 1 data yet — every team is tied at
 * 0-0-0, so a computed bracket/pick-race order would just be noise. */
function CustomRulesPlaceholderCards() {
  return (
    <>
      <RevealItem>
        <Card as={Link} to="/playoffs" interactive className={styles.summaryCard}>
          <h2 className={styles.cardTitle}>
            Playoff Picture
            <span className={styles.cardLink}>View bracket →</span>
          </h2>
          <p className={styles.emptyState}>Playoff picture will appear once Week 1 has been played.</p>
          <p className={styles.autoUpdateNote}>Updates automatically after each week.</p>
        </Card>
      </RevealItem>

      <RevealItem>
        <Card as={Link} to="/pick-race" interactive className={styles.summaryCard}>
          <h2 className={styles.cardTitle}>
            Pick Race Order
            <span className={styles.cardLink}>View race →</span>
          </h2>
          <p className={styles.emptyState}>Pick race order will appear once Week 1 has been played.</p>
          <p className={styles.autoUpdateNote}>Updates automatically after each week.</p>
        </Card>
      </RevealItem>
    </>
  );
}

const EXTENDED_HERO_PHASES: ReadonlySet<LeaguePhase> = new Set([
  "pre-draft-unscheduled",
  "pre-draft-countdown",
  "drafting",
  "pre-season",
]);

function isExtendedHeroPhase(
  phase: LeaguePhase | undefined
): phase is SeasonHeroProps["phase"] {
  return phase !== undefined && EXTENDED_HERO_PHASES.has(phase);
}

function seasonPhase(currentWeek: number, playoffWeekStart: number): { eyebrow: string; headline: string } {
  if (currentWeek < playoffWeekStart) {
    const weeksLeft = playoffWeekStart - currentWeek;
    return {
      eyebrow: `Week ${currentWeek}`,
      headline:
        weeksLeft === 1
          ? "1 week until the playoffs"
          : `${weeksLeft} weeks until the playoffs`,
    };
  }
  if (currentWeek === playoffWeekStart) {
    return { eyebrow: "Playoffs", headline: "Wildcard Round" };
  }
  if (currentWeek === playoffWeekStart + 1) {
    return { eyebrow: "Playoffs", headline: "Semifinals — reseeded" };
  }
  if (currentWeek === playoffWeekStart + 2) {
    return { eyebrow: "Playoffs", headline: "Championship Week" };
  }
  return { eyebrow: "Season", headline: "Season Complete" };
}

function findClosestMatchup(
  matchups: ReturnType<typeof useMatchups>["data"],
  teams: Team[]
): { teamA: Team; teamB: Team; scoreA: number; scoreB: number } | null {
  if (!matchups) return null;
  let closest: { teamA: Team; teamB: Team; scoreA: number; scoreB: number } | null = null;
  let minDiff = Infinity;

  for (const group of groupMatchupsByMatchupId(matchups)) {
    if (group.length !== 2) continue;
    const [a, b] = group;
    const teamA = teams.find((t) => t.rosterId === a.roster_id);
    const teamB = teams.find((t) => t.rosterId === b.roster_id);
    if (!teamA || !teamB) continue;
    const diff = Math.abs(a.points - b.points);
    if (diff < minDiff) {
      minDiff = diff;
      closest = { teamA, teamB, scoreA: a.points, scoreB: b.points };
    }
  }
  return closest;
}

function CustomRulesSummaryCards({
  leagueId,
  teamsById,
}: {
  leagueId: string;
  teamsById: Map<number, Team>;
}) {
  const bracketResult = usePlayoffBracket(leagueId);
  const pickRaceResult = usePickRace(leagueId);

  return (
    <>
      <RevealItem>
        <Card as={Link} to="/playoffs" interactive className={styles.summaryCard}>
          <h2 className={styles.cardTitle}>
            Playoff Picture
            <span className={styles.cardLink}>View bracket →</span>
          </h2>
          {bracketResult.isLoading ? (
            <Skeleton height={140} />
          ) : bracketResult.bracket ? (
            <ul className={styles.miniList}>
              {bracketResult.bracket.seeds.map((seed) => {
                const team = teamsById.get(seed.rosterId);
                return (
                  <li key={seed.seed} className={styles.miniRow}>
                    <span className={styles.miniSeed}>{seed.seed}</span>
                    <Avatar url={team?.avatarUrl ?? null} name={team?.teamName ?? "?"} size={22} />
                    <span className={styles.miniName}>{team?.teamName ?? "Unknown"}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={styles.emptyState}>Playoff picture not available yet.</p>
          )}
        </Card>
      </RevealItem>

      <RevealItem>
        <Card as={Link} to="/pick-race" interactive className={styles.summaryCard}>
          <h2 className={styles.cardTitle}>
            Pick Race Order
            <span className={styles.cardLink}>View race →</span>
          </h2>
          {pickRaceResult.isLoading ? (
            <Skeleton height={140} />
          ) : pickRaceResult.draftOrder ? (
            <ul className={styles.miniList}>
              {pickRaceResult.draftOrder.slice(0, 6).map((pick) => {
                const team = pick.rosterId !== null ? teamsById.get(pick.rosterId) : undefined;
                return (
                  <li key={pick.pick} className={styles.miniRow}>
                    <span className={styles.miniSeed}>{pick.pick}</span>
                    {team && <Avatar url={team.avatarUrl} name={team.teamName} size={22} />}
                    <span className={styles.miniName}>{team?.teamName ?? "TBD"}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={styles.emptyState}>Pick race projection not available yet.</p>
          )}
        </Card>
      </RevealItem>
    </>
  );
}

function AsPlayedSummaryCards({
  leagueId,
  teamsById,
}: {
  leagueId: string;
  teamsById: Map<number, Team>;
}) {
  const { placements, draftOrder, isLoading } = useAsPlayedSeasonResult(leagueId);

  return (
    <>
      <RevealItem>
        <Card as={Link} to="/playoffs" interactive className={styles.summaryCard}>
          <h2 className={styles.cardTitle}>
            Final Standings
            <span className={styles.cardLink}>View bracket →</span>
          </h2>
          {isLoading ? (
            <Skeleton height={140} />
          ) : placements && placements.length > 0 ? (
            <ul className={styles.miniList}>
              {placements.slice(0, 6).map((p) => {
                const team = teamsById.get(p.rosterId);
                return (
                  <li key={p.rosterId} className={styles.miniRow}>
                    <span className={styles.miniSeed}>{ordinal(p.place)}</span>
                    <Avatar url={team?.avatarUrl ?? null} name={team?.teamName ?? "?"} size={22} />
                    <span className={styles.miniName}>{team?.teamName ?? "Unknown"}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={styles.emptyState}>Final standings not available yet.</p>
          )}
        </Card>
      </RevealItem>

      <RevealItem>
        <Card as={Link} to="/pick-race" interactive className={styles.summaryCard}>
          <h2 className={styles.cardTitle}>
            Draft Order
            <span className={styles.cardLink}>View order →</span>
          </h2>
          {isLoading ? (
            <Skeleton height={140} />
          ) : draftOrder ? (
            <ul className={styles.miniList}>
              {draftOrder.slice(0, 6).map((pick) => {
                const team = pick.rosterId !== null ? teamsById.get(pick.rosterId) : undefined;
                return (
                  <li key={pick.pick} className={styles.miniRow}>
                    <span className={styles.miniSeed}>{pick.pick}</span>
                    {team && <Avatar url={team.avatarUrl} name={team.teamName} size={22} />}
                    <span className={styles.miniName}>{team?.teamName ?? "TBD"}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={styles.emptyState}>Next season's draft hasn't happened yet.</p>
          )}
        </Card>
      </RevealItem>
    </>
  );
}

export function Home() {
  const { selectedSeason, currentSeason, isAwaitingNewSeason } = useSeasonContext();
  const leagueId = selectedSeason?.leagueId ?? "";
  const teamsResult = useTeams(leagueId);
  const { phase, draft, draftStartMs } = useLeaguePhase(leagueId);
  const isAsPlayed = selectedSeason && getSeasonMode(selectedSeason) === "as-played";

  // If the next season's Sleeper league hasn't been created yet, `phase` is
  // still computed off the LAST completed season (status "complete") — that
  // would otherwise show "Season Complete" for a season that's actually
  // over, instead of signaling that the next one is coming. Override to the
  // "waiting on the commissioner" hero state instead, and show the season
  // number that's actually being waited on (last known + 1), not the old one.
  const isViewingLiveSeason = selectedSeason?.leagueId === currentSeason?.leagueId;
  const effectivePhase: LeaguePhase | undefined =
    isAwaitingNewSeason && isViewingLiveSeason ? "pre-draft-unscheduled" : phase;
  const heroSeason =
    isAwaitingNewSeason && isViewingLiveSeason && selectedSeason
      ? String(Number(selectedSeason.season) + 1)
      : selectedSeason?.season;

  const currentWeek = teamsResult.data?.currentWeek;
  const playoffWeekStart = teamsResult.data?.playoffWeekStart;
  // Once the season's over, "current week" resolves to Infinity (see
  // resolveCurrentWeek) — there's no real "this week" then, so fall back to
  // the championship week for the "closest matchup" card.
  const matchupWeek =
    currentWeek !== undefined && playoffWeekStart !== undefined
      ? Number.isFinite(currentWeek)
        ? currentWeek
        : playoffWeekStart + 2
      : 0;
  const currentWeekMatchupsQuery = useMatchups(leagueId, matchupWeek, currentWeek);

  const isLoading = teamsResult.isLoading;
  const error = teamsResult.error;

  if (error) {
    return <ErrorCard message="Couldn't load the league overview." />;
  }

  const teamsById = new Map((teamsResult.data?.teams ?? []).map((t) => [t.rosterId, t]));

  const closestMatchup = findClosestMatchup(currentWeekMatchupsQuery.data, teamsResult.data?.teams ?? []);

  // Only known false once currentWeek resolves — stays false (and falls
  // through to the normal cards, which show their own loading skeletons)
  // while data is still loading, to avoid a placeholder-then-real flash.
  const seasonNotStarted = currentWeek !== undefined && currentWeek < 1;

  const legacyPhase =
    currentWeek !== undefined && playoffWeekStart !== undefined
      ? seasonPhase(currentWeek, playoffWeekStart)
      : null;

  return (
    <div>
      {isExtendedHeroPhase(effectivePhase) && heroSeason ? (
        <SeasonHero
          phase={effectivePhase}
          season={heroSeason}
          leagueId={leagueId}
          draftId={draft?.draft_id}
          draftStartMs={draftStartMs}
        />
      ) : (
        <div className={styles.hero}>
          {isLoading || !legacyPhase ? (
            <>
              <Skeleton width={140} height={16} />
              <Skeleton width={320} height={40} className={styles.headline} />
            </>
          ) : (
            <>
              <p className={styles.eyebrow}>{legacyPhase.eyebrow}</p>
              <h1 className={styles.headline}>{legacyPhase.headline}</h1>
            </>
          )}
        </div>
      )}

      <RevealGroup className={styles.cardGrid}>
        {isAsPlayed ? (
          <AsPlayedSummaryCards leagueId={leagueId} teamsById={teamsById} />
        ) : seasonNotStarted ? (
          <CustomRulesPlaceholderCards />
        ) : (
          <CustomRulesSummaryCards leagueId={leagueId} teamsById={teamsById} />
        )}

        <RevealItem>
          <Card as={Link} to="/standings" interactive className={styles.summaryCard}>
            <h2 className={styles.cardTitle}>
              Closest Matchup
              <span className={styles.cardLink}>All standings →</span>
            </h2>
            {currentWeekMatchupsQuery.isLoading ? (
              <Skeleton height={80} />
            ) : closestMatchup ? (
              <div className={styles.matchupCard}>
                <div className={styles.matchupRow}>
                  <span>{closestMatchup.teamA.teamName}</span>
                  <span className={`${styles.matchupScore} tabular-nums`}>
                    {closestMatchup.scoreA.toFixed(1)}
                  </span>
                </div>
                <div className={styles.matchupRow}>
                  <span>{closestMatchup.teamB.teamName}</span>
                  <span className={`${styles.matchupScore} tabular-nums`}>
                    {closestMatchup.scoreB.toFixed(1)}
                  </span>
                </div>
              </div>
            ) : (
              <p className={styles.emptyState}>No matchups in progress this week.</p>
            )}
          </Card>
        </RevealItem>
      </RevealGroup>
    </div>
  );
}
