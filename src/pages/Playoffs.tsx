import { usePlayoffBracket } from "../hooks/usePlayoffBracket";
import { useAsPlayedBracket } from "../hooks/useAsPlayedBracket";
import { useTeams } from "../hooks/useTeams";
import { useSeasonContext, getSeasonMode } from "../context/SeasonContext";
import { PlayoffBracket } from "../components/bracket/PlayoffBracket";
import { GameCard } from "../components/bracket/GameCard";
import { Card } from "../components/common/Card";
import { Skeleton } from "../components/common/Skeleton";
import { ErrorCard } from "../components/common/ErrorCard";
import { Chip } from "../components/common/Chip";
import { SeasonNotStartedNotice } from "../components/common/SeasonNotStartedNotice";
import type { Team } from "../domain/types";
import type { PlayoffBracket as PlayoffBracketData } from "../domain/playoffBracket";
import styles from "./Playoffs.module.css";

function CustomRulesPlayoffs({ leagueId }: { leagueId: string }) {
  const { bracket, isLoading, error } = usePlayoffBracket(leagueId);
  const teamsResult = useTeams(leagueId);

  if (error) {
    return <ErrorCard message="Couldn't load the playoff bracket." />;
  }

  if (isLoading || !bracket || !teamsResult.data) {
    return <Skeleton height={480} />;
  }

  // Every team is still tied 0-0-0 before Week 1 is played — a computed
  // bracket at that point is meaningless, so show a placeholder instead.
  if (teamsResult.data.currentWeek < 1) {
    return <SeasonNotStartedNotice subject="The playoff bracket" />;
  }

  const teamsById = new Map(teamsResult.data.teams.map((t) => [t.rosterId, t]));
  const third = bracket.games.find((g) => g.id === "THIRD")!;
  const consolation = bracket.games.find((g) => g.id === "CONSOLATION")!;

  const seasonIsUnderway = bracket.games.some((g) => g.status !== "upcoming");

  return (
    <div>
      {!seasonIsUnderway && (
        <Chip tone="gold" className={styles.projectionChip}>
          Projection — if the season ended today
        </Chip>
      )}

      <Card className={styles.card}>
        <PlayoffBracket bracket={bracket} teamsById={teamsById} />
      </Card>

      <div className={styles.section}>
        <h2>3rd Place &amp; Consolation</h2>
        <div className={styles.secondaryGrid}>
          <div>
            <Card className={styles.secondaryCard}>
              <GameCard
                label="3rd Place Game"
                home={third.home}
                away={third.away}
                homeScore={third.homeScore}
                awayScore={third.awayScore}
                winnerRosterId={third.winnerRosterId}
                status={third.status}
                teamsById={teamsById}
                pairingFoundInSleeper={third.pairingFoundInSleeper}
              />
            </Card>
            <p className={styles.secondaryNote}>Winner takes 3rd place, pick 1.10. Loser takes 4th, pick 1.09.</p>
          </div>
          <div>
            <Card className={styles.secondaryCard}>
              <GameCard
                label="Consolation (5th Place)"
                home={consolation.home}
                away={consolation.away}
                homeScore={consolation.homeScore}
                awayScore={consolation.awayScore}
                winnerRosterId={consolation.winnerRosterId}
                status={consolation.status}
                teamsById={teamsById}
                pairingFoundInSleeper={consolation.pairingFoundInSleeper}
              />
            </Card>
            <p className={styles.secondaryNote}>Winner receives pick 1.07, loser 1.08.</p>
          </div>
        </div>
      </div>

      <details className={styles.explainer}>
        <summary>How our playoffs work</summary>
        <p>
          The top 2 teams from each division make the playoffs. The two division winners with the best
          records get a bye straight to the semifinals; the third division winner faces the worst
          second-place team, and the other two second-place teams play each other, in the wildcard round.
        </p>
        <p>
          Semifinals are reseeded: once the wildcard round is decided, the four remaining teams are
          re-ranked by regular-season record, and the best remaining record plays the worst — not
          necessarily the two bye teams facing off.
        </p>
        <p>
          The two semifinal winners meet in the championship; the two semifinal losers play for 3rd
          place. The two wildcard-round losers play a consolation game for draft-pick positioning.
        </p>
      </details>
    </div>
  );
}

function AsPlayedSecondaryBracket({
  title,
  bracket,
  teamsById,
}: {
  title: string;
  bracket: PlayoffBracketData;
  teamsById: Map<number, Team>;
}) {
  if (bracket.games.length === 0) return null;

  return (
    <div className={styles.section}>
      <h2>{title}</h2>
      <div className={styles.secondaryGrid}>
        {bracket.games.map((game) => (
          <Card key={game.id} className={styles.secondaryCard}>
            <GameCard
              label={game.id}
              home={game.home}
              away={game.away}
              homeScore={game.homeScore}
              awayScore={game.awayScore}
              winnerRosterId={game.winnerRosterId}
              status={game.status}
              teamsById={teamsById}
              pairingFoundInSleeper={game.pairingFoundInSleeper}
            />
          </Card>
        ))}
      </div>
    </div>
  );
}

function AsPlayedPlayoffs({ leagueId }: { leagueId: string }) {
  const { winnersBracket, losersBracket, teams, isLoading, error } = useAsPlayedBracket(leagueId);

  if (error) {
    return <ErrorCard message="Couldn't load the playoff bracket." />;
  }

  if (isLoading || !winnersBracket || !losersBracket || !teams) {
    return <Skeleton height={480} />;
  }

  const teamsById = new Map(teams.map((t) => [t.rosterId, t]));

  return (
    <div>
      <Card className={styles.card}>
        <PlayoffBracket bracket={winnersBracket} teamsById={teamsById} />
      </Card>

      <AsPlayedSecondaryBracket
        title="Losers Bracket"
        bracket={losersBracket}
        teamsById={teamsById}
      />
    </div>
  );
}

export function Playoffs() {
  const { selectedSeason } = useSeasonContext();
  const leagueId = selectedSeason?.leagueId ?? "";

  return (
    <div>
      <h1>Playoffs</h1>
      {selectedSeason && getSeasonMode(selectedSeason) === "as-played" ? (
        <AsPlayedPlayoffs leagueId={leagueId} />
      ) : (
        <CustomRulesPlayoffs leagueId={leagueId} />
      )}
    </div>
  );
}
