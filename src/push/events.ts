import { berlinNow } from "../media/berlinTime";
import { MEDIA_CONFIG } from "../media/config";

export const PUSH_CONFIG = {
  lastCallHour: 18, // Wed 18:00 Berlin — nudge for managers who haven't submitted
  // Sleeper season_type values during which the weekly cycle is live. Keeps
  // the Wednesday cron quiet in the off-season.
  activeSeasonTypes: ["regular", "post"],
} as const;

export type PushEventId = "media_day_open" | "media_day_last_call" | "reveal";

export interface PushPayload {
  title: string;
  body: string;
  url: string; // in-app path to open on tap
  tag: string; // notification tag; same tag collapses duplicates on the device
}

export const PUSH_EVENTS: Record<PushEventId, Omit<PushPayload, "tag">> = {
  media_day_open: {
    title: "🎙️ Pressekonferenz eröffnet",
    body: "Die Presse wartet auf dein Statement – bis 24:00 Uhr.",
    url: "/media-room",
  },
  media_day_last_call: {
    title: "⏰ Letzter Aufruf",
    body: "Noch kein Statement abgegeben. Die Pressekonferenz schließt um 24:00 Uhr.",
    url: "/media-room",
  },
  reveal: {
    title: "🗞️ Der Pressespiegel ist da",
    body: "Alle Statements der Woche sind online. Voting bis Freitag 06:00 Uhr.",
    url: "/media-room",
  },
};

/**
 * Which scheduled event (if any) is due at `now`, judged by Berlin wall-clock
 * hour. Each event owns a whole window, not a single exact hour: GitHub
 * Actions' `schedule` trigger is best-effort and this repo has repeatedly
 * seen scheduled runs land several hours late (observed 5-7h delays on
 * other cron jobs here), so a run that fires late still needs to recognize
 * "yes, media_day_open is still the right event for today" rather than see
 * its exact hour has passed and silently report nothing due. Actual
 * duplicate-send protection is push_sends' unique constraint in
 * send-push.ts, not this function — widening these windows is safe because
 * a second, still-in-window run for the same event just no-ops there.
 *
 * Windows (Berlin time), in order checked:
 *   media_day_open:      mediaDay.weekday, openHour     .. lastCallHour (excl.)
 *   media_day_last_call: mediaDay.weekday, lastCallHour  .. closeHour    (excl.)
 *   reveal:               mediaDay.weekday + 1, revealHour onward, through
 *                          the rest of that day — generous on purpose so a
 *                          very late run still catches it.
 */
export function dueEvent(now: Date = new Date()): PushEventId | null {
  const b = berlinNow(now);
  const { weekday, openHour, closeHour } = MEDIA_CONFIG.mediaDay;
  const { lastCallHour } = PUSH_CONFIG;

  if (b.weekday === weekday && b.hour >= openHour && b.hour < lastCallHour) {
    return "media_day_open";
  }
  if (b.weekday === weekday && b.hour >= lastCallHour && b.hour < closeHour) {
    return "media_day_last_call";
  }
  if (b.weekday === weekday + 1 && b.hour >= MEDIA_CONFIG.revealHour) {
    return "reveal";
  }
  return null;
}

export function eventKey(season: string, week: number, event: PushEventId): string {
  return `${season}-w${String(week).padStart(2, "0")}-${event}`;
}

export function buildPayload(event: PushEventId, key: string): PushPayload {
  return { ...PUSH_EVENTS[event], tag: key };
}
