import { useState } from "react";
import clsx from "clsx";
import { Card } from "../../components/common/Card";
import { Avatar } from "../../components/common/Avatar";
import { formatBerlinDateTime } from "../../media/berlinTime";
import type { PressCardData } from "../../media/roomData";
import styles from "./PressCard.module.css";

interface PressCardProps {
  card: PressCardData;
  rosterId: number | null;
  votingOpen: boolean;
  votingClosed: boolean;
  votingCloseAt?: Date;
  readOnly: boolean;
  onToggleLike?: (card: PressCardData) => void;
}

export function PressCard({ card, rosterId, votingOpen, votingClosed, votingCloseAt, readOnly, onToggleLike }: PressCardProps) {
  const [pending, setPending] = useState(false);
  const isOwnCard = card.rosterId === rosterId;
  const canVote = !readOnly && !isOwnCard && votingOpen && card.responseId !== null;

  const handleClick = async () => {
    if (!canVote || !onToggleLike || pending) return;
    setPending(true);
    try {
      onToggleLike(card);
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className={clsx(styles.card, card.isQuoteOfTheWeek && styles.winner)}>
      <div className={styles.byline}>
        <Avatar url={card.avatarUrl} name={card.teamName} size={36} />
        <div className={styles.names}>
          <span className={styles.teamName}>{card.teamName}</span>
          <span className={styles.managerName}>{card.managerName}</span>
        </div>
        {card.isQuoteOfTheWeek && <span className={styles.badge}>📰 {card.badgeLabel}</span>}
      </div>

      {card.question && <p className={styles.question}>{card.question}</p>}

      {card.answer ? (
        <p className={styles.answer}>„{card.answer}“</p>
      ) : (
        <p className={clsx(styles.answer, styles.noAnswer)}>— keine Stellungnahme —</p>
      )}

      <div className={styles.footer}>
        {isOwnCard || readOnly ? (
          <span className={styles.likeCountOnly}>👏 {card.likeCount}</span>
        ) : (
          <button
            type="button"
            className={clsx(styles.likeButton, card.likedByMe && styles.likedByMe)}
            onClick={handleClick}
            disabled={!votingOpen || card.responseId === null}
            title={
              !votingOpen && votingClosed
                ? votingCloseAt
                  ? `Abstimmung beendet — ${formatBerlinDateTime(votingCloseAt)} war Redaktionsschluss.`
                  : "Abstimmung beendet."
                : undefined
            }
          >
            👏 {card.likeCount}
          </button>
        )}
      </div>
    </Card>
  );
}
