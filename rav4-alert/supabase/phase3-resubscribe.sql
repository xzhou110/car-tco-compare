-- Phase 3 — idempotent (re)subscribe, so "unsubscribe → re-signup" works.
--
-- Why: subscribers.email is UNIQUE and unsubscribe is a SOFT delete (phase2b keeps
-- the row, just sets unsubscribed_at). So the frontend's plain INSERT on re-signup
-- hits a unique-violation → "You're already subscribed." This SECURITY DEFINER RPC
-- upserts the subscriber and replaces their watchlists in one anon-callable call.
--
-- Semantics:
--   • new email                  → insert, unconfirmed (must confirm).
--   • previously UNSUBSCRIBED     → reset to a fresh unconfirmed state with a NEW
--                                   confirm_token (old emailed link is invalidated),
--                                   so they re-confirm. Old watchlists are replaced.
--   • active CONFIRMED (dup)      → keep their confirmation; just replace watchlists
--                                   (no needless re-confirm email).
-- In all cases the caller then invokes the send-confirmation function, which only
-- emails when the row is unconfirmed + not-yet-sent (so confirmed users get nothing).

create or replace function start_subscription(p_email citext, p_watchlists jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into subscribers (email, confirmed, unsubscribed_at)
    values (p_email, false, null)
  on conflict (email) do update set
    confirmed            = case when subscribers.unsubscribed_at is not null then false            else subscribers.confirmed            end,
    confirm_token        = case when subscribers.unsubscribed_at is not null then gen_random_uuid() else subscribers.confirm_token        end,
    confirmation_sent_at = case when subscribers.unsubscribed_at is not null then null             else subscribers.confirmation_sent_at end,
    unsubscribed_at      = null
  returning id into v_id;

  -- Replace this subscriber's saved searches with the submitted set
  -- (FK on watchlists cascades sent_state, so prior "already emailed" state resets too).
  delete from watchlists where subscriber_id = v_id;
  insert into watchlists (subscriber_id, name, filters, active)
  select v_id,
         coalesce(w->>'name', 'My alert'),
         coalesce(w->'filters', '{}'::jsonb),
         coalesce((w->>'active')::boolean, true)
  from jsonb_array_elements(p_watchlists) as w;

  return v_id;
end $$;
revoke all on function start_subscription(citext, jsonb) from public;
grant execute on function start_subscription(citext, jsonb) to anon;
