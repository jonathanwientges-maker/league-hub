// Precomputes every pair of managers' all-time (every season) head-to-head
// record and writes it to public/data/all-time-h2h.json, so the Home
// screen's Rivalry Game cards can read one small static file instead of
// running each season's full rosters/users/matchups fetch pipeline live in
// the browser on every cold load — that live version is what stalled the
// Home screen on first visit (see RivalrySpotlight.tsx / useAllTimeHeadToHead.tsx).
//
// Run manually (`npx tsx scripts/generate-all-time-h2h.ts`) or on a schedule
// via .github/workflows/all-time-h2h-snapshot.yml, same shape as
// status-snapshot.yml's player-status precompute.
import { mkdirSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  getLeague,
  getRosters,
  getUsers,
  getMatchups,
  getNflState,
} from "../src/api/sleeper";
import { discoverSeasonChain, discoverCurrentSeason } from "../src/domain/seasonChain";
import { assembleTeams } from "../src/domain/team";
import { buildWeekResultsByRoster } from "../src/domain/weeklyResults";
import { resolveCurrentWeek, isWeekFinal } from "../src/domain/potentialPoints";
import { computeAllTimeHeadToHead, headToHeadPairKey } from "../src/domain/allTimeRecords";
import { LEAGUE_CONFIG } from "../src/config/league";
import type { Team } from "../src/domain/types";
import type { SleeperMatchup } from "../src/api/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "public", "data", "all-time-h2h.json");

async function loadSeasonTeams(leagueId: string): Promise<Team[]> {
  const [league, rosters, users, nflState] = await Promise.all([
    getLeague(leagueId),
    getRosters(leagueId),
    getUsers(leagueId),
    getNflState(),
  ]);

  const currentWeek = resolveCurrentWeek(league, nflState);
  const playoffWeekStart =
    league.settings.playoff_week_start ?? LEAGUE_CONFIG.regularSeasonWeeks + 1;

  const weeks = Array.from({ length: Math.max(playoffWeekStart - 1, 0) }, (_, i) => i + 1).filter(
    (week) => isWeekFinal(week, currentWeek)
  );

  const matchupsByWeek = new Map<number, SleeperMatchup[]>();
  await Promise.all(
    weeks.map(async (week) => {
      matchupsByWeek.set(week, await getMatchups(leagueId, week));
    })
  );

  const weekResultsByRoster = buildWeekResultsByRoster(matchupsByWeek);
  return assembleTeams(rosters, users, weekResultsByRoster);
}

async function main() {
  console.log("Discovering season chain…");
  const backward = await discoverSeasonChain(LEAGUE_CONFIG.anchor.leagueId);
  const { chain } = await discoverCurrentSeason(LEAGUE_CONFIG.anchor.ownerUserId, backward);
  console.log(`Chain: ${chain.map((s) => s.season).join(", ")}`);

  const seasonsTeams: { teams: Team[] }[] = [];
  for (const season of chain) {
    console.log(`Loading ${season.season} (${season.leagueId})…`);
    const teams = await loadSeasonTeams(season.leagueId);
    seasonsTeams.push({ teams });
  }

  const ownerIds = new Set<string>();
  for (const { teams } of seasonsTeams) {
    for (const team of teams) ownerIds.add(team.ownerId);
  }
  const owners = [...ownerIds];

  const records: Record<string, ReturnType<typeof computeAllTimeHeadToHead>> = {};
  for (let i = 0; i < owners.length; i++) {
    for (let j = i + 1; j < owners.length; j++) {
      const record = computeAllTimeHeadToHead(seasonsTeams, owners[i], owners[j]);
      if (record.meetings > 0) {
        records[headToHeadPairKey(owners[i], owners[j])] = record;
      }
    }
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), records }, null, 2)
  );
  console.log(`Wrote ${Object.keys(records).length} pairs to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
