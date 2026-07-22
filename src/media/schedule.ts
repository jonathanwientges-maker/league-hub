import { berlinNow, berlinWallClockToUtc, nextThursday6Utc } from "./berlinTime";
import { MEDIA_CONFIG } from "./config";

export type MediaPhase = "CLOSED" | "MEDIA_DAY" | "PRINTING" | "REVEALED";

/** Wed 06:00–24:00 Berlin — the only window submissions/edits are accepted. */
export function isMediaDayOpen(now: Date = new Date()): boolean {
  const { weekday, openHour, closeHour } = MEDIA_CONFIG.mediaDay;
  const b = berlinNow(now);
  return b.weekday === weekday && b.hour >= openHour && b.hour < closeHour;
}

/**
 * - Wed 06:00–23:59            → 'MEDIA_DAY'
 * - Wed 00:00–05:59 & Thu 00:00–05:59 → 'PRINTING' (locked, reveal pending)
 * - otherwise                  → 'REVEALED' (a Pressespiegel is on display)
 */
export function phaseFor(now: Date = new Date()): MediaPhase {
  if (isMediaDayOpen(now)) return "MEDIA_DAY";

  const b = berlinNow(now);
  const { weekday, openHour } = MEDIA_CONFIG.mediaDay;
  const revealWeekday = weekday + 1; // Thursday

  const isWedPrePrint = b.weekday === weekday && b.hour < openHour;
  const isThuPrePrint = b.weekday === revealWeekday && b.hour < MEDIA_CONFIG.revealHour;
  if (isWedPrePrint || isThuPrePrint) return "PRINTING";

  return "REVEALED";
}

/** UTC instant a submission made "now" will be revealed — next Thursday 06:00 Berlin. */
export function computeRevealAt(now: Date = new Date()): Date {
  return nextThursday6Utc(now);
}

/** UTC instant the next media day opens — next Wed 06:00 Berlin strictly after `now`. */
export function nextMediaDayOpenUtc(now: Date = new Date()): Date {
  const b = berlinNow(now);
  const { weekday, openHour } = MEDIA_CONFIG.mediaDay;
  let daysAhead = (weekday - b.weekday + 7) % 7;
  if (daysAhead === 0 && b.hour >= openHour) daysAhead = 7;
  const base = berlinWallClockToUtc(b.year, b.month, b.day, openHour, 0);
  return new Date(base.getTime() + daysAhead * 86400000);
}

export function votingClosesAt(revealAt: Date): Date {
  return new Date(revealAt.getTime() + MEDIA_CONFIG.votingDurationHours * 60 * 60 * 1000);
}

export function isVotingOpen(now: Date, revealAt: Date): boolean {
  const closes = votingClosesAt(revealAt);
  return now >= revealAt && now < closes;
}
