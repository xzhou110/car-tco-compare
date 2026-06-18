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

## Signup form (in the app)

`app/src/components/AlertsModal.tsx` — up to 3 preferences. Each preference uses
**data-driven multi-select dropdowns** ([`MultiSelect.tsx`](../app/src/components/MultiSelect.tsx))
sourced from the listings snapshot, so options always match the data: **Make**, **Model**,
**Trim**, and **Fuel type** are each a **multi-select** dropdown (collapsed trigger →
expand a scrollable checklist; pick several values, OR'd together), always shown, with
options scoped to the makes/models chosen so far — plus Zip, Radius, Min/Max price, Min
year, Max miles. ("Fuel type" is the user-facing label for the internal `powertrain`
field — the car card uses the same wording.)

On submit it calls the `start_subscription` RPC (upsert subscriber + replace watchlists, so
**re-signup after unsubscribe works** instead of hitting the unique-email constraint), then
invokes the `send-confirmation` Edge Function for an **instant** double-opt-in email (the
twice-daily `send-confirmations.mjs` cron stays as a fallback). Each watchlist's `filters`
jsonb may contain (arrays mean "any of"):
`{ makes[], models[], fuels[], trims[], zip, radius, priceMin, priceMax, yearMin, milesMax }`.
The cron still also accepts the older single-value `make`/`model`/`powertrain` keys.

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

Run once in the Supabase SQL editor, in order: [`supabase/schema.sql`](supabase/schema.sql),
[`supabase/phase2b.sql`](supabase/phase2b.sql) (double opt-in + unsubscribe RPCs +
`unsubscribed_at`/`confirmation_sent_at` columns + hardened RLS), then
[`supabase/phase3-resubscribe.sql`](supabase/phase3-resubscribe.sql) — the
`start_subscription` RPC for idempotent signup / re-signup.

## Instant confirmation (Edge Function)

[`supabase/functions/send-confirmation/`](supabase/functions/send-confirmation/index.ts) is a
Deno Edge Function the signup form invokes so the confirmation email goes out **immediately**
(not on the next cron run). Deploy it + set its secret:

```powershell
npx supabase functions deploy send-confirmation --project-ref <ref>   # needs SUPABASE_ACCESS_TOKEN
npx supabase secrets set RESEND_API_KEY=re_xxx --project-ref <ref>     # SUPABASE_URL/SERVICE_ROLE auto-injected
```

It reads the confirm token with the service role, sends via Resend, and stamps
`confirmation_sent_at` so the cron never double-sends. `verify_jwt` stays **on** (the
browser's publishable key passes the gateway). `send-confirmations.mjs` is the fallback.
The from-address is **`Car Deal Alerts <alerts@send.xuspark.com>`** (a verified Resend
domain, so mail delivers to any subscriber — not just the account owner); override via the
`CONFIRM_SENDER` secret. The cron's sender lives in `config.mjs` (`SETTINGS.sender`).

## Scripts

| Command | What it does |
|---------|--------------|
| `node cache-refresh.mjs` | **Only Auto.dev caller.** Pull model×region tiles → upsert `listings_cache` (set `last_seen`) → `expire_stale_listings()`. Keep page caps small. |
| `node seed-cache.mjs` | Dev seed of `listings_cache` from the app snapshot (no Auto.dev calls). |
| `node build-app-listings.mjs` | Rebuild the app's "Load a real car" snapshot (`app/public/data/listings.json`) from Auto.dev — all 3 models (~100 calls). Run weekly by `refresh-listings.yml`. |
| `node build-applistings-from-cache.mjs` | Rebuild that snapshot from `listings_cache` instead — **0 Auto.dev calls** (reuses what the alert cron already pulled). |
| `node seed-watchlists.mjs` | Seed a test subscriber + 2 RAV4 Hybrid watchlists. |
| `node alert-cron.mjs [--dry]` | The digest job. `--dry` builds previews in `out/` without sending/recording. |
| `node send-confirmations.mjs` | Email confirm links to unconfirmed signups. |
| `node preview-email.mjs` | Render the email + xlsx from the cache (no Supabase subscriber table needed) → `out/`. |
| `node verify-rpc.mjs` | Smoke-test the confirm/unsubscribe RPCs. |
| `node lifecycle-test.mjs phase1\|phase2` | End-to-end test: signup → instant confirm → confirm → (digest) → unsubscribe → re-signup, asserting DB state + Resend IDs. Sends REAL email to `TEST_EMAIL`. |

## Email digest

`digest.mjs` builds: a 🏆 **Top-10 by lowest 5-yr TCO** table, then one summary table
per preference (named by the user's watchlist), and a single **.xlsx** attachment with
one tab per preference. Vehicle names are clickable listing links (in both the email and
the spreadsheet). TCO mirrors the web app's engine (`tco.mjs`, CA assumptions) — including
the **value-retention depreciation curve** and **model-year-derived age** (kept in sync with
`app/src/lib/depreciation.ts` + `tco.ts`), so the digest's ranking matches the app.

**Branding:** every email (digest + double-opt-in confirmation) carries a *"a project by
**[XuSpark](https://xuspark.com)**"* byline, matching the web app's header/footer attribution.

**Unsubscribe:** every digest has a one-click **Unsubscribe** link in the footer →
`#/unsubscribe?token=…` in the app → the `unsubscribe_all` RPC timestamps `unsubscribed_at`
and deactivates that user's watchlists (the row is kept for re-engagement; they can
re-subscribe any time from the form — `start_subscription` revives it).

## Scheduling — two cadences, two data stores

The **alert cache** (`listings_cache`, what digests match against) and the app's
**"Load a real car" snapshot** (`listings.json`) are separate and refresh on different
schedules:

| Workflow | When | Refreshes |
|---|---|---|
| [`alerts.yml`](../.github/workflows/alerts.yml) | twice daily — **15:00 + 21:00 UTC (8am + 2pm Pacific)** | the alert cache (`cache-refresh.mjs`, **RAV4 only** to stay free) → then sends digests (`alert-cron.mjs`) |
| [`refresh-listings.yml`](../.github/workflows/refresh-listings.yml) | weekly — **Mon 16:00 UTC (8am PT)** | the "Load a real car" snapshot (`build-app-listings.mjs`, **all 3 models**) → commits it → builds + deploys Pages |

The twice-daily times are clustered for when fresh dealer inventory lands (overnight feed
wave + midday adds), not evenly spread; GitHub cron is fixed UTC, so in PST they're
7am/1pm. The weekly job self-deploys because a `GITHUB_TOKEN` commit doesn't trigger
`deploy.yml`. Both stay inside Auto.dev's free 1,000/mo tier (RAV4 dozens/run twice daily +
~100 calls weekly ≈ <600/mo). Adding a workflow file to GitHub needs a token with the
`workflow` scope: `gh auth refresh -h github.com -s workflow`.

## Before public launch

- ✅ **Resend domain verified** — `send.xuspark.com` (DKIM + SPF + return-path MX). Emails now
  deliver to **any** subscriber, sent from `alerts@send.xuspark.com`.
- **Auto.dev commercial license** — before charging / serving many users.
- **Deploy** the web app (off GitHub Pages if you want server features) and enable the cron.
- **Production cache-refresh** to backfill `lat/lng` (radius filtering), history, and
  carfax into `listings_cache` (the dev seed from the app snapshot is lossy).
