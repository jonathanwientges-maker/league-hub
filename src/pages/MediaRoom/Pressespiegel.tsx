import { useEffect, useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Skeleton } from "../../components/common/Skeleton";
import { berlinNow, formatBerlinDateTime } from "../../media/berlinTime";
import { votingClosesAt } from "../../media/schedule";
import { displayLabelForWeek } from "../../media/specialEvents";
import { useAllEditions, useLeaderboard, useToggleLike } from "../../media/roomData";
import { PressCard } from "./PressCard";
import styles from "./Pressespiegel.module.css";

function editionDateLabel(revealAt: string): string {
  const b = berlinNow(new Date(revealAt));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(b.day)}.${pad(b.month)}.${b.year}`;
}

function FlashOnce({ editionKey }: { editionKey: string }) {
  const shouldReduceMotion = useReducedMotion();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (shouldReduceMotion) return;
    const flagKey = `mediaroom.flash.${editionKey}`;
    if (sessionStorage.getItem(flagKey)) return;
    sessionStorage.setItem(flagKey, "1");
    setShow(true);
    const timeout = setTimeout(() => setShow(false), 900);
    return () => clearTimeout(timeout);
  }, [editionKey, shouldReduceMotion]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={styles.flashOverlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.9, 0, 0.7, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, times: [0, 0.15, 0.35, 0.55, 1] }}
        />
      )}
    </AnimatePresence>
  );
}

function Leaderboard({ rosterId }: { rosterId: number | null }) {
  const [open, setOpen] = useState(false);
  const { rows, isLoading } = useLeaderboard(rosterId);

  return (
    <div className={styles.leaderboard}>
      <button type="button" className={styles.leaderboardToggle} onClick={() => setOpen((o) => !o)}>
        <span>Liebling der Massen</span>
        <span aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ul className={styles.leaderboardList}>
          {isLoading ? (
            <Skeleton height={120} />
          ) : (
            rows.map((row, i) => (
              <li key={row.rosterId} className={styles.leaderboardRow}>
                <span className={i === 0 ? `${styles.rank} ${styles.rankFirst}` : styles.rank}>{i + 1}</span>
                <span className={styles.leaderboardName}>{row.teamName}</span>
                <span className={styles.leaderboardStats}>
                  <span>👏 {row.totalLikes}</span>
                  <span>📰 {row.quoteWins}</span>
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export function Pressespiegel({ rosterId }: { rosterId: number | null }) {
  const { editions, isLoading } = useAllEditions(rosterId);
  const toggleLike = useToggleLike();
  const current = editions[0];

  const handleToggle = (card: Parameters<typeof toggleLike>[0]) => {
    if (rosterId === null) return;
    void toggleLike(card, rosterId);
  };

  if (isLoading) {
    return (
      <div className={styles.wrap}>
        <Skeleton height={40} className={styles.header} />
        <div className={styles.grid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={160} />
          ))}
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className={styles.wrap}>
        <p className={styles.emptyState}>Noch kein Pressespiegel — die Saison ist jung.</p>
      </div>
    );
  }

  const weekLabel = current.week !== null ? (displayLabelForWeek(current.week) ?? `Woche ${current.week}`) : null;
  const badgeLabel = current.cards[0]?.badgeLabel ?? "Zitat der Woche";
  const votingCloseAt = votingClosesAt(new Date(current.revealAt));

  return (
    <div className={styles.wrap}>
      <FlashOnce editionKey={current.revealAt} />
      <div className={styles.header}>
        <h1 className={styles.headline}>Pressespiegel{weekLabel ? ` · ${weekLabel}` : ""}</h1>
        <p className={styles.editionDate}>{editionDateLabel(current.revealAt)}</p>
      </div>

      {current.votingOpen && (
        <p className={styles.votingBanner}>
          🗳️ Abstimmung läuft bis {formatBerlinDateTime(votingCloseAt)} — Klatschen Sie für das {badgeLabel}!
        </p>
      )}

      <div className={styles.grid}>
        {current.cards.map((card) => (
          <PressCard
            key={card.rosterId + (card.responseId ?? "")}
            card={card}
            rosterId={rosterId}
            votingOpen={current.votingOpen}
            votingClosed={current.votingClosed}
            votingCloseAt={votingCloseAt}
            readOnly={false}
            onToggleLike={handleToggle}
          />
        ))}
      </div>

      <Leaderboard rosterId={rosterId} />
    </div>
  );
}
