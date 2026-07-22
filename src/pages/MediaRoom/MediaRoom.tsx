import { useState } from "react";
import clsx from "clsx";
import { useSeasonContext } from "../../context/SeasonContext";
import { useIdentity } from "../../media/useIdentity";
import { phaseFor } from "../../media/schedule";
import { Pressekonferenz } from "./Pressekonferenz";
import { Pressespiegel } from "./Pressespiegel";
import { Altpapier } from "./Altpapier";
import styles from "./MediaRoom.module.css";

type Tab = "pressekonferenz" | "pressespiegel" | "altpapier";

const TABS: { id: Tab; label: string }[] = [
  { id: "pressekonferenz", label: "Pressekonferenz" },
  { id: "pressespiegel", label: "Pressespiegel" },
  { id: "altpapier", label: "Pressearchiv" },
];

export function MediaRoom() {
  const { currentSeason } = useSeasonContext();
  const leagueId = currentSeason?.leagueId ?? "";
  const { rosterId, setIdentity, clearIdentity } = useIdentity();
  const [tab, setTab] = useState<Tab>(() => (phaseFor() === "MEDIA_DAY" ? "pressekonferenz" : "pressespiegel"));

  return (
    <div>
      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={clsx(styles.tab, tab === t.id && styles.tabActive)}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "pressekonferenz" && (
        <Pressekonferenz leagueId={leagueId} rosterId={rosterId} onPick={setIdentity} />
      )}
      {tab === "pressespiegel" && <Pressespiegel rosterId={rosterId} />}
      {tab === "altpapier" && <Altpapier />}

      {rosterId !== null && (
        <div className={styles.footer}>
          <button type="button" className={styles.switchTeam} onClick={clearIdentity}>
            Team wechseln
          </button>
        </div>
      )}
    </div>
  );
}
