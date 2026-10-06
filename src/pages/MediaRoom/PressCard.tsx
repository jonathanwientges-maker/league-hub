import { useEffect, useState } from "react";
import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Card } from "../../components/common/Card";
import { Avatar } from "../../components/common/Avatar";
import { formatBerlinDateTime } from "../../media/berlinTime";
import type { PressCardData } from "../../media/roomData";
import { ClapIcon } from "./icons";
import styles from "./PressCard.module.css";

interface PressCardProps {
  card: PressCardData;
  rosterId: number | null;
  votingOpen: boolean;
  votingClosed: boolean;
  votingCloseAt?: Date;
  readOnly: boolean;
  /** Lead story: the Quote of the Week, shown big. */
  lead?: boolean;
  onToggleLike?: (card: PressCardData) => Promise<void> | void;
}

/** Count that rolls to its new value instead of swapping. */
function RollingCount({ value }: { value: number }) {
  const reduce = useReducedMotion();
  return (
    <span className={styles.count}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ opacity: 0, y: reduce ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : -10 }}
          transition={{ type: "spring", bounce: 0, duration: 0.3 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function PressCard({ card, rosterId, votingOpen, votingClosed, votingCloseAt, readOnly, lead = false, onToggleLike }: PressCardProps) {
  const reduce = useReducedMotion();
  // Optimistic like: the UI answers on press; the server result replaces it.
  const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const isOwnCard = card.rosterId === rosterId;
  const canVote = !readOnly && !isOwnCard && votingOpen && card.responseId !== null;

  const liked = optimisticLiked ?? card.likedByMe;
  const likeCount = card.likeCount + (liked === card.likedByMe ? 0 : liked ? 1 : -1);

  useEffect(() => {
    if (!showUndo) return;
    const id = setTimeout(() => setShowUndo(false), 4000);
    return () => clearTimeout(id);
  }, [showUndo]);

  const toggle = async () => {
    if (!canVote || !onToggleLike || optimisticLiked !== null) return;
    const next = !liked;
    setOptimisticLiked(next);
    setShowUndo(next);
    if (next) navigator.vibrate?.(10);
    try {
      await onToggleLike(card);
    } catch {
      setShowUndo(false);
    } finally {
      setOptimisticLiked(null);
    }
  };

  return (
    <Card className={clsx(styles.card, lead && styles.lead, card.isQuoteOfTheWeek && styles.winner)}>
      <div className={styles.byline}>
        <Avatar url={card.avatarUrl} name={card.teamName} size={lead ? 48 : 36} />
        <div className={styles.names}>
          <span className={styles.teamName}>{card.teamName}</span>
          <span className={styles.managerName}>{card.managerName}</span>
        </div>
        {card.isQuoteOfTheWeek && <span className={styles.stamp}>{card.badgeLabel}</span>}
      </div>

      {card.question && <p className={styles.question}>{card.question}</p>}

      {card.answer ? (
        <p className={styles.answer}>{lead ? card.answer : `„${card.answer}“`}</p>
      ) : (
        <p className={clsx(styles.answer, styles.noAnswer)}>— keine Stellungnahme —</p>
      )}

      <div className={styles.footer}>
        {isOwnCard || readOnly ? (
          <span className={styles.likeCountOnly}>
            <ClapIcon size={16} /> {card.likeCount}
          </span>
        ) : (
          <>
            <AnimatePresence>
              {showUndo && (
                <motion.button
                  type="button"
                  className={styles.undo}
                  initial={{ opacity: 0, x: reduce ? 0 : 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  onClick={() => void toggle()}
                >
                  Rückgängig
                </motion.button>
              )}
            </AnimatePresence>
            <motion.button
              type="button"
              className={clsx(styles.likeButton, liked && styles.likedByMe)}
              onClick={toggle}
              disabled={!votingOpen || card.responseId === null}
              aria-pressed={liked}
              aria-label={`Klatschen, ${likeCount}`}
              whileTap={reduce ? undefined : { scale: 0.92 }}
              title={
                !votingOpen && votingClosed
                  ? votingCloseAt
                    ? `Abstimmung beendet — ${formatBerlinDateTime(votingCloseAt)} war Redaktionsschluss.`
                    : "Abstimmung beendet."
                  : undefined
              }
            >
              <motion.span
                className={styles.clap}
                animate={liked && !reduce ? { scale: [1, 1.35, 1], rotate: [0, -14, 0] } : { scale: 1, rotate: 0 }}
                transition={{ type: "spring", bounce: 0.5, duration: 0.5 }}
              >
                <ClapIcon size={18} filled={liked} />
              </motion.span>
              <RollingCount value={likeCount} />
            </motion.button>
          </>
        )}
      </div>
    </Card>
  );
}
