-- Phase 2b — double opt-in + unsubscribe + RLS hardening.
-- Paste this whole file into the Supabase SQL editor and Run (one time).
--
-- ON ROLE NAMES: `anon` / `authenticated` / `service_role` are the CURRENT Postgres
-- roles Supabase uses for RLS — they are NOT deprecated. Only the client API *key*
-- names changed (the "publishable" key authenticates as the `anon` role; the
-- "secret" key as `service_role`). So `to anon` below is current and correct.

-- 1) Harden anon signup: the publishable (anon) key may insert only UNCONFIRMED
--    subscribers, so the public form can't self-confirm and bypass double opt-in.
drop policy if exists anon_insert_subscriber on subscribers;
create policy anon_insert_subscriber on subscribers
  for insert to anon with check (confirmed = false);

-- 2) Columns: track confirmation send + unsubscribe. We KEEP unsubscribed rows
--    forever (future re-engagement) — unsubscribe only sets a timestamp.
alter table subscribers add column if not exists confirmation_sent_at timestamptz;
alter table subscribers add column if not exists unsubscribed_at timestamptz;

-- 3) Confirm RPC — flips confirmed via the emailed token. SECURITY DEFINER lets the
--    public confirm page (anon key) call it without any direct table-write grant.
create or replace function confirm_subscriber(p_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update subscribers set confirmed = true
   where confirm_token = p_token and confirmed = false;
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function confirm_subscriber(uuid) from public;
grant execute on function confirm_subscriber(uuid) to anon;

-- 4) Unsubscribe RPC — KEEP the row; timestamp it and deactivate its watchlists.
--    The cron emails only confirmed subscribers with unsubscribed_at IS NULL.
create or replace function unsubscribe_all(p_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update subscribers set unsubscribed_at = now()
   where unsubscribe_token = p_token and unsubscribed_at is null;
  update watchlists w set active = false
    from subscribers s
   where s.id = w.subscriber_id and s.unsubscribe_token = p_token;
  return true;
end $$;
revoke all on function unsubscribe_all(uuid) from public;
grant execute on function unsubscribe_all(uuid) to anon;
