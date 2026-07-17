import { Link } from "react-router-dom";
import { useTeams } from "../hooks/useTeams";
import { useSeasonContext } from "../context/SeasonContext";
import { Card } from "../components/common/Card";
import { Avatar } from "../components/common/Avatar";
import { Skeleton } from "../components/common/Skeleton";
import { ErrorCard } from "../components/common/ErrorCard";
import { RevealGroup, RevealItem } from "../components/common/Reveal";
import styles from "./Teams.module.css";

export function Teams() {
  const { selectedSeason } = useSeasonContext();
  const { data, isLoading, error } = useTeams(selectedSeason?.leagueId ?? "");

  if (error) {
    return <ErrorCard message="Couldn't load teams." />;
  }

  return (
    <div>
      <h1>Teams</h1>
      {isLoading || !data ? (
        <div className={styles.grid}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} height={64} />
          ))}
        </div>
      ) : (
        <RevealGroup className={styles.grid}>
          {data.teams.map((team) => (
            <RevealItem key={team.rosterId}>
              <Card as={Link} to={`/team/${team.rosterId}`} interactive className={styles.teamCard}>
                <Avatar url={team.avatarUrl} name={team.teamName} size={40} />
                <div className={styles.teamInfo}>
                  <div className={styles.teamName}>{team.teamName}</div>
                  <div className={styles.record}>
                    {team.wins}-{team.losses}-{team.ties} · Div {team.division}
                  </div>
                </div>
              </Card>
            </RevealItem>
          ))}
        </RevealGroup>
      )}
    </div>
  );
}
