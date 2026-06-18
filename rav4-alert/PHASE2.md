# Deal Alerts — Phase 2 plan

Turns the working alert engine into a multi-user, self-serve feature.
Stack: **Supabase** (DB/auth) + **GitHub Actions cron** + **Resend** + **Stripe** (Phase 3).

## Architecture
```
                    ┌─ twice-daily cron (GitHub Actions) ─────────────┐
 Auto.dev ──pull──▶ │ refresh listings_cache (tile: model×region)     │
 (models×regions)   │ → expire_stale_listings()  [sold-car cleanup]   │
                    │ for each active watchlist:                      │
                    │   filter cache (zip radius via lat/lng, price…) │
                    │   compute TCO (reuse tco.mjs) → rank            │
                    │   diff vs sent_state → NEW only                 │
                    │   Resend email → record sent_state              │
                    └─────────────────────────────────────────────────┘
 Static app (GitHub Pages) ──anon key──▶ Supabase: insert subscriber + watchlist
```
Key property: **API calls scale with models×regions, not users** (cache is filled once; each user is a DB filter).

## Build checklist (my side, once Supabase exists)
- [ ] `supabase.mjs` — service-role client (cron) + helpers.
- [ ] `cache-refresh.mjs` — pull tiles → upsert `listings_cache` (last_seen=now) → `expire_stale_listings()`.
- [ ] `alert-cron.mjs` — per-watchlist filter (incl. haversine radius) → TCO → NEW diff → Resend → `sent_state`. Reuses `digest.mjs`/`tco.mjs`.
- [ ] Subscribe form in the app (email + filters + assumptions) → insert via anon key; double opt-in confirm email.
- [ ] Confirm + unsubscribe endpoints (Supabase Edge Function or a small handler).
- [ ] `.github/workflows/alerts.yml` — cron (UTC) running cache-refresh + alert-cron with repo secrets.

## What you do to unblock it (≈10 min)
1. Create a free project at **supabase.com** → New project.
2. Open the **SQL editor**, paste `supabase/schema.sql`, run it.
3. From **Project Settings → API**, copy:
   - **Project URL** and **anon public key** → give me these (safe to share; public-by-design, RLS-protected).
   - **service_role key** → keep secret; we'll set it as a GitHub Actions secret + your local env var `SUPABASE_SERVICE_KEY` (never commit it, never ship it to the browser).

Then I wire the form + cron and we test a real subscribe → email round-trip.
