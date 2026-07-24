export const MEDIA_CONFIG = {
  season: '2026',
  timezone: 'Europe/Berlin',
  mediaDay: { weekday: 3, openHour: 6, closeHour: 24 },  // Wed 06:00–24:00
  revealHour: 6,                                          // Thu 06:00
  votingDurationHours: 24,                                // Thu 06:00 → Fri 06:00
  answerMaxLength: 280,
  thresholds: {
    closeMargin: 5, blowoutMargin: 40,
    streakMin: 3,
    benchOutperformMin: 15,
    starterUnderperform: 5,
    positionGroup: { QB: 15, RB: 8, WR: 7, TE: 4 },
    taxiGood: 5, taxiGreat: 10, taxiAllBad: 3,
  },
  // Pre-season one-time events (src/media/specialEvents.ts) — distinct from
  // the recurring Wed/Thu/Fri weekly cycle above.
  specialEvents: {
    // Opens the moment the app itself unlocks (config/release.ts's
    // RELEASE_DATE_UTC) — no separate date to keep in sync here.
    seasonKickoff: {
      submitClose: { year: 2026, month: 8, day: 25, hour: 23, minute: 59 },
      reveal: { year: 2026, month: 8, day: 26, hour: 6 },
      votingClose: { year: 2026, month: 8, day: 27, hour: 6 },
    },
    // All relative to the league's real draft.start_time from Sleeper.
    preDraft: { openDaysBefore: 3, submitCloseDaysBefore: 2, revealDaysBefore: 1 }, // votingClose = draft start
    postDraft: { openHoursAfter: 3, revealHoursAfter: 24, votingCloseHoursAfter: 48 },
  },
} as const;
