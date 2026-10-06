import { useState } from "react";
import { Avatar } from "../../components/common/Avatar";
import { Sheet } from "../../components/common/Sheet";
import { useTeams } from "../../hooks/useTeams";
import { ChevronIcon } from "./icons";
import { NotificationToggle } from "./NotificationToggle";
import styles from "./IdentityChip.module.css";

interface IdentityChipProps {
  leagueId: string;
  rosterId: number;
  onSwitchTeam: () => void;
}

/** "Sie sind: [avatar] Team" — opens a sheet for notifications and switching team. */
export function IdentityChip({ leagueId, rosterId, onSwitchTeam }: IdentityChipProps) {
  const [open, setOpen] = useState(false);
  const { data } = useTeams(leagueId);
  const team = data?.teams.find((t) => t.rosterId === rosterId);

  return (
    <>
      <button
        type="button"
        className={styles.chip}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className={styles.label}>Akkreditiert als</span>
        <Avatar url={team?.avatarUrl ?? null} name={team?.teamName ?? "?"} size={24} />
        <span className={styles.name}>{team?.teamName ?? "…"}</span>
        <ChevronIcon size={14} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Ihr Presseausweis">
        <div className={styles.body}>
          <div className={styles.who}>
            <Avatar url={team?.avatarUrl ?? null} name={team?.teamName ?? "?"} size={48} />
            <div>
              <div className={styles.whoName}>{team?.teamName ?? "…"}</div>
              <div className={styles.whoManager}>{team?.displayName}</div>
            </div>
          </div>
          <NotificationToggle rosterId={rosterId} />
          <button
            type="button"
            className={styles.switch}
            onClick={() => {
              setOpen(false);
              onSwitchTeam();
            }}
          >
            Team wechseln
          </button>
        </div>
      </Sheet>
    </>
  );
}
