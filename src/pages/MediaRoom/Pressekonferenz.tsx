import { useState, type CSSProperties } from "react";
import clsx from "clsx";
import { Avatar } from "../../components/common/Avatar";
import { Skeleton } from "../../components/common/Skeleton";
import { useLeague } from "../../hooks/useLeague";
import { MEDIA_CONFIG } from "../../media/config";
import { computeRevealAt, nextMediaDayOpenUtc, phaseFor } from "../../media/schedule";
import { useCountdown } from "../../media/useCountdown";
import { MediaRoomError, type MediaResponse, type ResponseKind } from "../../media/api";
import { usePressekonferenz } from "../../media/roomData";
import type { AssignedQuestion } from "../../media/engine/assignQuestion";
import { TeamPicker } from "./TeamPicker";
import styles from "./Pressekonferenz.module.css";

/** A plain mic glyph would depend on the platform's emoji set — draw our own so the motif looks the same everywhere. */
function MicIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

interface StatementFormProps {
  eyebrow: string;
  hot?: boolean;
  assigned: AssignedQuestion;
  existing: MediaResponse | null;
  kind: ResponseKind;
  onSubmit: (kind: ResponseKind, assigned: AssignedQuestion, answer: string) => Promise<void>;
}

function StatementForm({ eyebrow, hot = false, assigned, existing, kind, onSubmit }: StatementFormProps) {
  const [answer, setAnswer] = useState(existing?.answer ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overLimit = answer.length > MEDIA_CONFIG.answerMaxLength;
  const hasSubmitted = existing !== null;

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(kind, assigned, answer);
    } catch (e) {
      setError(e instanceof MediaRoomError ? e.message : "Da ist etwas schiefgelaufen. Bitte nochmal versuchen.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <p className={clsx(styles.eyebrow, hot && styles.eyebrowHot)}>{eyebrow}</p>
      <p className={styles.prompt}>Die Presse fragt:</p>
      <p className={styles.question}>{assigned.question}</p>
      <textarea
        className={styles.textarea}
        value={answer}
        maxLength={MEDIA_CONFIG.answerMaxLength + 40}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Ihr Statement…"
        aria-label="Statement"
      />
      <div className={styles.footerRow}>
        <span className={clsx(styles.counter, overLimit && styles.counterOver)}>
          {answer.length} / {MEDIA_CONFIG.answerMaxLength}
        </span>
        <button
          type="button"
          className={styles.submitButton}
          disabled={isSubmitting || overLimit || answer.trim().length === 0}
          onClick={handleSubmit}
        >
          {hasSubmitted ? "Statement überarbeiten" : "Statement abgeben"}
        </button>
      </div>
      <p className={styles.deadline}>Redaktionsschluss: heute 24:00</p>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

export function Pressekonferenz({ leagueId, rosterId, onPick }: { leagueId: string; rosterId: number | null; onPick: (rosterId: number) => void }) {
  const phase = phaseFor();
  const printingCountdown = useCountdown(computeRevealAt());
  const closedCountdown = useCountdown(nextMediaDayOpenUtc());
  const { data: league } = useLeague(leagueId);
  const sponsorLogoStyle = league?.avatar
    ? ({ "--sponsor-logo": `url(https://sleepercdn.com/avatars/${league.avatar})` } as CSSProperties)
    : undefined;

  const {
    isLoading,
    isResponseLoading,
    week,
    assigned,
    rivalryAssigned,
    hasRivalryGame,
    myResponse,
    myRivalryResponse,
    submit,
    team,
  } = usePressekonferenz(rosterId);

  if (rosterId === null) {
    return <TeamPicker leagueId={leagueId} onPick={onPick} />;
  }

  if (phase === "PRINTING") {
    return (
      <div className={styles.wrap}>
        <div className={styles.stateCard}>
          <p className={styles.stateHeadline}>🖨️ Die Druckerpresse läuft…</p>
          <p>Pressespiegel erscheint Donnerstag 06:00.</p>
          <p className={styles.countdown}>{printingCountdown}</p>
        </div>
      </div>
    );
  }

  if (phase === "REVEALED") {
    return (
      <div className={styles.wrap}>
        <div className={styles.stateCard}>
          <p className={styles.stateHeadline}>Die nächste Pressekonferenz beginnt Mittwoch 06:00.</p>
          <p className={styles.countdown}>{closedCountdown}</p>
        </div>
      </div>
    );
  }

  // MEDIA_DAY
  if (isLoading || isResponseLoading || !assigned) {
    return (
      <div className={styles.wrap}>
        <Skeleton height={280} />
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.podium} style={sponsorLogoStyle}>
        <div className={styles.sponsorWall} aria-hidden="true" />
        <div className={styles.spotlight} aria-hidden="true" />
        <div className={styles.podiumContent}>
          <div className={styles.avatarWrap}>
            <Avatar url={team?.avatarUrl ?? null} name={team?.teamName ?? "?"} size={64} />
          </div>
          <div className={styles.micMotif}>
            <MicIcon />
          </div>
          <StatementForm
            eyebrow={
              (week ?? 1) <= MEDIA_CONFIG.thresholds.seasonKickoffMaxWeek
                ? "MEDIA DAY · PRESEASON"
                : `MEDIA DAY · WOCHE ${week}`
            }
            assigned={assigned}
            existing={myResponse}
            kind="media_day"
            onSubmit={submit}
          />
        </div>
      </div>

      {hasRivalryGame && rivalryAssigned && (
        <div className={clsx(styles.podium, styles.rivalryBlock)} style={sponsorLogoStyle}>
          <div className={styles.sponsorWall} aria-hidden="true" />
          <div className={styles.spotlight} aria-hidden="true" />
          <div className={styles.podiumContent}>
            <StatementForm
              eyebrow="RIVALRY WEEK"
              hot
              assigned={rivalryAssigned}
              existing={myRivalryResponse}
              kind="rivalry_statement"
              onSubmit={submit}
            />
          </div>
        </div>
      )}
    </div>
  );
}
