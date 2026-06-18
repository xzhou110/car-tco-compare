-- Deal Alerts — Supabase (Postgres) schema. Phase 2.
-- Run this in the Supabase SQL editor once the project exists.
-- Model: tile-based listings cache (filled twice daily by the cron) + per-user
-- watchlists; alerts are pure DB filters, so API cost scales with models×regions,
-- not users. Email uses double opt-in + one-click unsubscribe (deliverability/CAN-SPAM).

create extension if not exists citext;

-- ─────────────────────────────────────────────────────────────────────────────
-- Subscribers (email-only signup; double opt-in)
create table if not exists subscribers (
  id                uuid primary key default gen_random_uuid(),
  email             citext not null unique,
  confirmed         boolean not null default false,
  confirm_token     uuid not null default gen_random_uuid(),
  unsubscribe_token uuid not null default gen_random_uuid(),
  created_at        timestamptz not null default now()
);

-- Watchlists — each user's saved search + their TCO assumption overrides.
-- filters/assumptions are JSON so the schema doesn't change as we add criteria.
create table if not exists watchlists (
  id            uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references subscribers(id) on delete cascade,
  name          text not null default 'My alert',
  filters       jsonb not null,   -- { makes:[], models:[], zip, radiusMi, priceMax, yearMin, mileageMax, trims:[] }
  assumptions   jsonb not null default '{}'::jsonb, -- TCO overrides: { region, holdingYears, annualMiles, financing }
  frequency     text not null default 'twice_daily',
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists watchlists_subscriber_idx on watchlists(subscriber_id);

-- Listings cache — the tiled twice-daily pull. last_seen drives sold-car expiry.
create table if not exists listings_cache (
  vin         text primary key,
  make        text, model text, trim text, year int,
  price       int, mileage int,
  condition   text, powertrain text, segment text,
  lat         double precision, lng double precision,
  city        text, state text, dealer text,
  vdp         text, carfax_url text,
  history     jsonb,           -- { accidents, accidentCount, ownerCount, usageType } when present
  raw         jsonb,           -- full normalized record, for forward-compat
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
create index if not exists listings_make_model_idx on listings_cache(make, model);
create index if not exists listings_lastseen_idx on listings_cache(last_seen);
-- geo + price/year for fast per-user filtering
create index if not exists listings_geo_idx on listings_cache(lat, lng);
create index if not exists listings_price_year_idx on listings_cache(price, year);

-- Which VINs each watchlist has already emailed (so we only send NEW matches).
create table if not exists sent_state (
  watchlist_id uuid not null references watchlists(id) on delete cascade,
  vin          text not null,
  sent_at      timestamptz not null default now(),
  primary key (watchlist_id, vin)
);

-- Versioned global assumption tables (segment rates, regional fuel/tax, depreciation).
-- Lets us update fuel prices etc. without an app redeploy. One row marked active.
create table if not exists reference_versions (
  id        uuid primary key default gen_random_uuid(),
  as_of     date not null,
  active    boolean not null default false,
  data      jsonb not null,   -- mirror of app/src/data/reference.ts
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Sold-car expiry: the cron upserts last_seen=now() for every car still in the
-- feed, then calls this to drop cars unseen past the grace window.
create or replace function expire_stale_listings(grace_hours int default 36)
returns int language plpgsql as $$
declare n int;
begin
  delete from listings_cache where last_seen < now() - make_interval(hours => grace_hours);
  get diagnostics n = row_count;
  return n;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row-level security. The cron uses the service role (bypasses RLS). The public
-- subscribe form uses the anon key and may only INSERT a subscriber + a watchlist.
alter table subscribers       enable row level security;
alter table watchlists        enable row level security;
alter table listings_cache    enable row level security;
alter table sent_state        enable row level security;
alter table reference_versions enable row level security;

drop policy if exists anon_insert_subscriber on subscribers;
-- with check (confirmed = false): anon may create only UNconfirmed subscribers,
-- so the public form can't bypass double opt-in by self-confirming.
create policy anon_insert_subscriber on subscribers for insert to anon with check (confirmed = false);

drop policy if exists anon_insert_watchlist on watchlists;
create policy anon_insert_watchlist on watchlists for insert to anon with check (true);
-- No anon SELECT/UPDATE/DELETE: reads/cache/sends happen only via the service role.
