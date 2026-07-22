import { Link } from "react-router-dom";
import clsx from "clsx";
import { Avatar } from "../common/Avatar";
import { Chip } from "../common/Chip";
import { useAllEditions } from "../../media/roomData";
import { hashSeed, mulberry32 } from "../../media/engine/rng";
import styles from "./QuoteOfTheWeekCard.module.css";

export function QuoteOfTheWeekCard() {
  const { editions, isLoading } = useAllEditions(null);
  const current = editions[0];

  if (isLoading || !current) return null;

  const withAnswers = current.cards.filter((c) => c.answer);
  if (withAnswers.length === 0) return null;

  const winner = current.cards.find((c) => c.isQuoteOfTheWeek);
  const isWinner = Boolean(winner);

  let featured = winner;
  if (!featured) {
    const rng = mulberry32(hashSeed(current.revealAt));
    featured = withAnswers[Math.floor(rng() * withAnswers.length)];
  }
  if (!featured) return null;

  return (
    <Link to="/media-room" className={clsx(styles.wrap, isWinner && styles.winner)}>
      {isWinner ? (
        <div className={styles.eyebrowRow}>
          <p className={styles.eyebrow}>
            Pressespiegel{current.week !== null ? ` · Woche ${current.week}` : ""}
          </p>
          <Chip tone="accent">📰 Zitat der Woche</Chip>
        </div>
      ) : (
        <p className={styles.freshHeadline}>Frisch aus der Druckerei</p>
      )}
      <p className={styles.quote}>„{featured.answer}“</p>
      {isWinner ? (
        <div className={styles.byline}>
          <Avatar url={featured.avatarUrl} name={featured.teamName} size={32} />
          <span className={styles.bylineName}>{featured.teamName}</span>
          <span className={styles.likes}>👏 {featured.likeCount}</span>
          <span className={styles.cta}>Zum Pressespiegel →</span>
        </div>
      ) : (
        <div className={styles.byline}>
          <Avatar url={featured.avatarUrl} name={featured.teamName} size={32} />
          <span className={styles.cta}>Zum Pressespiegel →</span>
        </div>
      )}
    </Link>
  );
}
