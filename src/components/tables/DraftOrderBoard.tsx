import clsx from "clsx";
import type { DraftPick } from "../../domain/pickPlacement";
import type { Team } from "../../domain/types";
import { Avatar } from "../common/Avatar";
import styles from "./DraftOrderBoard.module.css";

interface DraftOrderBoardProps {
  draftOrder: DraftPick[];
  teamsById: Map<number, Team>;
}

export function DraftOrderBoard({ draftOrder, teamsById }: DraftOrderBoardProps) {
  return (
    <div className={styles.board}>
      {draftOrder.map((pick) => {
        const team = pick.rosterId !== null ? teamsById.get(pick.rosterId) : undefined;
        const isGold = pick.pick === "1.01";

        if (!team) {
          return (
            <div key={pick.pick} className={clsx(styles.slot, styles.slotGhost)}>
              <span className={styles.pickNumber}>{pick.pick}</span>
              <span className={styles.ghostText}>TBD — decided by {pick.source}</span>
            </div>
          );
        }

        return (
          <div key={pick.pick} className={clsx(styles.slot, isGold && styles.slotGold)}>
            <span className={styles.pickNumber}>{pick.pick}</span>
            <Avatar url={team.avatarUrl} name={team.teamName} size={32} />
            <div className={styles.info}>
              <div className={styles.teamName}>{team.teamName}</div>
              <div className={styles.source}>{pick.source}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
