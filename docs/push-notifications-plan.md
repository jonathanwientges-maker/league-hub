# Push notifications for Media Days — implementation plan

Audience: a coding agent implementing this feature in this repo, without prior
context. Follow the steps in order. Each step ends with a **Verify** block —
do not move on until it passes. Where code is given verbatim, use it as-is
unless the repo has drifted (then adapt minimally and say so in the commit).

## 0. Goal and scope

Managers should get a push notification on their phone for the weekly Media
Day cycle (`src/media/config.ts` → `MEDIA_CONFIG`):

| Event id              | When (Berlin time)                  | Who gets it                                  |
|-----------------------|-------------------------------------|----------------------------------------------|
| `media_day_open`      | Wednesday 06:00 (`mediaDay.openHour`)| every subscribed device                      |
| `media_day_last_call` | Wednesday 18:00 (new `lastCallHour`) | subscribed devices whose roster has NOT submitted a `media_day` response for this week |
| `reveal`              | Thursday 06:00 (`revealHour`)        | every subscribed device                      |

V1 is **scheduled** notifications only. Out of scope (see §12): event-driven
pushes ("your rival answered"), the pre-season special events, voting-close
reminders.

## 1. Architecture (read this before coding)

```
Manager's phone (PWA)                       Supabase (Postgres)               GitHub Actions (cron)
─────────────────────                       ───────────────────               ─────────────────────
public/sw.js  ── push event ──► shows        push_subscriptions  ◄── select ── scripts/send-push.ts
notification                                 (endpoint, keys,                  (runs web-push with VAPID
                                              roster_id)                       private key, service role key)
src/push/*    ── subscribe ──► RPC           push_sends
"🔔 aktivieren" button         upsert_push_  (dedupe log, one row per
in MediaRoom footer            subscription  event per week)
```

Facts about this repo that the design relies on:

- It is a Vite + React SPA deployed on **Vercel** (see the error text in
  `src/media/supabaseClient.ts`). Env vars starting with `VITE_` are inlined
  into the client bundle at build time; anything else is server-side only.
- It is already an installable PWA: `public/manifest.json` + the
  `apple-mobile-web-app-*` meta tags in `index.html`. There is **no service
  worker yet**.
- Managers are identified per device by a roster id in
  `localStorage["mediaroom.rosterId"]` (`src/media/identity.ts`,
  `src/media/useIdentity.ts`). There is no login. A push subscription is
  therefore tied to a device and carries the roster id that device has
  selected.
- Supabase is used through the anon key from the browser
  (`src/media/supabaseClient.ts`); existing tables have wide-open RLS
  policies (`supabase/schema.sql`). **Do not do that for push
  subscriptions** — an endpoint + keys lets anyone send pushes to that
  device, so anon must not be able to `select` them. We use
  `security definer` RPC functions for the client, and the service-role key
  (GitHub secret only) for the sender.
- There is already a scheduled GitHub Actions workflow
  (`.github/workflows/status-snapshot.yml`) — the sender uses the same
  mechanism. GitHub cron fires in UTC and can be several minutes late.
  Berlin flips between UTC+2 (CEST) and UTC+1 (CET) in late October, so the
  workflow fires at **both** candidate UTC hours and the script itself
  checks the Berlin wall-clock hour and a dedupe table.
- Berlin-time helpers live in `src/media/berlinTime.ts` (`berlinNow()`
  returns `weekday` 1=Mon…7=Sun — Wednesday is `3`, matching
  `MEDIA_CONFIG.mediaDay.weekday`). The week number used for Media Day
  responses is Sleeper's `GET https://api.sleeper.app/v1/state/nfl` → `week`
  (see `useMediaDayStatus` in `src/media/roomData.ts`). The sender must use
  the exact same source so "has this roster submitted this week" matches
  what the app thinks.
- Tests are vitest (`npm test`); typecheck+build is `npm run build`
  (`tsc -b && vite build`). `tsconfig.app.json` has `noUnusedLocals` and
  `verbatimModuleSyntax` — use `import type` for types.

## 2. One-time setup (human + agent)

1. Install dev dependencies:
   ```bash
   npm install --save-dev web-push tsx
   ```
   `web-push` sends the pushes; `tsx` lets the Node script import the
   repo's TypeScript modules (`src/media/berlinTime.ts`, `src/media/config.ts`,
   `src/push/events.ts`) without a build step. Both are devDependencies —
   nothing from them goes into the client bundle.
2. Generate VAPID keys **once** and never regenerate them (regenerating
   invalidates every existing subscription):
   ```bash
   npx web-push generate-vapid-keys
   ```
3. Put the keys where they belong:
   - `.env.local` (git-ignored via `*.local`): add
     ```
     VITE_VAPID_PUBLIC_KEY=<public key>
     SUPABASE_URL=<same value as VITE_SUPABASE_URL>
     SUPABASE_SERVICE_ROLE_KEY=<Supabase dashboard → Settings → API → service_role>
     VAPID_PUBLIC_KEY=<public key>
     VAPID_PRIVATE_KEY=<private key>
     VAPID_SUBJECT=mailto:<commissioner email>
     ```
     Only `VITE_VAPID_PUBLIC_KEY` reaches the browser. The other five are for
     running the sender locally.
   - Vercel → Project → Settings → Environment Variables: add
     `VITE_VAPID_PUBLIC_KEY` (Production + Preview). A redeploy is needed
     afterwards because Vite inlines it at build time.
   - GitHub → repo → Settings → Secrets and variables → Actions: add
     `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`,
     `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
   The agent cannot do the Vercel/GitHub/Supabase-dashboard parts — list them
   as TODOs for the human at the end of the implementation.

## 3. Step 1 — Supabase schema

Append to `supabase/schema.sql` (and run it in the Supabase SQL editor —
human task; the file is the source of truth):

```sql
-- Web Push subscriptions (one row per device). Deliberately NO open RLS
-- policy: an endpoint + keys is enough to push to that device, so the anon
-- key must not be able to read them. The browser only ever goes through the
-- two security-definer RPCs below; the sender uses the service role key.
create table if not exists push_subscriptions (
  endpoint    text primary key,
  p256dh      text not null,
  auth        text not null,
  roster_id   int,                                   -- null until the device picked a team
  season      text,
  user_agent  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Dedupe log for the sender: one row per (season, week, event). The sender
-- inserts first and only sends if the insert succeeded, so a cron that fires
-- twice (DST double-slot, manual re-run) can never double-notify.
create table if not exists push_sends (
  event_key   text primary key,                      -- e.g. '2026-w03-media_day_open'
  sent_count  int  not null default 0,
  created_at  timestamptz not null default now()
);

alter table push_subscriptions enable row level security;
alter table push_sends         enable row level security;
-- (no policies on purpose)

create or replace function upsert_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text,
  p_roster_id int, p_season text, p_user_agent text
) returns void
language sql security definer set search_path = public as $$
  insert into push_subscriptions (endpoint, p256dh, auth, roster_id, season, user_agent)
  values (p_endpoint, p_p256dh, p_auth, p_roster_id, p_season, p_user_agent)
  on conflict (endpoint) do update set
    p256dh = excluded.p256dh, auth = excluded.auth, roster_id = excluded.roster_id,
    season = excluded.season, user_agent = excluded.user_agent, updated_at = now();
$$;

create or replace function delete_push_subscription(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint;
$$;

grant execute on function upsert_push_subscription(text, text, text, int, text, text) to anon, authenticated;
grant execute on function delete_push_subscription(text) to anon, authenticated;
```

**Verify:** after the human runs it, in the Supabase SQL editor
`select * from push_subscriptions;` works as postgres, and from the browser
console `supabase.from("push_subscriptions").select("*")` with the anon key
returns an empty array or a permission error (never rows).

## 4. Step 2 — Shared event definitions (`src/push/events.ts`)

Create `src/push/events.ts`. It is imported by both the sender script (Node
via tsx) and vitest, so it must not touch `window`, `document`, or
`import.meta.env`.

```ts
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
```

Create `src/push/events.test.ts` with vitest cases (use `Date.UTC` instants
and remember Berlin is UTC+2 in September, UTC+1 in December):

- Wed 2026-09-16 06:30 Berlin (`Date.UTC(2026, 8, 16, 4, 30)`) → `"media_day_open"`.
- Wed 2026-09-16 18:05 Berlin → `"media_day_last_call"`.
- Thu 2026-09-17 06:10 Berlin → `"reveal"`.
- Wed 2026-09-16 07:00 Berlin → `null` (the second DST cron slot must be a no-op).
- Wed 2026-12-02 06:15 Berlin (`Date.UTC(2026, 11, 2, 5, 15)`) → `"media_day_open"` (CET).
- Tue 2026-09-15 06:00 Berlin → `null`.
- `eventKey("2026", 3, "reveal")` → `"2026-w03-reveal"`.

**Verify:** `npm test` passes.

## 5. Step 3 — Service worker (`public/sw.js`) + registration

Create `public/sw.js` **exactly** like this. It is push-only on purpose:
no fetch handler, no caching — a caching service worker would serve stale
JS bundles after Vercel deploys, which is a much worse bug than no
notifications.

```js
// Push-only service worker. Intentionally no fetch/caching logic.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "League Hub";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
  };
  // iOS revokes push permission for sites that receive pushes without
  // showing a notification, so this must always call showNotification.
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          if ("navigate" in client) client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
```

Register it in `src/main.tsx`, after the `createRoot(...).render(...)` call:

```ts
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Service worker registration failed", err);
    });
  });
}
```

Files in `public/` are served at the site root by Vite (dev and build), so
`/sw.js` gets scope `/`. Vercel serves `public/` files with
`max-age=0, must-revalidate`, so browsers pick up a changed `sw.js` on the
next visit; no `vercel.json` needed.

**Verify:** `npm run dev`, open http://localhost:5173 in Chrome, DevTools →
Application → Service Workers shows `sw.js` activated. Navigation between
pages still works and `npm run build` still passes.

## 6. Step 4 — Client push module (`src/push/`)

### `src/push/pushClient.ts` — browser APIs only, no React

```ts
export type PushSupport = "supported" | "needs-install" | "unsupported";

const VAPID_PUBLIC_KEY: string | undefined = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * iOS only delivers Web Push to sites installed on the Home Screen (16.4+),
 * so a plain Safari tab reports "needs-install" rather than "unsupported".
 */
export function getPushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  if (!VAPID_PUBLIC_KEY) return "unsupported";
  if (isIos() && !isStandalone()) return "needs-install";
  const hasApis = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return hasApis ? "supported" : "unsupported";
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("service worker not ready")), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

// navigator.serviceWorker.ready never settles if registration failed, hence the timeout.
async function registration(): Promise<ServiceWorkerRegistration> {
  return withTimeout(navigator.serviceWorker.ready, 5000);
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  const reg = await registration();
  return reg.pushManager.getSubscription();
}

/** Must be called from a user gesture (click) — iOS requires it for the permission prompt. */
export async function subscribe(): Promise<PushSubscription> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("permission:" + permission);
  const reg = await registration();
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY as string),
  });
}

export async function unsubscribe(): Promise<string | null> {
  const sub = await getCurrentSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}

export interface SubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export function toRecord(sub: PushSubscription): SubscriptionRecord {
  const json = sub.toJSON();
  const keys = json.keys ?? {};
  if (!json.endpoint || !keys.p256dh || !keys.auth) throw new Error("subscription is missing keys");
  return { endpoint: json.endpoint, p256dh: keys.p256dh, auth: keys.auth };
}
```

Add the env var to the Vite type declarations if the repo has a
`src/vite-env.d.ts` with an `ImportMetaEnv` interface (add
`readonly VITE_VAPID_PUBLIC_KEY?: string`); if there is none, the `string |
undefined` annotation above is enough.

### `src/push/api.ts` — Supabase RPC calls

```ts
import { supabase } from "../media/supabaseClient";
import type { SubscriptionRecord } from "./pushClient";

export async function saveSubscription(record: SubscriptionRecord, rosterId: number | null, season: string): Promise<void> {
  const { error } = await supabase.rpc("upsert_push_subscription", {
    p_endpoint: record.endpoint,
    p_p256dh: record.p256dh,
    p_auth: record.auth,
    p_roster_id: rosterId,
    p_season: season,
    p_user_agent: navigator.userAgent.slice(0, 300),
  });
  if (error) throw error;
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const { error } = await supabase.rpc("delete_push_subscription", { p_endpoint: endpoint });
  if (error) throw error;
}
```

### `src/push/usePushNotifications.ts` — the hook

```ts
import { useCallback, useEffect, useState } from "react";
import { MEDIA_CONFIG } from "../media/config";
import { getCurrentSubscription, getPushSupport, subscribe, toRecord, unsubscribe } from "./pushClient";
import { removeSubscription, saveSubscription } from "./api";

export type PushStatus = "loading" | "unsupported" | "needs-install" | "denied" | "off" | "on";

export function usePushNotifications(rosterId: number | null) {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const support = getPushSupport();
    if (support !== "supported") {
      setStatus(support);
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    getCurrentSubscription()
      .then((sub) => { if (!cancelled) setStatus(sub ? "on" : "off"); })
      .catch(() => { if (!cancelled) setStatus("unsupported"); });
    return () => { cancelled = true; };
  }, []);

  // Keep the stored roster in sync when the manager switches team on this device.
  useEffect(() => {
    if (status !== "on") return;
    getCurrentSubscription()
      .then((sub) => (sub ? saveSubscription(toRecord(sub), rosterId, MEDIA_CONFIG.season) : undefined))
      .catch(() => { /* best effort; next enable() re-saves */ });
  }, [rosterId, status]);

  const enable = useCallback(async () => {
    setError(null);
    try {
      const sub = await subscribe();
      await saveSubscription(toRecord(sub), rosterId, MEDIA_CONFIG.season);
      setStatus("on");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.startsWith("permission:")) setStatus("denied");
      else setError("Aktivierung fehlgeschlagen. Bitte später erneut versuchen.");
    }
  }, [rosterId]);

  const disable = useCallback(async () => {
    setError(null);
    try {
      const endpoint = await unsubscribe();
      if (endpoint) await removeSubscription(endpoint);
      setStatus("off");
    } catch {
      setError("Deaktivierung fehlgeschlagen.");
    }
  }, []);

  return { status, error, enable, disable };
}
```

**Verify:** `npm run build` passes (typecheck). Hook is exercised in Step 5.

## 7. Step 5 — UI: `NotificationToggle` in the Media Room footer

Create `src/pages/MediaRoom/NotificationToggle.tsx` +
`NotificationToggle.module.css`. Copy is German, matching the rest of the
Media Room. Use the existing CSS variables (`--text-dim`, `--space-*`) seen
in `MediaRoom.module.css`; keep it visually modest — a small block with one
line of text and one link-style button, like the existing "Team wechseln".

Render rules by `status`:

| status          | Render                                                                                                   |
|-----------------|----------------------------------------------------------------------------------------------------------|
| `loading`       | nothing                                                                                                  |
| `unsupported`   | nothing (don't nag on browsers that can't do it)                                                        |
| `needs-install` | text: "Push-Benachrichtigungen gibt es nur in der installierten App: In Safari „Teilen“ → „Zum Home-Bildschirm“ und die App von dort öffnen." |
| `denied`        | text: "Benachrichtigungen sind blockiert. Bitte in den Browser- bzw. System-Einstellungen erlauben."   |
| `off`           | button "🔔 Benachrichtigungen aktivieren" + subline "Pressekonferenz, letzter Aufruf, Pressespiegel"    |
| `on`            | text "🔔 Benachrichtigungen aktiv" + link-button "Deaktivieren"                                         |

Plus `error` text underneath when set. The enable button's `onClick` must
call `enable()` **directly** (no `await` on something else first) so the
permission prompt stays inside the user gesture.

Wire it into `src/pages/MediaRoom/MediaRoom.tsx`: inside the existing
`{rosterId !== null && (<div className={styles.footer}>…)}` block, render
`<NotificationToggle rosterId={rosterId} />` above the "Team wechseln"
button. Only when `rosterId !== null` — a subscription without a roster
can't get the last-call reminder, and the footer is already gated that way.

Add a short entry to `README.md` (new section "Push notifications", 5–10
lines: what it does, that VAPID keys must never be regenerated, where the
secrets live, how to send a test — see Step 8).

**Verify (Chrome desktop, `npm run dev`, with `VITE_VAPID_PUBLIC_KEY` in
`.env.local`):** open /media-room, pick a team, click "Benachrichtigungen
aktivieren", accept the prompt → status flips to "aktiv"; in Supabase (SQL
editor) `select endpoint, roster_id, season from push_subscriptions;` shows
one row with the chosen roster. Click "Team wechseln", pick a different
team → the row's `roster_id` updates. Click "Deaktivieren" → row is gone.
Reload the page → status is remembered correctly (comes from
`pushManager.getSubscription()`, not local state).

## 8. Step 6 — Sender script (`scripts/send-push.ts`)

Runs under `tsx` (Node 24). Reads config from env; all decisions (which
event, dedupe, recipient filtering) happen here so the workflow stays dumb.

Env / inputs:

| Variable                    | Meaning                                                              |
|-----------------------------|----------------------------------------------------------------------|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | required                                             |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | required                                |
| `PUSH_EVENT`                | optional: force an event id instead of `dueEvent(now)`               |
| `PUSH_ROSTER`               | optional: only send to subscriptions with this `roster_id` (testing) |
| `PUSH_FORCE`                | optional `"1"`: skip the `push_sends` dedupe and the season-type gate |
| `PUSH_DRY_RUN`              | optional `"1"`: do everything except actually sending                |

Algorithm (implement exactly; log every decision with `console.log`):

1. Read env; `throw` with a clear message if any required var is missing.
2. `const nfl = await fetch("https://api.sleeper.app/v1/state/nfl").then(r => r.json())`
   → `season = nfl.season`, `week = nfl.week`, `seasonType = nfl.season_type`.
   Log them. (Same source the app uses for the Media Day week.)
3. `event = process.env.PUSH_EVENT ?? dueEvent(new Date())`. If null → log
   "no event due at <Berlin time>" and `process.exit(0)`. Validate a forced
   value is a key of `PUSH_EVENTS`.
4. Unless `PUSH_FORCE=1`: if `!PUSH_CONFIG.activeSeasonTypes.includes(seasonType)`
   → log and exit 0.
5. `key = eventKey(season, week, event)`. Unless `PUSH_FORCE=1`:
   `supabase.from("push_sends").insert({ event_key: key })`; if the error
   code is `"23505"` (unique violation) → log "already sent" and exit 0; any
   other error → throw. (Insert-first is the atomic claim.)
6. Load `push_subscriptions` (`endpoint, p256dh, auth, roster_id`). If
   `PUSH_ROSTER` is set, keep only rows with that `roster_id`.
7. If `event === "media_day_last_call"`: load
   `responses` where `season = season and week = week and kind = 'media_day'`
   → set of submitted `roster_id`s; keep only subscriptions whose
   `roster_id` is not null and not in the set.
8. `payload = JSON.stringify(buildPayload(event, key))`.
9. `webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)`.
   For each subscription (use `Promise.allSettled`, concurrency is fine at
   league size), unless dry-run:
   `webpush.sendNotification({ endpoint, keys: { p256dh, auth } }, payload, { TTL: 6 * 3600, urgency: "normal" })`.
   On rejection with `statusCode` 404 or 410 → the subscription is dead:
   `supabase.from("push_subscriptions").delete().eq("endpoint", endpoint)`.
   Other errors: log and count as failed.
10. Update `push_sends.sent_count` with the success count (skip if forced
    and no row exists). Print a summary: `event, key, candidates, sent,
    dead-removed, failed`. Exit 0 unless every attempt failed with a
    non-404/410 error (then exit 1 so the workflow run shows red).

Supabase client in Node:
`createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })`.
Imports: `import webpush from "web-push"`, `import { createClient } from "@supabase/supabase-js"`,
`import { berlinNow } from "../src/media/berlinTime"`, and from
`../src/push/events`. Check that neither `src/media/berlinTime.ts` nor
`src/media/config.ts` imports anything browser-only (as of writing they
don't — `config.ts` has no imports, `berlinTime.ts` uses only `Intl`).

Add an npm script to `package.json`:
`"push:send": "node --env-file=.env.local --import tsx scripts/send-push.ts"`.

**Verify (local):**
- `PUSH_DRY_RUN=1 PUSH_EVENT=media_day_open npm run push:send` → logs the
  candidate count, sends nothing, exits 0.
- `PUSH_FORCE=1 PUSH_EVENT=media_day_open PUSH_ROSTER=<your roster> npm run push:send`
  → the Chrome tab subscribed in Step 5 shows the notification; clicking it
  opens /media-room. Note `PUSH_FORCE=1` means no `push_sends` row is written,
  so this is safe to repeat.
- Run `npm run push:send` with no overrides on a Tuesday → "no event due", exit 0.
- Run `npx tsc --noEmit -p tsconfig.app.json` still passes (the script lives
  outside `src`, so it is not type-checked by the app config — that is
  fine; `tsx` will surface syntax errors at run time).

## 9. Step 7 — GitHub Actions workflow

Create `.github/workflows/push-notifications.yml`:

```yaml
# Sends the Media Day push notifications. Cron is UTC and Berlin switches
# between UTC+2 (summer) and UTC+1 (winter), so each event fires at both
# candidate hours; scripts/send-push.ts checks the Berlin wall-clock hour and
# the push_sends dedupe table, so the wrong slot is a no-op.
name: push-notifications
on:
  schedule:
    - cron: '0 4,5 * * WED'    # media_day_open      — Wed 06:00 Berlin
    - cron: '0 16,17 * * WED'  # media_day_last_call — Wed 18:00 Berlin
    - cron: '0 4,5 * * THU'    # reveal              — Thu 06:00 Berlin
  workflow_dispatch:
    inputs:
      event:
        description: 'Force an event: media_day_open | media_day_last_call | reveal'
        required: false
      roster:
        description: 'Only send to this roster_id (testing)'
        required: false
      force:
        description: 'Skip dedupe + season gate (use with roster for tests)'
        type: boolean
        default: false
      dry_run:
        description: 'Log only, send nothing'
        type: boolean
        default: false
jobs:
  send:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npx tsx scripts/send-push.ts
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          VAPID_PUBLIC_KEY: ${{ secrets.VAPID_PUBLIC_KEY }}
          VAPID_PRIVATE_KEY: ${{ secrets.VAPID_PRIVATE_KEY }}
          VAPID_SUBJECT: ${{ secrets.VAPID_SUBJECT }}
          PUSH_EVENT: ${{ inputs.event }}
          PUSH_ROSTER: ${{ inputs.roster }}
          PUSH_FORCE: ${{ inputs.force == true && '1' || '' }}
          PUSH_DRY_RUN: ${{ inputs.dry_run == true && '1' || '' }}
```

Notes: `npm ci` installs devDependencies (web-push, tsx) — do not set
`NODE_ENV=production`. GitHub may start scheduled runs 5–20 minutes late;
the hour check in `dueEvent` tolerates up to 59 minutes.

**Verify:** after secrets are set (human), trigger the workflow manually
from the Actions tab with `event=media_day_open`, `roster=<yours>`,
`force=true` → your phone/desktop gets the notification and the run is
green. Then trigger with `dry_run=true` and no event on a weekday where
nothing is due → run is green with "no event due".

## 10. Step 8 — Rollout checklist (human)

1. Run the SQL from Step 1 in Supabase.
2. Add the Vercel env var and redeploy; confirm `VITE_VAPID_PUBLIC_KEY` is
   present by checking that the toggle renders (it hides itself when the key
   is missing → status `unsupported`).
3. Add the five GitHub secrets.
4. Do the manual workflow test from Step 7 on (a) an iPhone with the app on
   the Home Screen, (b) an Android phone in Chrome.
5. Tell the managers: open the app → Media Room → pick your team →
   "Benachrichtigungen aktivieren". iPhone users must first add the site to
   the Home Screen and open it from there (the toggle tells them so).

## 11. Manual QA checklist

- [ ] iPhone, Safari tab (not installed): toggle shows the "Zum
      Home-Bildschirm" hint, no button.
- [ ] iPhone, installed on Home Screen: enable → system prompt → "aktiv";
      forced test push arrives with icon; tapping opens the app at /media-room.
- [ ] Android Chrome: same as above without the install step.
- [ ] Deny the permission → status "blockiert" text, no crash; clearing the
      site permission in browser settings and reloading brings the button back.
- [ ] Two devices for the same roster both receive the push (two rows).
- [ ] `media_day_last_call` with `force` + your roster: arrives only if you
      have NOT submitted this week's Media Day statement; after submitting,
      re-running sends nothing to you.
- [ ] Manually insert a bogus row (`endpoint = 'https://example.invalid/x'`,
      any keys) and force-send → the run logs it as dead and the row is deleted.
- [ ] Run the same forced event twice **without** `force` (set `PUSH_EVENT`
      only) → the second run exits with "already sent".
- [ ] Existing pages, the pre-release gate path in `main.tsx`, and
      `npm test` / `npm run build` are unaffected.

## 12. Pitfalls — read before writing code

- **Never regenerate VAPID keys.** Every subscription dies.
- **Never add fetch/caching to `sw.js`.** Stale bundles after a deploy are
  far worse than the problem we're solving.
- **The service-role key must never appear in `src/` or any `VITE_` var.**
- **Never grant anon `select` on `push_subscriptions`.** Only the two RPCs.
- **Call `enable()` straight from the click handler.** iOS drops the
  permission prompt if it isn't inside a user gesture.
- **Always show a notification in the `push` handler.** iOS revokes
  permission after silent pushes.
- **Keep the sender's notion of week/season identical to the app's**
  (`/state/nfl`), otherwise the last-call filter and the dedupe key drift.
- The pre-release `GatePage` in `main.tsx` is already in the past
  (`RELEASE_DATE_UTC` = 2026-08-24); registering the SW unconditionally is
  fine.
- `tsconfig.app.json` has `noUnusedLocals`/`noUnusedParameters` — remove
  anything you don't use, don't `_`-prefix it.

## 13. Later (not in this plan)

- Event-driven pushes (e.g. "dein Rivale hat geantwortet") would need a
  Supabase Database Webhook or Edge Function calling the same send logic.
- Pre-season special events (`src/media/specialEvents.ts`) and a Friday
  voting-close reminder: add event ids to `PUSH_EVENTS`, teach `dueEvent`
  about them, and add cron lines.
- Per-manager preferences (which events) — add boolean columns to
  `push_subscriptions` and pass them through the upsert RPC.
