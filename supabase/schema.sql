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
