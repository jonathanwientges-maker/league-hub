# `data/` — static, human-maintained Media Room config

These files are plain JSON, versioned in the repo, and imported directly into
the app at build time (no runtime fetch, no backend). Edit them, commit, and
redeploy to change behavior.

## Rivals

Rivalry pairs are no longer a static file — each manager self-picks up to 2
rivals in-app, on the Home Page, via `RivalPicker` (`src/components/home/`).
It's only visible/editable before the draft; once the draft countdown hits
zero, the component stops rendering and that season's picks are locked in.

Stored in Supabase's `rivals` table (`season`, `roster_id`, `rival_roster_ids`
— see `supabase/schema.sql`), read by `getRivalryGames()` in
`src/media/rivals.ts`. Pairs are bidirectional: if roster 1 picks roster 4,
that's a rivalry game even if roster 4 didn't pick roster 1 back — a pair
where BOTH sides picked each other is `mutual: true`.

## `nfl-bye-weeks.json`

`{ "<season>": { "<TEAM_ABBR>": <byeWeek>, ... } }`. Team abbreviations must
match Sleeper's player `team` field (e.g. `KC`, `SF`, `BUF`).

Ships as a placeholder (`{ "2026": {} }`) — fill in the real 2026 bye weeks
once the NFL schedule is released. Until then, `bye_player_started` simply
never triggers (no bye week ever matches `completedWeek`), which is a safe
default, not a crash.

## Weekly player-status snapshots

These are NOT in this folder. They're runtime-fetched at
`/data/player-status/{season}-w{week}.json`, which means they have to ship
inside the Vite build output, so they live in `public/data/player-status/`
instead — see the comment at the top of `.github/workflows/status-snapshot.yml`.
