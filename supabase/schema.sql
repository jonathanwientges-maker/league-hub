create table if not exists responses (
  id             uuid primary key default gen_random_uuid(),
  season         text not null,
  week           int  not null,
  roster_id      int  not null,
  kind           text not null default 'media_day',   -- 'media_day' | 'rivalry_statement'
  category_id    text not null,
  template_index int  not null,
  question       text not null,                       -- fully interpolated question shown
  answer         text not null check (char_length(answer) <= 280),
  reveal_at      timestamptz not null,                -- computed at submit (Phase 6)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (season, week, roster_id, kind)
);

create table if not exists likes (
  id               uuid primary key default gen_random_uuid(),
  response_id      uuid not null references responses(id) on delete cascade,
  voter_roster_id  int  not null,
  created_at       timestamptz not null default now(),
  unique (response_id, voter_roster_id)
);

-- In-app rival picker (Home Page, pre-draft only — see RivalPicker.tsx).
-- One row per manager per season; up to 2 rival roster_ids, self-reported.
create table if not exists rivals (
  id                uuid primary key default gen_random_uuid(),
  season            text not null,
  roster_id         int  not null,
  rival_roster_ids  int[] not null default '{}',
  updated_at        timestamptz not null default now(),
  unique (season, roster_id)
);

alter table responses enable row level security;
alter table likes     enable row level security;
alter table rivals    enable row level security;
create policy "open_all" on responses for all using (true) with check (true);
create policy "open_all" on likes     for all using (true) with check (true);
create policy "open_all" on rivals    for all using (true) with check (true);

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
