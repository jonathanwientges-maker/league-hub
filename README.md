# League Hub

A dashboard for our fantasy football league: standings, playoff bracket, pick-race draft order, per-team lineup efficiency, and a full multi-season history — all sourced live from the Sleeper API.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
npm test         # vitest
```

## Configuration (`src/config/league.ts`)

The app auto-discovers every season of the league from one anchor league ID — you should never need to hand-edit a league ID again after initial setup.

- **`anchor.leagueId` / `anchor.season`**: any one known-good league ID for this league, plus the season it corresponds to. Used as the starting point for season-chain discovery (`src/domain/seasonChain.ts`): it walks *backward* through Sleeper's `previous_league_id` chain to find every past season, and *forward* by checking the commissioner's leagues for each new NFL season to find the current one.
- **`anchor.ownerUserId`**: any manager's Sleeper `user_id` who's expected to stay in the league long-term (the commissioner is a safe choice). Used only to list that manager's leagues for forward season discovery — never displayed anywhere.
- **`rulesCutoffSeason`**: the first season this league's custom playoff/pick-race rules applied. Seasons before it are rendered **as-played** — i.e. exactly what Sleeper's own bracket and draft actually recorded, with no reseeding or pick-race logic applied. See below.
- **`heroMedia`**: the home page's pre-draft countdown hero background. Ships as `type: "gradient"` (a CSS gradient, no external asset) by default. To swap in real footage: drop `hero-default.mp4` and `hero-default.jpg` into `/public/media/`, then set `type: "video"` (or `"image"` for a static poster only, e.g. on mobile/reduced-motion). No other code changes needed.
- **`draftCountdownOverride`**: an ISO datetime string that, if set, overrides Sleeper's own draft `start_time` for the countdown — useful for testing the countdown UI, or if the commissioner hasn't scheduled a draft time in Sleeper yet.

## Custom rules vs. as-played

This league's playoff format (reseeded semifinals, byes, etc.) and pick-race draft-order mechanism are custom rules layered on top of Sleeper, implemented in `src/domain/playoffBracket.ts` and `src/domain/pickPlacement.ts`. Those rules only started with the `rulesCutoffSeason` season. Every season before that cutoff is **as-played**: the Playoffs and Pick Race (renamed "Season Result & Draft Order") pages instead read Sleeper's actual recorded `winners_bracket`/`losers_bracket` and the following season's real draft order (`src/domain/asPlayed.ts`), with zero reseeding or pick-race computation involved. `getSeasonMode()` in `src/context/SeasonContext.tsx` is the only place in the codebase that should ever compare a season's year against the cutoff — every page and component branches on its `"custom-rules" | "as-played"` result instead. Potential Points / lineup efficiency are still computed and shown for every season, historic included, since that's a retro stat rather than a rule.

## Custom playoff & pick-race rule flags (`src/config/league.ts`)

These control the custom-rules pipeline itself (`src/domain/playoffBracket.ts`, `src/domain/pickPlacement.ts`, `src/domain/standings.ts`) and only apply to seasons at or after `rulesCutoffSeason`:

- **`tiebreakers.seeding`** (default `["h2h", "pointsFor"]`): the order tiebreakers are applied when two or more teams are tied on win% — head-to-head record among just the tied teams first, then total points for. Used for division standings, division-winner ranking, second-place ranking, and semifinal reseeding.
- **`tiebreakers.potentialPoints`** (default `["actualPointsFor"]`): if two non-playoff teams are exactly tied on Potential Points, the one with the lower actual points for is ranked worse (i.e. goes into the lower-numbered pick group).
- **`consolationWeekOffset`** (default `2`, i.e. finals week): which playoff week the consolation game (5th place / wildcard-losers game) is read from. Set to `1` to read it from semifinal week instead.
- **`pickRaceSemiWeek`** / **`pickRaceFinalWeek`** (default `1` / `2`, i.e. wildcard week and semifinal week): which playoff week — 1-indexed relative to `playoff_week_start` — the pick-race semifinal and final are read from.

### The rules, in plain language

**Playoffs (6 of 12 teams).** The top 2 teams from each division qualify. Among the 3 division winners, the two with the best records get a bye straight to the semifinals; the third-best division winner plays the worst of the three second-place teams, and the other two second-place teams play each other, in the wildcard round. Semifinals are **reseeded**: once the wildcard round is decided, the four remaining teams (the two byes plus the two wildcard winners) are re-ranked by regular-season record, and the best remaining record plays the worst — regardless of which bracket slot each team came from. The two semifinal winners meet in the championship; the two semifinal losers play for 3rd place; the two wildcard-round losers play a consolation game.

**Pick race (the other 6 teams).** Ranked by season-total Potential Points — the total each team would have scored every week with the best possible lineup from its full roster, bench included. The 3 lowest-Potential-Points teams form a bracket for picks 1.01–1.03; the other 3 form a bracket for picks 1.04–1.06. Within each bracket, the team with the best actual head-to-head record gets a bye straight to that bracket's final; the other two play a semifinal. Unlike the playoffs, **winning is good for pick position here**: final winner gets the best pick of the three, final loser the second, semifinal loser the third.

**Picks 1.07–1.12, from playoff results:** Champion → 1.12. Championship runner-up → 1.11. 3rd-place game winner → 1.10, loser → 1.09. Consolation game **winner** → 1.07, **loser** → 1.08 — this inversion (winner gets the better pick) is intentional, matching the pick-race logic above, and is easy to get backwards when reading the code.

## Multi-season data & caching

Every season's Sleeper data is fetched by league ID (never a hardcoded singleton), and react-query keys everything by that ID, so switching seasons never mixes up caches. Once a season's Sleeper `status` is `"complete"`, its data is treated as immutable: `staleTime: Infinity` plus a `localStorage` cache (`src/hooks/usePersistedQuery.ts`), so a completed season costs one Sleeper API round-trip per browser, not per visit. The season chain itself (`src/hooks/useSeasonChain.ts`) is also seeded from a `localStorage` cache (`seasonChain:v1`) for an instant cold-load paint, but its `staleTime` is intentionally `0` — it's the one query whose whole job is noticing "did the commissioner just create next season's league," so it always revalidates in the background (on mount and on window refocus) rather than trusting a multi-hour-old snapshot.

## Pre-release gate

Until `RELEASE_DATE_UTC` (in `src/config/release.ts`), the site shows a cinematic countdown page (`src/gate/`) instead of the real app — for the commissioner to share the URL with the league before it's ready, without a manual "flip the switch" step. `src/main.tsx` checks `Date.now()` against `RELEASE_DATE_UTC` once at page load and renders `<GatePage/>` or `<App/>` accordingly.

- **`RELEASE_DATE_UTC`** / **`CAMPAIGN_START_UTC`**: set in `src/config/release.ts`. The former is the actual kickoff moment (shown to visitors in their own local timezone); the latter is cosmetic only — it's when the gate went live, and only affects the field-position meter's starting point.
- **No redeploy needed on launch day.** Since the gate/app choice is just a clock comparison against a constant, the same deployed build automatically starts serving the real app the moment `RELEASE_DATE_UTC` passes. A visitor with the countdown page open when it hits zero gets a "We Are Live" screen with an "Enter the league" button that reloads the page.
- To regenerate the OG share image / app icons after a design change: `node scripts/generate-gate-assets.mjs` (uses `satori` + `sharp`, outputs to `public/`).

## Manual QA checklist

Run through this after any change that touches layout, data-fetching, or the season/rules branching — `npm run build` and `npm test` catch type errors and logic regressions, not layout breaks or a blank screen from a bad league ID:

- [ ] **Mobile, 375px viewport.** Standings, Playoffs (bracket switches to stacked per-round horizontal scroll), Pick Race, and Team detail all readable with no horizontal page scroll.
- [ ] **Keyboard-only navigation.** Tab through the top nav, season switcher, standings table sort headers, and a Team detail week row's expand toggle — every interactive element gets a visible focus ring and is operable without a mouse.
- [ ] **Reduced-motion mode** (OS-level "reduce motion" setting). Page-load reveals, the bracket's power-line connector draw-in, and the pre-release gate's countdown/field-position animation should all become instant instead of animating.
- [ ] **Pre-season league ID** (a league that's drafted but hasn't played Week 1). Standings show every team 0-0-0 with no crash; Playoffs/Pick Race show the "not enough data yet" placeholder rather than a nonsensical projection.
- [ ] **Mid-season league ID.** Playoffs/Pick Race show the "if the season ended today" projection with the gold "Projection" chip; a live/in-progress week's matchup shows a "live" status, not "final" or "upcoming".
- [ ] **A season before `rulesCutoffSeason`.** Playoffs and Pick Race render in as-played mode (Sleeper's actual recorded bracket and the following season's real draft order), not the custom-rules computation.
