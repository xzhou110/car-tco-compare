# Deal Alerts (rav4-alert/)

Backend for the **car-tco-compare** "Deal Alerts" feature: twice-daily, TCO-ranked
used-car email digests. Users sign up on the web app and pick up to 3 preferences
(watchlists); a scheduled job filters a cached pool of listings, computes 5-year
total cost of ownership, and emails each subscriber a digest + spreadsheet.

## Architecture

```
Auto.dev API ──(cache-refresh.mjs, twice daily)──► Supabase: listings_cache
                                                          │
Web app signup form ──► Supabase: subscribers + watchlists│
                                                          ▼
                          alert-cron.mjs: per subscriber → filter cache by each
                          watchlist → TCO (tco.mjs) → NEW vs sent_state →
                          digest (digest.mjs) → Resend → record sent_state
```

Key idea: **one cached (model × region) tile serves all users** — alert sending makes
*zero* Auto.dev calls, so API cost scales with models×regions, not subscribers.

## Environment variables

| Var | Used by | Notes |
|-----|---------|-------|
| `AUTODEV_API_KEY` | cache-refresh | Auto.dev listings |
| `SUPABASE_URL` | all server scripts | defaults to the project URL in `supabase/client.mjs` |
| `SUPABASE_SECRET_KEY` | all server scripts | server-only (bypasses RLS) — never ship to the browser |
| `RESEND_API_KEY` | alert-cron, send-confirmations | email |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | the web app | publishable key is browser-safe (RLS protects data) |

On Windows these are User env vars; a fresh PowerShell may need a PATH/env refresh from
the registry (`[Environment]::GetEnvironmentVariable(...,'User')`).

## Database

Run once in the Supabase SQL editor: [`supabase/schema.sql`](supabase/schema.sql) then
[`supabase/phase2b.sql`](supabase/phase2b.sql) (double opt-in + unsubscribe RPCs +
`unsubscribed_at`/`confirmation_sent_at` columns + hardened RLS).

## Scripts

| Command | What it does |
|---------|--------------|
| `node cache-refresh.mjs` | **Only Auto.dev caller.** Pull model×region tiles → upsert `listings_cache` (set `last_seen`) → `expire_stale_listings()`. Keep page caps small. |
| `node seed-cache.mjs` | Dev seed of `listings_cache` from the app snapshot (no Auto.dev calls). |
| `node seed-watchlists.mjs` | Seed a test subscriber + 2 RAV4 Hybrid watchlists. |
| `node alert-cron.mjs [--dry]` | The digest job. `--dry` builds previews in `out/` without sending/recording. |
| `node send-confirmations.mjs` | Email confirm links to unconfirmed signups. |
| `node preview-email.mjs` | Render the email + xlsx from the cache (no Supabase subscriber table needed) → `out/`. |
| `node verify-rpc.mjs` | Smoke-test the confirm/unsubscribe RPCs. |

## Email digest

`digest.mjs` builds: a 🏆 **Top-10 by lowest 5-yr TCO** table, then one summary table
per preference (named by the user's watchlist), and a single **.xlsx** attachment with
one tab per preference. Vehicle names are clickable listing links (in both the email and
the spreadsheet). TCO mirrors the web app's engine (`tco.mjs`, CA assumptions).

## Scheduling

[`../.github/workflows/alerts.yml`](../.github/workflows/alerts.yml) runs cache-refresh
then alert-cron twice daily (UTC), using repo secrets. (Adding the workflow to GitHub
needs a token with the `workflow` scope: `gh auth refresh -h github.com -s workflow`.)

## Before public launch

- **Resend domain verification** — until done, mail only delivers to the account owner.
- **Auto.dev commercial license** — before charging / serving many users.
- **Deploy** the web app (off GitHub Pages if you want server features) and enable the cron.
- **Production cache-refresh** to backfill `lat/lng` (radius filtering), history, and
  carfax into `listings_cache` (the dev seed from the app snapshot is lossy).
