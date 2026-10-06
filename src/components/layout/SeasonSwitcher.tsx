import { useState } from "react";
import { useSeasonContext } from "../../context/SeasonContext";
import { Sheet } from "../common/Sheet";
import styles from "./SeasonSwitcher.module.css";

export function SeasonSwitcher() {
  const { chain, currentSeason, selectedSeason, setSelectedSeason } = useSeasonContext();
  const [open, setOpen] = useState(false);

  if (chain.length === 0) return null;

  const isLive = selectedSeason?.leagueId === currentSeason?.leagueId;

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Season ${selectedSeason?.season ?? ""}. Change season`}
        onClick={() => setOpen(true)}
      >
        {isLive && <span className={styles.liveDot} aria-hidden="true" />}
        <span className="tabular-nums">{selectedSeason?.season ?? "Season"}</span>
        <span className={styles.chevron} aria-hidden="true">⌄</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Season">
        <ul className={styles.list}>
          {[...chain].reverse().map((season) => {
            const selected = season.leagueId === selectedSeason?.leagueId;
            return (
              <li key={season.leagueId}>
                <button
                  type="button"
                  className={styles.option}
                  aria-current={selected ? "true" : undefined}
                  onClick={() => {
                    setOpen(false);
                    setSelectedSeason(season);
                  }}
                >
                  <span className="tabular-nums">{season.season}</span>
                  {season.leagueId === currentSeason?.leagueId && <span className={styles.live}>Live</span>}
                  {selected && <span className={styles.check} aria-hidden="true">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </>
  );
}
