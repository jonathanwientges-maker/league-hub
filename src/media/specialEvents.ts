import { berlinWallClockToUtc } from "./berlinTime";
import { RELEASE_DATE_UTC } from "../config/release";
import { MEDIA_CONFIG } from "./config";
import { TEMPLATES, renderTemplate } from "./templates";
import { hashSeed, mulberry32 } from "./engine/rng";
import type { AssignedQuestion } from "./engine/assignQuestion";

export type SpecialEventId = "season_kickoff" | "pre_draft_statement" | "post_draft_statement";

export interface SpecialEventWindow {
  openAt: Date;
  submitCloseAt: Date;
  revealAt: Date;
  votingCloseAt: Date;
}

/** Reserved negative sentinels — can never collide with a real season week (0+). */
export const SPECIAL_EVENT_WEEKS: Record<SpecialEventId, number> = {
  season_kickoff: -3,
  pre_draft_statement: -2,
  post_draft_statement: -1,
};

const WEEK_TO_EVENT_ID = new Map(
  Object.entries(SPECIAL_EVENT_WEEKS).map(([id, week]) => [week, id as SpecialEventId])
);

export function specialEventForWeek(week: number): SpecialEventId | null {
  return WEEK_TO_EVENT_ID.get(week) ?? null;
}

/** "Zitat der Woche" for the season-opener, "Zitat des Tages" for the two draft-day events. */
export function badgeLabelForWeek(week: number): string {
  const id = specialEventForWeek(week);
  if (id === "pre_draft_statement" || id === "post_draft_statement") return "Zitat des Tages";
  return "Zitat der Woche";
}

/** Human label for headers like "Pressespiegel · {label}" — null for a normal numbered week. */
export function displayLabelForWeek(week: number): string | null {
  switch (specialEventForWeek(week)) {
    case "season_kickoff":
      return "Season Kickoff";
    case "pre_draft_statement":
      return "Vor dem Rookie Draft";
    case "post_draft_statement":
      return "Nach dem Rookie Draft";
    default:
      return null;
  }
}

export function seasonKickoffWindow(): SpecialEventWindow {
  const { submitClose, reveal, votingClose } = MEDIA_CONFIG.specialEvents.seasonKickoff;
  return {
    openAt: new Date(Date.parse(RELEASE_DATE_UTC)),
    submitCloseAt: berlinWallClockToUtc(
      submitClose.year,
      submitClose.month,
      submitClose.day,
      submitClose.hour,
      submitClose.minute
    ),
    revealAt: berlinWallClockToUtc(reveal.year, reveal.month, reveal.day, reveal.hour),
    votingCloseAt: berlinWallClockToUtc(
      votingClose.year,
      votingClose.month,
      votingClose.day,
      votingClose.hour
    ),
  };
}

export function preDraftWindow(draftStartMs: number): SpecialEventWindow {
  const { openDaysBefore, submitCloseDaysBefore, revealDaysBefore } = MEDIA_CONFIG.specialEvents.preDraft;
  const DAY_MS = 24 * 60 * 60 * 1000;
  return {
    openAt: new Date(draftStartMs - openDaysBefore * DAY_MS),
    submitCloseAt: new Date(draftStartMs - submitCloseDaysBefore * DAY_MS),
    revealAt: new Date(draftStartMs - revealDaysBefore * DAY_MS),
    votingCloseAt: new Date(draftStartMs),
  };
}

export function postDraftWindow(draftStartMs: number): SpecialEventWindow {
  const { openHoursAfter, revealHoursAfter, votingCloseHoursAfter } = MEDIA_CONFIG.specialEvents.postDraft;
  const HOUR_MS = 60 * 60 * 1000;
  const revealAt = new Date(draftStartMs + revealHoursAfter * HOUR_MS);
  return {
    openAt: new Date(draftStartMs + openHoursAfter * HOUR_MS),
    submitCloseAt: revealAt,
    revealAt,
    votingCloseAt: new Date(draftStartMs + votingCloseHoursAfter * HOUR_MS),
  };
}

function windowFor(id: SpecialEventId, draftStartMs: number | null): SpecialEventWindow | null {
  if (id === "season_kickoff") return seasonKickoffWindow();
  if (draftStartMs === null) return null;
  return id === "pre_draft_statement" ? preDraftWindow(draftStartMs) : postDraftWindow(draftStartMs);
}

/** Priority order when (hypothetically) two windows would ever overlap. */
const PRIORITY: SpecialEventId[] = ["pre_draft_statement", "post_draft_statement", "season_kickoff"];

export interface ActiveSpecialEvent {
  id: SpecialEventId;
  week: number;
  window: SpecialEventWindow;
}

/** Whichever special event's window contains `now`, if any. */
export function getActiveSpecialEvent(now: Date, draftStartMs: number | null): ActiveSpecialEvent | null {
  for (const id of PRIORITY) {
    const window = windowFor(id, draftStartMs);
    if (window && now >= window.openAt && now < window.votingCloseAt) {
      return { id, week: SPECIAL_EVENT_WEEKS[id], window };
    }
  }
  return null;
}

export type SpecialEventPhase = "OPEN" | "PRINTING" | "REVEALED";

/** Sub-phase within an active special event's window — mirrors schedule.ts's MediaPhase idea. */
export function specialEventPhase(now: Date, window: SpecialEventWindow): SpecialEventPhase {
  if (now < window.submitCloseAt) return "OPEN";
  if (now < window.revealAt) return "PRINTING";
  return "REVEALED";
}

/** Earliest not-yet-open special event's openAt, for a "next PK starts in…" countdown. */
export function nextSpecialEventOpenAt(now: Date, draftStartMs: number | null): Date | null {
  const upcoming = PRIORITY.map((id) => windowFor(id, draftStartMs))
    .filter((w): w is SpecialEventWindow => w !== null && w.openAt > now)
    .map((w) => w.openAt)
    .sort((a, b) => a.getTime() - b.getTime());
  return upcoming[0] ?? null;
}

/**
 * Same deterministic scheme as the engine's category questions, but for a
 * special event's single-template pool.
 */
export function assignSpecialEventQuestion(
  id: SpecialEventId,
  season: string,
  rosterId: number,
  payload: Record<string, string | number>
): AssignedQuestion {
  const templates = TEMPLATES[id] ?? [];
  const rng = mulberry32(hashSeed(`${season}-${SPECIAL_EVENT_WEEKS[id]}-${rosterId}-${id}`));
  const templateIndex = templates.length > 0 ? Math.floor(rng() * templates.length) : 0;
  const template = templates[templateIndex] ?? "";

  return {
    categoryId: id,
    templateIndex,
    question: renderTemplate(template, payload),
  };
}
