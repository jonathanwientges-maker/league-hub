import { useTeams } from "../../hooks/useTeams";
import { Avatar } from "../../components/common/Avatar";
import { Skeleton } from "../../components/common/Skeleton";
import styles from "./TeamPicker.module.css";

interface TeamPickerProps {
  leagueId: string;
  onPick: (rosterId: number) => void;
}

export function TeamPicker({ leagueId, onPick }: TeamPickerProps) {
  const { data, isLoading } = useTeams(leagueId);

  return (
    <div className={styles.wrap}>
      <p className={styles.eyebrow}>Akkreditierung</p>
      <h1 className={styles.headline}>Wer sind Sie? Die Akkreditierung, bitte.</h1>
      {isLoading ? (
        <div className={styles.grid}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} height={96} />
          ))}
        </div>
      ) : (
        <div className={styles.grid}>
          {(data?.teams ?? []).map((team) => (
            <button
              key={team.rosterId}
              type="button"
              className={styles.team}
              onClick={() => onPick(team.rosterId)}
            >
              <Avatar url={team.avatarUrl} name={team.teamName} size={56} />
              <span className={styles.teamName}>{team.teamName}</span>
              <span className={styles.managerName}>{team.displayName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
