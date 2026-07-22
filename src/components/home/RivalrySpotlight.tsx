import clsx from "clsx";
import { Card } from "../common/Card";
import { Avatar } from "../common/Avatar";
import { useRivalryGames } from "../../media/useRivalryGames";
import { useWeekContext } from "../../media/engine/weekContext";
import { useAllEditions } from "../../media/roomData";
import { useMatchups } from "../../hooks/useMatchups";
import styles from "./RivalrySpotlight.module.css";

function streakLabel(winStreak: number, lossStreak: number): string {
  if (winStreak > 0) return `${winStreak}W in Folge`;
  if (lossStreak > 0) return `${lossStreak}L in Folge`;
  return "–";
}

export function RivalrySpotlight({ leagueId }: { leagueId: string }) {
  const { games, upcomingWeek, isLoading: gamesLoading } = useRivalryGames(leagueId);
  const weekCtx = useWeekContext(leagueId);
  const matchupsQuery = useMatchups(leagueId, upcomingWeek ?? 0, upcomingWeek);
  const { editions } = useAllEditions(null);

  if (gamesLoading || games.length === 0 || !weekCtx.data) return null;

  const current = editions[0];
  const statementsRevealed = current?.week === upcomingWeek;

  return (
    <div className={styles.scroller}>
      {games.map((game) => {
        const teamA = weekCtx.data!.teams.get(game.rosterIdA);
        const teamB = weekCtx.data!.teams.get(game.rosterIdB);
        if (!teamA || !teamB) return null;

        const matchupA = matchupsQuery.data?.find((m) => m.roster_id === game.rosterIdA);
        const matchupB = matchupsQuery.data?.find((m) => m.roster_id === game.rosterIdB);

        const statementA = statementsRevealed
          ? current?.cards.find((c) => c.kind === "rivalry_statement" && c.rosterId === game.rosterIdA)?.answer
          : undefined;
        const statementB = statementsRevealed
          ? current?.cards.find((c) => c.kind === "rivalry_statement" && c.rosterId === game.rosterIdB)?.answer
          : undefined;

        return (
          <Card key={`${game.rosterIdA}-${game.rosterIdB}`} className={styles.card}>
            <div className={styles.cardContent}>
              <p className={clsx(styles.eyebrow, game.mutual && styles.eyebrowHot)}>
                {game.mutual ? "🔥 BLOOD FEUD 🔥" : `🔥 RIVALRY GAME · WOCHE ${upcomingWeek}`}
              </p>
              <div className={styles.tape}>
                <div className={styles.side}>
                  <Avatar url={teamA.avatarUrl} name={teamA.teamName} size={48} />
                  <span className={styles.stat}>{teamA.record}</span>
                  <span className={styles.stat}>{streakLabel(teamA.winStreak, teamA.lossStreak)}</span>
                  <span className={styles.stat}>{teamA.pointsFor.toFixed(1)} PF</span>
                </div>
                <div className={styles.score}>
                  {(matchupA?.points ?? 0).toFixed(1)} : {(matchupB?.points ?? 0).toFixed(1)}
                </div>
                <div className={clsx(styles.side, styles.sideRight)}>
                  <Avatar url={teamB.avatarUrl} name={teamB.teamName} size={48} />
                  <span className={styles.stat}>{teamB.record}</span>
                  <span className={styles.stat}>{streakLabel(teamB.winStreak, teamB.lossStreak)}</span>
                  <span className={styles.stat}>{teamB.pointsFor.toFixed(1)} PF</span>
                </div>
              </div>
              <div className={styles.statements}>
                {statementsRevealed ? (
                  <>
                    <p className={styles.bubble}>
                      {statementA ? `„${statementA}“` : "— keine Stellungnahme —"}
                    </p>
                    <p className={styles.bubble}>
                      {statementB ? `„${statementB}“` : "— keine Stellungnahme —"}
                    </p>
                  </>
                ) : (
                  <p className={clsx(styles.bubble, styles.bubblePending)}>
                    Statements erscheinen Donnerstag 06:00
                  </p>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
