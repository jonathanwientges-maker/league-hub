import { useEffect, useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Avatar } from "../../components/common/Avatar";
import { Skeleton } from "../../components/common/Skeleton";
import { berlinNow, formatBerlinDateTime } from "../../media/berlinTime";
import { votingClosesAt } from "../../media/schedule";
import { displayLabelForWeek } from "../../media/specialEvents";
import { useAllEditions, useLeaderboard, useToggleLike, type LeaderboardRow } from "../../media/roomData";
import { MEDIA_CONFIG } from "../../media/config";
import { useCountdown } from "../../media/useCountdown";
import { PressCard } from "./PressCard";
import { Disclosure } from "./Disclosure";
import { BallotIcon, ClapIcon, NewspaperIcon } from "./icons";
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
    const timeout = setTimeout(() => setShow(false), 800);
    return () => clearTimeout(timeout);
  }, [editionKey, shouldReduceMotion]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={styles.flashOverlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.55, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, times: [0, 0.2, 1], ease: "easeOut" }}
        />
      )}
    </AnimatePresence>
  );
}

const PODIUM_HEIGHT = [4.5, 3.25, 2.5]; // rem: 1st, 2nd, 3rd

function PodiumStep({ row, place }: { row: LeaderboardRow; place: 0 | 1 | 2 }) {
  const reduce = useReducedMotion();
  return (
    <div className={styles.podiumCol} data-place={place + 1}>
      <Avatar url={row.avatarUrl} name={row.teamName} size={place === 0 ? 56 : 44} />
      <span className={styles.podiumName}>{row.teamName}</span>
      <span className={styles.podiumLikes}>
        <ClapIcon size={14} /> {row.totalLikes}
      </span>
      <motion.div
        className={styles.podiumBlock}
        style={{ height: `${PODIUM_HEIGHT[place]}rem`, transformOrigin: "bottom" }}
        initial={{ scaleY: reduce ? 1 : 0 }}
        animate={{ scaleY: 1 }}
        transition={{ type: "spring", bounce: 0.2, duration: 0.6, delay: reduce ? 0 : 0.08 * (place + 1) }}
      >
        <span>{place + 1}</span>
      </motion.div>
    </div>
  );
}

function LeaderboardBody({ rosterId }: { rosterId: number | null }) {
  const { rows, isLoading } = useLeaderboard(rosterId);
  if (isLoading) return <Skeleton height={160} />;

  const [first, second, third, ...rest] = rows;
  return (
    <div className={styles.leaderboardBody}>
      {first && (
        <div className={styles.podium}>
          {second && <PodiumStep row={second} place={1} />}
          <PodiumStep row={first} place={0} />
          {third && <PodiumStep row={third} place={2} />}
        </div>
      )}
      {rest.length > 0 && (
        <ol className={styles.leaderboardList} start={4}>
          {rest.map((row, i) => (
            <li key={row.rosterId} className={styles.leaderboardRow}>
              <span className={styles.rank}>{i + 4}</span>
              <Avatar url={row.avatarUrl} name={row.teamName} size={28} />
              <span className={styles.leaderboardName}>{row.teamName}</span>
              <span className={styles.leaderboardStats}>
                <span className={styles.stat}>
                  <ClapIcon size={14} /> {row.totalLikes}
                </span>
                <span className={styles.stat}>
                  <NewspaperIcon size={14} /> {row.quoteWins}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Leaderboard({ rosterId }: { rosterId: number | null }) {
  return (
    <Disclosure
      className={styles.leaderboard}
      headerClassName={styles.leaderboardToggle}
      header="Liebling der Massen"
    >
      <LeaderboardBody rosterId={rosterId} />
    </Disclosure>
  );
}

/** Slim strip: what's open, how long, and how much of the voting window is gone. */
function VotingStrip({ revealAt, closesAt, badgeLabel }: { revealAt: Date; closesAt: Date; badgeLabel: string }) {
  const countdown = useCountdown(closesAt);
  const total = MEDIA_CONFIG.votingDurationHours * 3600_000;
  const left = Math.min(1, Math.max(0, (closesAt.getTime() - Date.now()) / total));
  void revealAt;
  return (
    <div className={styles.votingStrip} role="status">
      <span className={styles.votingIcon}>
        <BallotIcon size={20} />
      </span>
      <div className={styles.votingText}>
        <span className={styles.votingTitle}>Abstimmung läuft</span>
        <span className={styles.votingSub}>Klatschen Sie für das {badgeLabel}!</span>
        <span className={styles.votingBar} aria-hidden="true">
          <span className={styles.votingBarFill} style={{ transform: `scaleX(${left})` }} />
        </span>
      </div>
      <span className={styles.votingClock} title={`bis ${formatBerlinDateTime(closesAt)}`}>
        {countdown}
      </span>
    </div>
  );
}

export function Pressespiegel({ rosterId }: { rosterId: number | null }) {
  const { editions, isLoading } = useAllEditions(rosterId);
  const toggleLike = useToggleLike();
  const current = editions[0];

  const handleToggle = async (card: Parameters<typeof toggleLike>[0]) => {
    if (rosterId === null) return;
    await toggleLike(card, rosterId);
  };

  if (isLoading) {
    return (
      <div className={styles.wrap}>
        <Skeleton height={96} className={styles.leadWrap} />
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
  const revealAt = new Date(current.revealAt);
  const votingCloseAt = votingClosesAt(revealAt);
  // Managers who gave no statement this week get no card.
  const answered = current.cards.filter((c) => c.responseId !== null && c.answer?.trim());
  const lead = answered.find((c) => c.isQuoteOfTheWeek);
  const others = answered.filter((c) => c !== lead);

  const renderCard = (card: (typeof current.cards)[number], isLead = false) => (
    <PressCard
      key={card.rosterId + (card.responseId ?? "")}
      card={card}
      rosterId={rosterId}
      votingOpen={current.votingOpen}
      votingClosed={current.votingClosed}
      votingCloseAt={votingCloseAt}
      readOnly={false}
      lead={isLead}
      onToggleLike={handleToggle}
    />
  );

  return (
    <div className={styles.wrap}>
      <FlashOnce editionKey={current.revealAt} />
      <header className={styles.masthead}>
        <p className={styles.mastheadMeta}>
          {weekLabel ?? "Ausgabe"} · {editionDateLabel(current.revealAt)}
        </p>
        <h1 className={styles.headline}>Pressespiegel</h1>
      </header>

      {current.votingOpen && <VotingStrip revealAt={revealAt} closesAt={votingCloseAt} badgeLabel={badgeLabel} />}

      {lead && <div className={styles.leadWrap}>{renderCard(lead, true)}</div>}

      <div className={styles.grid}>{others.map((card) => renderCard(card))}</div>

      <Leaderboard rosterId={rosterId} />
    </div>
  );
}
