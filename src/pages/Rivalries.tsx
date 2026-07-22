import clsx from "clsx";
import { useSeasonContext } from "../context/SeasonContext";
import { useRivalryStandings } from "../media/useRivalryStandings";
import { MEDIA_CONFIG } from "../media/config";
import { Card } from "../components/common/Card";
import { Avatar } from "../components/common/Avatar";
import { Skeleton } from "../components/common/Skeleton";
import { ErrorCard } from "../components/common/ErrorCard";
import { RevealGroup, RevealItem } from "../components/common/Reveal";
import styles from "./Rivalries.module.css";

export function Rivalries() {
  const { currentSeason } = useSeasonContext();
  const leagueId = currentSeason?.leagueId ?? "";
  const { ranking, lambs, gameLog, teamsById, isLoading, error } = useRivalryStandings(leagueId);

  if (error) {
    return <ErrorCard message="Rivalitäts-Tabelle konnte nicht geladen werden." />;
  }

  if (isLoading || !currentSeason) {
    return (
      <div className={styles.wrap}>
        <Skeleton height={120} />
        <div style={{ marginTop: "var(--space-5)" }}>
          <Skeleton height={200} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <RevealGroup>
        <RevealItem>
          <Card className={styles.fireCard}>
            <div className={styles.content}>
              <p className={styles.eyebrow}>🔥 Rivalry Games 🔥</p>
              <h1 className={styles.headline}>Rivalitäts-Tabelle · Saison {MEDIA_CONFIG.season}</h1>
            </div>
          </Card>
        </RevealItem>

        <RevealItem>
          <Card className={styles.fireCard}>
            <div className={styles.content}>
              <h2 className={styles.sectionTitle}>Rangliste</h2>
              {ranking.length === 0 ? (
                <p className={styles.emptyState}>Noch keine Rivalitätsspiele ausgetragen.</p>
              ) : (
                ranking.map((row, i) => (
                  <div key={row.rosterId} className={styles.rankRow}>
                    <span className={clsx(styles.rank, i === 0 && styles.rankFirst)}>{i + 1}</span>
                    <Avatar url={row.avatarUrl} name={row.teamName} size={36} />
                    <span className={styles.rankName}>
                      <span className={styles.rankTeamName}>{row.teamName}</span>
                    </span>
                    <span className={styles.rankStats}>
                      <span className={styles.rankRecord}>
                        {row.wins}-{row.losses}
                        {row.ties > 0 ? `-${row.ties}` : ""}
                      </span>
                      <span className={styles.rankPf}>{row.pointsFor.toFixed(1)} PF</span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </RevealItem>

        <RevealItem>
          <Card className={styles.fireCard}>
            <div className={styles.content}>
              <h2 className={styles.sectionTitle}>Spielprotokoll</h2>
              {gameLog.length === 0 ? (
                <p className={styles.emptyState}>Noch keine Rivalitätsspiele gespielt.</p>
              ) : (
                gameLog.map((game) => {
                  const teamA = teamsById.get(game.rosterIdA);
                  const teamB = teamsById.get(game.rosterIdB);
                  const aWon = game.pointsA > game.pointsB;
                  const bWon = game.pointsB > game.pointsA;
                  return (
                    <div
                      key={`${game.week}-${game.rosterIdA}-${game.rosterIdB}`}
                      className={clsx(styles.gameLogRow, game.mutual && styles.gameLogRowMutual)}
                      title={game.mutual ? "Blood Feud" : undefined}
                    >
                      <span className={styles.gameLogWeek}>Wk {game.week}</span>
                      <div className={styles.gameLogMatchup}>
                        <div className={styles.gameLogTeam}>
                          <Avatar url={teamA?.avatarUrl ?? null} name={teamA?.teamName ?? "?"} size={24} />
                          <span className={clsx(styles.gameLogScore, aWon && styles.gameLogWinner)}>
                            {game.pointsA.toFixed(1)}
                          </span>
                        </div>
                        <span className={styles.gameLogVs}>:</span>
                        <div className={styles.gameLogTeam}>
                          <span className={clsx(styles.gameLogScore, bWon && styles.gameLogWinner)}>
                            {game.pointsB.toFixed(1)}
                          </span>
                          <Avatar url={teamB?.avatarUrl ?? null} name={teamB?.teamName ?? "?"} size={24} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </RevealItem>

        <RevealItem>
          <Card className={styles.lambsCard}>
            <h2 className={styles.sectionTitle}>🐑 Zarte Lämmer</h2>
            {lambs.length === 0 ? (
              <p className={styles.emptyState}>Alle Teams haben bereits ein Rivalitätsspiel bestritten.</p>
            ) : (
              <div className={styles.lambsGrid}>
                {lambs.map((row) => (
                  <div key={row.rosterId} className={styles.lamb}>
                    <Avatar url={row.avatarUrl} name={row.teamName} size={48} />
                    <span className={styles.lambName}>{row.teamName}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </RevealItem>
      </RevealGroup>

      <details className={styles.explainer}>
        <summary>Wie die Rivalitäts-Tabelle funktioniert</summary>
        <p>
          Nur Spiele gegen einen selbst gewählten Rivalen zählen für diese Tabelle — reguläre
          Saisonspiele gegen alle anderen Gegner fließen nicht ein. Die Rangliste sortiert nach
          Rivalitäts-Siegquote; bei Gleichstand entscheiden die in Rivalitätsspielen erzielten Punkte
          (PF). Teams, die noch kein Rivalitätsspiel bestritten haben, stehen stattdessen bei den
          „Zarte Lämmer".
        </p>
        <p>
          Eine Rivalität ist einseitig gültig: Wählt Team A Team B als Rivalen, zählt jedes Spiel
          zwischen beiden als Rivalitätsspiel — auch wenn B nicht auch A gewählt hat. Haben sich
          beide Seiten gegenseitig gewählt, gilt es als „Blood Feud" statt als normales „Rivalry Game".
        </p>
        <p>
          Im Spielprotokoll sind Blood-Feud-Spiele durch eine rote Hervorhebung der Zeile markiert;
          normale Rivalitätsspiele bleiben unmarkiert. Der Punktestand des jeweiligen Wochensiegers
          ist immer grün eingefärbt.
        </p>
      </details>
    </div>
  );
}
