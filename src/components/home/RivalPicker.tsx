import clsx from "clsx";
import { Avatar } from "../common/Avatar";
import { Skeleton } from "../common/Skeleton";
import { useTeams } from "../../hooks/useTeams";
import { useIdentity } from "../../media/useIdentity";
import { useMyRivals } from "../../media/useMyRivals";
import { MEDIA_CONFIG } from "../../media/config";
import { TeamPicker } from "../../pages/MediaRoom/TeamPicker";
import styles from "./RivalPicker.module.css";

const MAX_RIVALS = 2;

/**
 * Home Page, pre-draft only (see isRivalPickerPhase in Home.tsx): each
 * manager self-picks up to 2 rivals for the season. Editable any time before
 * the draft; once it starts, this component simply stops rendering and the
 * picks already made become the season's fixed rivalry pairs.
 */
export function RivalPicker({ leagueId }: { leagueId: string }) {
  const { rosterId, setIdentity } = useIdentity();
  const { data: teamsData, isLoading: teamsLoading } = useTeams(leagueId);
  const { rivals, isLoading: rivalsLoading, toggle } = useMyRivals(rosterId);

  if (rosterId === null) {
    return (
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>Vor dem Draft</p>
        <h2 className={styles.headline}>Wählen Sie Ihre Rivalen</h2>
        <p className={styles.subline}>
          Akkreditieren Sie sich, um bis zu {MAX_RIVALS} Rivalen für die Saison {MEDIA_CONFIG.season}{" "}
          festzulegen.
        </p>
        <TeamPicker leagueId={leagueId} onPick={setIdentity} />
      </div>
    );
  }

  const otherTeams = (teamsData?.teams ?? []).filter((t) => t.rosterId !== rosterId);
  const atCap = rivals.length >= MAX_RIVALS;

  return (
    <div className={styles.wrap}>
      <p className={styles.eyebrow}>Vor dem Draft</p>
      <h2 className={styles.headline}>Wählen Sie Ihre Rivalen für die Saison {MEDIA_CONFIG.season}</h2>
      <p className={styles.subline}>
        Bis zu {MAX_RIVALS} Teams. Änderbar bis der Draft beginnt — danach werden die Rivalitäten für die
        Saison fixiert.
      </p>

      {teamsLoading || rivalsLoading ? (
        <div className={styles.grid}>
          {Array.from({ length: 11 }).map((_, i) => (
            <Skeleton key={i} height={110} />
          ))}
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {otherTeams.map((team) => {
              const selected = rivals.includes(team.rosterId);
              return (
                <button
                  key={team.rosterId}
                  type="button"
                  className={clsx(styles.team, selected && styles.teamSelected)}
                  disabled={!selected && atCap}
                  onClick={() => toggle(team.rosterId)}
                >
                  {selected && (
                    <span className={styles.checkmark} aria-hidden="true">
                      ✓
                    </span>
                  )}
                  <Avatar url={team.avatarUrl} name={team.teamName} size={48} />
                  <span className={styles.teamName}>{team.teamName}</span>
                  <span className={styles.managerName}>{team.displayName}</span>
                </button>
              );
            })}
          </div>
          <p className={styles.countHint}>
            {rivals.length} / {MAX_RIVALS} Rivalen ausgewählt
          </p>
        </>
      )}
    </div>
  );
}
