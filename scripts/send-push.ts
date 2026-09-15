import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { berlinNow } from "../src/media/berlinTime";
import { dueEvent, eventKey, buildPayload, PUSH_CONFIG, PUSH_EVENTS, type PushEventId } from "../src/push/events";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

async function main() {
  const SUPABASE_URL = requireEnv("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const VAPID_PUBLIC_KEY = requireEnv("VAPID_PUBLIC_KEY");
  const VAPID_PRIVATE_KEY = requireEnv("VAPID_PRIVATE_KEY");
  const VAPID_SUBJECT = requireEnv("VAPID_SUBJECT");

  const forcedRoster = process.env.PUSH_ROSTER || undefined;
  const force = process.env.PUSH_FORCE === "1";
  const dryRun = process.env.PUSH_DRY_RUN === "1";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const nfl = await fetch("https://api.sleeper.app/v1/state/nfl").then((r) => r.json());
  const season: string = nfl.season;
  const week: number = nfl.week;
  const seasonType: string = nfl.season_type;
  console.log(`Sleeper state: season=${season} week=${week} season_type=${seasonType}`);

  let event: PushEventId | null;
  const forcedEvent = process.env.PUSH_EVENT;
  if (forcedEvent) {
    if (!(forcedEvent in PUSH_EVENTS)) {
      throw new Error(`Invalid PUSH_EVENT "${forcedEvent}"; must be one of ${Object.keys(PUSH_EVENTS).join(", ")}`);
    }
    event = forcedEvent as PushEventId;
  } else {
    event = dueEvent(new Date());
  }

  if (!event) {
    const b = berlinNow();
    console.log(`No event due at Berlin ${b.year}-${b.month}-${b.day} ${b.hour}:${String(b.minute).padStart(2, "0")}`);
    process.exit(0);
  }

  if (!force && !(PUSH_CONFIG.activeSeasonTypes as readonly string[]).includes(seasonType)) {
    console.log(`season_type "${seasonType}" is not active; skipping`);
    process.exit(0);
  }

  const key = eventKey(season, week, event);

  if (!force) {
    const { error } = await supabase.from("push_sends").insert({ event_key: key });
    if (error) {
      if (error.code === "23505") {
        console.log(`Already sent for ${key}`);
        process.exit(0);
      }
      throw error;
    }
  }

  let query = supabase.from("push_subscriptions").select("endpoint, p256dh, auth, roster_id");
  if (forcedRoster) query = query.eq("roster_id", Number(forcedRoster));
  const { data: subscriptions, error: subsError } = await query;
  if (subsError) throw subsError;

  let candidates = subscriptions ?? [];

  if (event === "media_day_last_call") {
    const { data: responses, error: responsesError } = await supabase
      .from("responses")
      .select("roster_id")
      .eq("season", season)
      .eq("week", week)
      .eq("kind", "media_day");
    if (responsesError) throw responsesError;
    const submitted = new Set((responses ?? []).map((r) => r.roster_id));
    candidates = candidates.filter((s) => s.roster_id !== null && !submitted.has(s.roster_id));
  }

  console.log(`event=${event} key=${key} candidates=${candidates.length}`);

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const payload = JSON.stringify(buildPayload(event, key));

  let sent = 0;
  let deadRemoved = 0;
  let failed = 0;

  if (!dryRun) {
    const results = await Promise.allSettled(
      candidates.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 6 * 3600, urgency: "normal" }
        )
      )
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        sent++;
        continue;
      }
      const statusCode = (result.reason as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        deadRemoved++;
        const { error: deleteError } = await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", candidates[i].endpoint);
        if (deleteError) console.log(`Failed to remove dead subscription: ${deleteError.message}`);
      } else {
        failed++;
        console.log(`Send failed for ${candidates[i].endpoint}: ${result.reason}`);
      }
    }
  }

  if (!force || candidates.length > 0) {
    const { error: updateError } = await supabase.from("push_sends").update({ sent_count: sent }).eq("event_key", key);
    if (updateError) console.log(`Failed to update sent_count: ${updateError.message}`);
  }

  console.log(
    `Summary: event=${event} key=${key} candidates=${candidates.length} sent=${sent} dead-removed=${deadRemoved} failed=${failed}`
  );

  if (candidates.length > 0 && failed === candidates.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
