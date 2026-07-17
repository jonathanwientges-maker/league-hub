import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import "@fontsource/archivo-black/index.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import { getLeague } from "../api/sleeper";
import { LEAGUE_ID, LEAGUE_NAME, RELEASE_DATE_UTC } from "../config/release";
import { useCountdown } from "./hooks/useCountdown";
import { Scoreboard } from "./components/Scoreboard";
import { FieldMeter } from "./components/FieldMeter";
import { RosterWall } from "./components/RosterWall";
import { LiveState } from "./components/LiveState";
import styles from "./GatePage.module.css";

const HOLD_MS = 800;

export function GatePage() {
  const releaseMs = useMemo(() => Date.parse(RELEASE_DATE_UTC), []);
  const countdown = useCountdown(releaseMs);

  const [visualPhase, setVisualPhase] = useState<"counting" | "live">(
    countdown.isLive ? "live" : "counting"
  );

  useEffect(() => {
    if (!countdown.isLive || visualPhase === "live") return;
    const timeout = setTimeout(() => setVisualPhase("live"), HOLD_MS);
    return () => clearTimeout(timeout);
  }, [countdown.isLive, visualPhase]);

  const leagueQuery = useQuery({
    queryKey: ["gate", "league", LEAGUE_ID],
    queryFn: () => getLeague(LEAGUE_ID),
    staleTime: Infinity,
    enabled: !LEAGUE_NAME,
  });
  const leagueName = LEAGUE_NAME || leagueQuery.data?.name || "";
  const shouldReduceMotion = useReducedMotion();
  const crossfadeDuration = shouldReduceMotion ? 0 : 0.6;

  return (
    <div className={styles.page} data-phase={visualPhase}>
      <div className={styles.atmosphere} aria-hidden="true">
        <div className={styles.floodlightLeft} />
        <div className={styles.floodlightRight} />
        <div className={styles.turf} />
        <div className={styles.grain} />
      </div>

      <AnimatePresence mode="wait">
        {visualPhase === "live" ? (
          <motion.div
            key="live"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: crossfadeDuration }}
          >
            <LiveState leagueName={leagueName} />
          </motion.div>
        ) : (
          <motion.div
            key="counting"
            className={styles.content}
            exit={{ opacity: 0 }}
            transition={{ duration: crossfadeDuration }}
          >
            <p className={styles.eyebrow}>
              {leagueName ? `${leagueName} · ` : ""}DYNASTY · SEASON 2026
            </p>
            <h1 className={styles.headline}>KICKOFF IS COMING</h1>
            <p className={styles.subline}>
              One league. Twelve franchises. Every seed, every pick, every tiebreaker — finally
              tracked in one place.
            </p>

            <Scoreboard parts={countdown.parts} releaseMs={releaseMs} />

            <FieldMeter />

            <RosterWall />

            <footer className={styles.footer}>
              <p>Built by your commissioner. Powered by Sleeper data.</p>
              <p className={styles.installHint}>
                Tip: add this page to your home screen — the app will appear here on launch day.
              </p>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
