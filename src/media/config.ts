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
    // Sleeper reports upcomingWeek as 0 (off-season) or 1 (pre-kickoff) before
    // any real game has been played — no category has anything real to say
    // yet, so assignQuestion overrides to the season_kickoff question through
    // this week, every season.
    seasonKickoffMaxWeek: 1,
  },
} as const;
