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

/** Which scheduled event (if any) is due at `now`, judged by Berlin wall-clock hour. */
export function dueEvent(now: Date = new Date()): PushEventId | null {
  const b = berlinNow(now);
  const { weekday, openHour } = MEDIA_CONFIG.mediaDay;
  if (b.weekday === weekday && b.hour === openHour) return "media_day_open";
  if (b.weekday === weekday && b.hour === PUSH_CONFIG.lastCallHour) return "media_day_last_call";
  if (b.weekday === weekday + 1 && b.hour === MEDIA_CONFIG.revealHour) return "reveal";
  return null;
}

export function eventKey(season: string, week: number, event: PushEventId): string {
  return `${season}-w${String(week).padStart(2, "0")}-${event}`;
}

export function buildPayload(event: PushEventId, key: string): PushPayload {
  return { ...PUSH_EVENTS[event], tag: key };
}
