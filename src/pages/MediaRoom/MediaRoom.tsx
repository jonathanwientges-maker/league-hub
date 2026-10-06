import { useRef, useState, type KeyboardEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import clsx from "clsx";
import { useSeasonContext } from "../../context/SeasonContext";
import { useIdentity } from "../../media/useIdentity";
import { phaseFor } from "../../media/schedule";
import { Pressekonferenz } from "./Pressekonferenz";
import { Pressespiegel } from "./Pressespiegel";
import { Altpapier } from "./Altpapier";
import { IdentityChip } from "./IdentityChip";
import styles from "./MediaRoom.module.css";

type Tab = "pressekonferenz" | "pressespiegel" | "altpapier";

const TABS: { id: Tab; label: string; short: string }[] = [
  { id: "pressekonferenz", label: "Pressekonferenz", short: "Konferenz" },
  { id: "pressespiegel", label: "Pressespiegel", short: "Spiegel" },
  { id: "altpapier", label: "Pressearchiv", short: "Archiv" },
];

const SWIPE_DISTANCE = 70;
const SWIPE_VELOCITY = 250;

export function MediaRoom() {
  const { currentSeason } = useSeasonContext();
  const leagueId = currentSeason?.leagueId ?? "";
  const { rosterId, setIdentity, clearIdentity } = useIdentity();
  const [tab, setTab] = useState<Tab>(() => (phaseFor() === "MEDIA_DAY" ? "pressekonferenz" : "pressespiegel"));
  const reduce = useReducedMotion();
  const prevIndex = useRef(TABS.findIndex((t) => t.id === tab));
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const index = TABS.findIndex((t) => t.id === tab);
  const direction = Math.sign(index - prevIndex.current);

  const go = (nextIndex: number, focus = false) => {
    const clamped = Math.max(0, Math.min(TABS.length - 1, nextIndex));
    if (clamped === index) return;
    prevIndex.current = index;
    setTab(TABS[clamped].id);
    if (focus) tabRefs.current[clamped]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") go((index + 1) % TABS.length, true);
    else if (e.key === "ArrowLeft") go((index - 1 + TABS.length) % TABS.length, true);
    else if (e.key === "Home") go(0, true);
    else if (e.key === "End") go(TABS.length - 1, true);
    else return;
    e.preventDefault();
  };

  return (
    <div>
      {rosterId !== null && (
        <div className={styles.identityRow}>
          <IdentityChip leagueId={leagueId} rosterId={rosterId} onSwitchTeam={clearIdentity} />
        </div>
      )}

      <div className={styles.tabs} role="tablist" aria-label="Media Room" onKeyDown={onKeyDown}>
        {TABS.map((t, i) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`mr-tab-${t.id}`}
              aria-selected={active}
              aria-controls="mr-panel"
              tabIndex={active ? 0 : -1}
              className={clsx(styles.tab, active && styles.tabActive)}
              onClick={() => go(i)}
            >
              {active && (
                <motion.span
                  layoutId="mr-tab-pill"
                  className={styles.pill}
                  transition={reduce ? { duration: 0.12 } : { type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className={styles.tabLabel}>
                <span className={styles.long}>{t.label}</span>
                <span className={styles.short}>{t.short}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Horizontal swipes move between tabs; vertical scroll and text-field
          gestures are left alone. */}
      <motion.div
        key={tab}
        id="mr-panel"
        role="tabpanel"
        aria-labelledby={`mr-tab-${tab}`}
        className={styles.panel}
        initial={{ opacity: 0, x: reduce ? 0 : direction * 28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={reduce ? { duration: 0.15 } : { type: "spring", bounce: 0, duration: 0.45 }}
        onPanEnd={(e, info) => {
          if ((e.target as HTMLElement).closest("textarea, input")) return;
          if (Math.abs(info.offset.x) < Math.abs(info.offset.y) * 2) return;
          const committed = Math.abs(info.offset.x) > SWIPE_DISTANCE || Math.abs(info.velocity.x) > SWIPE_VELOCITY;
          if (committed) go(index + (info.offset.x < 0 ? 1 : -1));
        }}
      >
        {tab === "pressekonferenz" && (
          <Pressekonferenz leagueId={leagueId} rosterId={rosterId} onPick={setIdentity} />
        )}
        {tab === "pressespiegel" && <Pressespiegel rosterId={rosterId} />}
        {tab === "altpapier" && <Altpapier />}
      </motion.div>
    </div>
  );
}
