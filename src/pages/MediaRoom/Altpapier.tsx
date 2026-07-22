import { useState } from "react";
import { Skeleton } from "../../components/common/Skeleton";
import { berlinNow } from "../../media/berlinTime";
import { useAllEditions, type EditionWithCards } from "../../media/roomData";
import { PressCard } from "./PressCard";
import styles from "./Altpapier.module.css";

function editionDateLabel(revealAt: string): string {
  const b = berlinNow(new Date(revealAt));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(b.day)}.${pad(b.month)}.${b.year}`;
}

function EditionRow({ edition }: { edition: EditionWithCards }) {
  const [open, setOpen] = useState(false);
  const winner = edition.cards.find((c) => c.isQuoteOfTheWeek);

  return (
    <div className={styles.edition}>
      <button type="button" className={styles.editionToggle} onClick={() => setOpen((o) => !o)}>
        <span>
          Woche {edition.week ?? "?"} · {editionDateLabel(edition.revealAt)}
          {winner ? ` · Zitat der Woche: ${winner.teamName}` : ""}
        </span>
        <span aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
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
      )}
    </div>
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
