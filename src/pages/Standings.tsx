import { useTeams } from "../hooks/useTeams";
import { useSeasonContext } from "../context/SeasonContext";
import { rankDivisions } from "../domain/standings";
import { Card } from "../components/common/Card";
import { Skeleton } from "../components/common/Skeleton";
import { ErrorCard } from "../components/common/ErrorCard";
import { RevealGroup, RevealItem } from "../components/common/Reveal";
import { DivisionTable } from "../components/tables/DivisionTable";
import { FullStandingsTable } from "../components/tables/FullStandingsTable";
import { PointsBarChart } from "../components/tables/PointsBarChart";
import styles from "./Standings.module.css";

export function Standings() {
  const { selectedSeason } = useSeasonContext();
  const { data, isLoading, error } = useTeams(selectedSeason?.leagueId ?? "");

  if (error) {
    return <ErrorCard message="Couldn't load standings." />;
  }

  if (isLoading || !data) {
    return (
      <div className={styles.divisionGrid}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height={260} />
        ))}
      </div>
    );
  }

  const standings = rankDivisions(data.teams, data.h2hMap);
  const divisions = [...new Set(standings.map((s) => s.division))].sort((a, b) => a - b);

  return (
    <div>
      <h1>Standings</h1>

      <RevealGroup className={styles.divisionGrid}>
        {divisions.map((division) => (
          <RevealItem key={division}>
            <Card className={styles.card}>
              <DivisionTable
                title={`Division ${division}`}
                standings={standings.filter((s) => s.division === division)}
              />
            </Card>
          </RevealItem>
        ))}
      </RevealGroup>

      <div className={styles.section}>
        <h2>Full League</h2>
        <Card className={styles.card}>
          <div className={styles.tableWrap}>
            <FullStandingsTable teams={data.teams} />
          </div>
        </Card>
      </div>

      <div className={styles.section}>
        <h2>Actual vs. Potential Points</h2>
        <Card className={styles.card}>
          <PointsBarChart teams={data.teams} />
        </Card>
      </div>
    </div>
  );
}
