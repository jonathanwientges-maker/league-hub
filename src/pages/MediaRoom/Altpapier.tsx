import { Skeleton } from "../../components/common/Skeleton";
import { Avatar } from "../../components/common/Avatar";
import { berlinNow } from "../../media/berlinTime";
import { displayLabelForWeek } from "../../media/specialEvents";
import { useAllEditions, type EditionWithCards } from "../../media/roomData";
import { PressCard } from "./PressCard";
import { Disclosure } from "./Disclosure";
import styles from "./Altpapier.module.css";

function editionDateLabel(revealAt: string): string {
  const b = berlinNow(new Date(revealAt));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(b.day)}.${pad(b.month)}.${b.year}`;
}

function EditionRow({ edition }: { edition: EditionWithCards }) {
  const winner = edition.cards.find((c) => c.isQuoteOfTheWeek);
  const weekLabel = edition.week !== null ? (displayLabelForWeek(edition.week) ?? `Woche ${edition.week}`) : "Woche ?";

  return (
    <Disclosure
      className={styles.edition}
      headerClassName={styles.editionToggle}
      header={
        <>
          {winner && <Avatar url={winner.avatarUrl} name={winner.teamName} size={32} />}
          <span className={styles.editionText}>
            <span className={styles.editionTitle}>
              {weekLabel} · {editionDateLabel(edition.revealAt)}
            </span>
            {winner && (
              <span className={styles.editionWinner}>
                {winner.badgeLabel}: {winner.teamName}
              </span>
            )}
          </span>
        </>
      }
    >
      <div className={styles.grid}>
        {edition.cards.map((card) => (
          <PressCard
            key={card.rosterId + (card.responseId ?? "")}
            card={card}
            rosterId={null}
            votingOpen={false}
            votingClosed={edition.votingClosed}
            readOnly
          />
        ))}
      </div>
    </Disclosure>
  );
}

export function Altpapier() {
  const { editions, isLoading } = useAllEditions(null);
  const older = editions.slice(1);

  if (isLoading) {
    return (
      <div className={styles.wrap}>
        <Skeleton height={44} />
      </div>
    );
  }

  if (older.length === 0) {
    return (
      <div className={styles.wrap}>
        <p className={styles.emptyState}>Noch kein Pressearchiv — die Saison ist jung.</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {older.map((edition) => (
        <EditionRow key={edition.revealAt} edition={edition} />
      ))}
    </div>
  );
}
