export const LEAGUE_CONFIG = {
  // --- Season resolution (v2) ---
  // The anchor league is a known-good starting point for season-chain discovery
  // (src/domain/seasonChain.ts): the chain is walked backward via previous_league_id
  // and forward via the owner's /user/{id}/leagues/nfl/{season} listing, so this
  // value never needs to change once set.
  anchor: {
    leagueId: "1255212520214384640",
    season: "2025",
    // EdelmanEmpire, commissioner (is_owner: true on the 2025 league's /users
    // response). Any manager who stays in the league long-term works here — it's
    // used only to list their leagues for forward season discovery (Step B.2),
    // never displayed.
    ownerUserId: "1124429000337731584",
  },
  // Seasons >= this use the custom playoff/pick-race rules (Phase 4/5 of v1).
  // Seasons before it are rendered "as-played" from Sleeper's actual recorded
  // results (src/domain/asPlayed.ts). This is the only place a year comparison
  // should ever happen — see getSeasonMode() in src/context/SeasonContext.tsx.
  rulesCutoffSeason: 2026,
  // Home hero background (pre-draft countdown, src/components/layout/SeasonHero.tsx).
  // "gradient" ships today with no external asset; drop a real file into
  // /public/media and flip this to "video" (or "image") with no other code changes.
  heroMedia: {
    type: "gradient" as "gradient" | "video" | "image",
    src: "/media/hero-default.mp4",
    posterSrc: "/media/hero-default.jpg",
  },
  // ISO datetime; if set, wins over Sleeper's draft start_time for the countdown.
  draftCountdownOverride: null as string | null,
  // Shown in the top nav in place of Sleeper's full league name (which runs
  // long for a mobile header). Leave null to show the real name instead.
  displayName: "DoPE" as string | null,

  regularSeasonWeeks: 14,        // read from league settings at runtime, this is fallback
  divisions: 3,
  teamsPerDivision: 4,
  playoffTeams: 6,
  // --- Tiebreaker flags (defaults documented in Phase 3) ---
  tiebreakers: {
    seeding: ["h2h", "pointsFor"] as const,       // order of tiebreakers for identical records
    potentialPoints: ["actualPointsFor"] as const // tiebreaker if Potential Points are equal
  },
  // Which playoff week the consolation game (5th place / wildcard losers game) is read
  // from. Default 2 = finals week (documented in Phase 4, Step 4.4).
  consolationWeekOffset: 2 as 1 | 2,
  // Which playoff week (1-indexed, relative to playoff_week_start) the pick-race
  // semifinal/final are read from. Defaults per Phase 5, Step 5.2.
  pickRaceSemiWeek: 1,
  pickRaceFinalWeek: 2
};
