import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { LeaguePhase } from "../../domain/leaguePhase";
import { getCountdownParts } from "../../domain/countdown";
import { RevealGroup, RevealItem } from "../common/Reveal";
import styles from "./SeasonHero.module.css";

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  const shouldReduceMotion = useReducedMotion();
  const display = String(value).padStart(2, "0");

  return (
    <div className={styles.unit}>
      <div className={styles.unitValueWrap}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={shouldReduceMotion ? "static" : display}
            className={styles.unitValue}
            initial={shouldReduceMotion ? false : { y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { y: 12, opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            {display}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className={styles.unitLabel}>{label}</div>
    </div>
  );
}

function DraftCountdown({ draftStartMs }: { draftStartMs: number }) {
  const now = useNow(1000);
  const parts = getCountdownParts(now, draftStartMs);

  // dateStyle/timeStyle can't be combined with timeZoneName per the
  // Intl.DateTimeFormat spec (throws RangeError) — spell out the
  // equivalent "full" components individually instead.
  const localDateTime = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(draftStartMs);

  return (
    <>
      <div className={styles.countdown}>
        <CountdownUnit value={parts.days} label="Days" />
        <div className={styles.divider} />
        <CountdownUnit value={parts.hours} label="Hours" />
        <div className={styles.divider} />
        <CountdownUnit value={parts.minutes} label="Min" />
        <div className={styles.divider} />
        <CountdownUnit value={parts.seconds} label="Sec" />
      </div>
      <p className={styles.draftDateLine}>{localDateTime}</p>
    </>
  );
}

export interface SeasonHeroProps {
  phase: Extract<
    LeaguePhase,
    "pre-draft-unscheduled" | "pre-draft-countdown" | "drafting" | "pre-season"
  >;
  season: string;
  leagueId: string;
  draftId?: string;
  draftStartMs: number | null;
  reigningChampionTeamName?: string;
}

/**
 * Renders the pre-draft / drafting / pre-season states of the home hero.
 * regular-season, playoffs, and complete keep rendering Home.tsx's existing
 * v1 hero markup instead — this component is only mounted for the four
 * phases above (see isExtendedHeroPhase in Home.tsx).
 */
export function SeasonHero({
  phase,
  season,
  leagueId,
  draftId,
  draftStartMs,
  reigningChampionTeamName,
}: SeasonHeroProps) {
  const draftUrl = draftId
    ? `https://sleeper.com/draft/nfl/${draftId}`
    : `https://sleeper.com/leagues/${leagueId}`;

  return (
    <RevealGroup className={styles.hero}>
      <div className={styles.gradientBg} aria-hidden="true" />
      <div className={styles.content}>
        <RevealItem>
          <p className={styles.eyebrow}>Season {season}</p>
        </RevealItem>

        {phase === "pre-draft-countdown" && draftStartMs !== null && (
          <>
            <RevealItem>
              <h1 className={styles.headline}>The Draft Is Coming</h1>
            </RevealItem>
            <RevealItem>
              <DraftCountdown draftStartMs={draftStartMs} />
            </RevealItem>
            {reigningChampionTeamName && (
              <RevealItem>
                <p className={styles.hypeLine}>
                  Reigning champion: {reigningChampionTeamName}
                </p>
              </RevealItem>
            )}
          </>
        )}

        {phase === "pre-draft-unscheduled" && (
          <>
            <RevealItem>
              <h1 className={styles.headline}>The Draft Is Coming</h1>
            </RevealItem>
            <RevealItem>
              <p className={styles.tbdLine}>Draft date: TBD</p>
              <p className={styles.waitingLine}>Waiting on the commissioner…</p>
            </RevealItem>
          </>
        )}

        {phase === "drafting" && (
          <>
            <RevealItem>
              <h1 className={styles.headline}>
                <span className={styles.liveDot} aria-hidden="true" />
                Draft in progress
              </h1>
            </RevealItem>
            <RevealItem>
              <a
                className={styles.sleeperLink}
                href={draftUrl}
                target="_blank"
                rel="noreferrer"
              >
                Watch live on Sleeper →
              </a>
            </RevealItem>
          </>
        )}

        {phase === "pre-season" && (
          <>
            <RevealItem>
              <h1 className={styles.headline}>The board is set.</h1>
            </RevealItem>
            <RevealItem>
              <a
                className={styles.sleeperLink}
                href={draftUrl}
                target="_blank"
                rel="noreferrer"
              >
                View draft results on Sleeper →
              </a>
            </RevealItem>
          </>
        )}
      </div>
    </RevealGroup>
  );
}
