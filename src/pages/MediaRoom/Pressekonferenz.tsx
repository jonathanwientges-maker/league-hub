import { useEffect, useState, type CSSProperties } from "react";
import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Avatar } from "../../components/common/Avatar";
import { Skeleton } from "../../components/common/Skeleton";
import { useLeague } from "../../hooks/useLeague";
import { MEDIA_CONFIG } from "../../media/config";
import { MediaRoomError, type MediaResponse, type ResponseKind } from "../../media/api";
import { usePressekonferenz } from "../../media/roomData";
import type { AssignedQuestion } from "../../media/engine/assignQuestion";
import { TeamPicker } from "./TeamPicker";
import { WaitingCard } from "./WaitingCard";
import { CheckIcon, PrinterIcon, NewspaperIcon } from "./icons";
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

/** Types the question out once per session (full text always available to assistive tech). */
function TypeOn({ text }: { text: string }) {
  const reduce = useReducedMotion();
  const storageKey = `mediaroom.typed.${text}`;
  const [shown, setShown] = useState(() => {
    if (reduce) return text.length;
    try {
      return sessionStorage.getItem(storageKey) ? text.length : 0;
    } catch {
      return text.length;
    }
  });

  useEffect(() => {
    if (shown >= text.length) return;
    const id = setInterval(() => {
      setShown((n) => {
        const next = n + 2;
        if (next >= text.length) {
          clearInterval(id);
          try {
            sessionStorage.setItem(storageKey, "1");
          } catch {
            /* non-fatal */
          }
          return text.length;
        }
        return next;
      });
    }, 26);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.slice(0, shown)}
        <span style={{ visibility: "hidden" }}>{text.slice(shown)}</span>
      </span>
    </>
  );
}

/** Thin progress ring; shows the remaining count only once it gets tight. */
function CharRing({ used, max }: { used: number; max: number }) {
  const r = 11;
  const circumference = 2 * Math.PI * r;
  const remaining = max - used;
  const tone = remaining < 0 ? "over" : remaining <= 20 ? "tight" : "ok";
  return (
    <span className={styles.ring} data-tone={tone} role="img" aria-label={`${used} von ${max} Zeichen`}>
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
        <circle cx="15" cy="15" r={r} className={styles.ringTrack} />
        <circle
          cx="15"
          cy="15"
          r={r}
          className={styles.ringFill}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.min(1, used / max))}
          transform="rotate(-90 15 15)"
        />
      </svg>
      {remaining <= 20 && <span className={styles.ringNumber}>{remaining}</span>}
    </span>
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
  const [confirmed, setConfirmed] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!confirmed) return;
    const id = setTimeout(() => setConfirmed(false), 2600);
    return () => clearTimeout(id);
  }, [confirmed]);

  const overLimit = answer.length > MEDIA_CONFIG.answerMaxLength;
  const hasSubmitted = existing !== null;

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(kind, assigned, answer);
      setConfirmed(true);
      // Same moment as the visual: a light tap where the platform supports it.
      navigator.vibrate?.(15);
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
      <p className={styles.question}>
        <TypeOn text={assigned.question} />
      </p>
      <textarea
        className={styles.textarea}
        value={answer}
        maxLength={MEDIA_CONFIG.answerMaxLength + 40}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Ihr Statement…"
        aria-label="Statement"
      />
      <div className={styles.footerRow}>
        <CharRing used={answer.length} max={MEDIA_CONFIG.answerMaxLength} />
        <motion.button
          type="button"
          className={styles.submitButton}
          data-confirmed={confirmed}
          disabled={isSubmitting || overLimit || answer.trim().length === 0}
          onClick={handleSubmit}
          animate={confirmed && !reduce ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          transition={{ type: "spring", bounce: 0.35, duration: 0.45 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={confirmed ? "done" : "idle"}
              className={styles.submitLabel}
              initial={{ opacity: 0, y: reduce ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduce ? 0 : -6 }}
              transition={{ duration: 0.14 }}
            >
              {confirmed ? (
                <>
                  <CheckIcon size={18} /> Abgegeben
                </>
              ) : hasSubmitted ? (
                "Statement überarbeiten"
              ) : (
                "Statement abgeben"
              )}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>
      <p className={styles.deadline} role="status">
        {confirmed
          ? "Gespeichert. Bis Redaktionsschluss (heute 24:00) können Sie es noch überarbeiten."
          : "Redaktionsschluss: heute 24:00"}
      </p>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

export function Pressekonferenz({ leagueId, rosterId, onPick }: { leagueId: string; rosterId: number | null; onPick: (rosterId: number) => void }) {
  const { data: league } = useLeague(leagueId);
  const sponsorLogoStyle = league?.avatar
    ? ({ "--sponsor-logo": `url(https://sleepercdn.com/avatars/${league.avatar})` } as CSSProperties)
    : undefined;

  const {
    isLoading,
    isResponseLoading,
    phase,
    countdownTarget,
    eyebrow,
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
        <WaitingCard
          icon={<PrinterIcon />}
          headline="Die Druckerpresse läuft…"
          verb="Pressespiegel erscheint"
          target={countdownTarget}
          windowMs={6 * 3600_000}
          rosterId={rosterId}
        />
      </div>
    );
  }

  if (phase === "CLOSED") {
    return (
      <div className={styles.wrap}>
        <WaitingCard
          icon={<NewspaperIcon size={26} />}
          headline="Die nächste Pressekonferenz"
          verb="beginnt"
          target={countdownTarget}
          windowMs={7 * 86400_000}
          rosterId={rosterId}
        />
      </div>
    );
  }

  // OPEN
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
            eyebrow={eyebrow}
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
