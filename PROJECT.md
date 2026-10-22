---
name: car-tco-compare
summary: Public Total-Cost-of-Ownership car comparator (up to 6 cars, real Auto.dev listings) plus the "Deal Alerts" email backend (Supabase + Resend + Actions cron); a XuSeak project
status: live
live: https://xzhou110.github.io/car-tco-compare/
repo: https://github.com/xzhou110/car-tco-compare
updated: 2026-10-21
---

# car-tco-compare — TCO comparator + Deal Alerts

## 1. Summary
A public, free, static web app that compares **total cost of ownership** (depreciation, financing,
fuel/energy, insurance, maintenance, repairs, taxes & fees) for up to 6 new/used cars under *your*
holding period and mileage — with a "Load a real car" modal fed by an **Auto.dev listings
snapshot** (RAV4 / Highlander / CR-V, 2020+). The same repo hosts **Deal Alerts**: sign up (double
opt-in, instant confirmation), get a TCO-ranked email digest of matching cars. Product thesis: the
free calculator is the funnel, paid alerts come later. Branded as a **XuSeak** project.
**Live**; the alerts backend runs as a POC on free tiers; the comparator's pure engine is also
vendored into [`car-shopping`](../car-shopping/PROJECT.md).

## 2. Key facts
| | |
|---|---|
| **Kind** | web app (public static SPA) + backend (cron email service) |
| **Stack** | Vite + React + TypeScript (app/, 42 Vitest tests, ESLint with the standard's boundary and size rules in `app/eslint.config.js`) · Node ESM scripts (rav4-alert/) · Supabase (Postgres, RPCs, Edge Function) · Resend · GitHub Actions |
| **Local path** | `D:\Meaningful\AI\car-tco-compare` |
| **Run** | `cd app; npm run dev` (launch config `car-tco-app`, port 5191) · `npm run check` (= lint, typecheck, tests, build; the validation for any app change) · `npm test` · `npm run lint` · `npm run build` · prototype: launch config `car-tco-prototype` (port 8123) or open `prototype/index.html` |
| **Deploy** | `deploy.yml` on push to `main` touching `app/**`: `check` job (`npm run check`) → `build` → GitHub Pages; `refresh-listings.yml` (annual + manual) runs the same `check` job, then rebuilds the snapshot **and self-deploys** (bot-token commits can't trigger `deploy.yml`); `check.yml` runs the gate on every other branch and pull request (ADR-001) |
| **Data / backends** | Auto.dev API (free 1,000 calls/mo — `rav4-alert/cache-refresh.mjs` is the only scheduled daily caller; `build-app-listings.mjs` once a year; `run.mjs` / `query.mjs` / `dump.mjs` only by hand) · Supabase project (free tier; browser env `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`, server env `SUPABASE_URL` + `SUPABASE_SECRET_KEY`) · Resend, verified domain `send.xuspark.com` · segment×powertrain reference tables bundled in `app/src/data/reference.ts`. **$0/month today.** |
| **Related** | [`car-shopping`](../car-shopping/PROJECT.md) vendors `lib/tco` from here · [`/build` plugin](../claude-marketplace/PROJECT.md) (Deal Alerts Phase 2 was built with it) · skills: `supabase-email-alerts` (generalized from this backend), `web-data-snapshot`, `ship-web-app` |
| **Started · last major change** | 2026-06-15 · 2026-06-27 (listings refresh monthly → annual to cut API calls) |

## 3. Key things to know
- **Brand:** XuSeak; bylines link to `https://ai.xuseak.com/`. The verified Resend sender remains `alerts@send.xuspark.com` until a new sending domain is verified. Website deployment and the `send-confirmation` Supabase Edge Function are separate releases; the daily email scripts follow `main` automatically.
- **All cost rates are illustrative placeholders** (segment-level; `app/src/data/reference.ts` says so in its header and `source` field; in-app the footer note reads "cost assumptions are illustrative" and How It Works carries a rough-estimates warning — there is no "Est." badge). No commercial "cheapest to own" claim until Edmunds/AAA-grade data replaces them. Listings are a best-effort snapshot — verify before buying (the README's disclaimer is deliberate; liability matters).
- **Auto.dev API facts:** 20 records/page on the starter tier (`limit` ignored — paginate `page`; a call = a page; `rav4-alert/autodev.mjs` retries 429s with a short backoff and dedupes by VIN); filters make/model/year/miles/price/zip/distance but **no trim filter** (filter client-side). **Commercial license required before charging** — the #1 launch blocker.
- **Auto.dev data quirks:** gas and hybrid are separate *model names* ("RAV4" vs "RAV4 Hybrid") and the raw `fuel` field mislabels hybrids as gasoline, so every script derives `powertrain` from the model name; `history` (accidents/owners) is populated for only a tiny share of 2020+ cars (~0.4% per the `digest.mjs` comment; an earlier count said ~2%) → display it, never filter on it, and let the reader verify via the `carfaxUrl` link.
- **Tile cache architecture:** the daily cron pulls (model × region) tiles into `listings_cache` (POC: Toyota RAV4 gas + hybrid only, hard-coded in `cache-refresh.mjs`), stamps `last_seen` and calls `expire_stale_listings(36)` so sold cars drop out; per-user alerts are pure DB filters, so API cost is decoupled from subscriber count (page PostgREST's 1,000-row cap with `.range()`, as `alert-cron.mjs` does). Unsubscribed rows are kept forever (`unsubscribed_at`), re-subscribe is an idempotent RPC.
- **Personal POC values are hard-coded in the backend** — the owner's ZIP, the 200-mi radius and a personal preview/test address sit in `rav4-alert/config.mjs`, `cache-refresh.mjs`, `build-app-listings.mjs`, `geo.mjs` and `seed-watchlists.mjs`. Never copy them into docs. Radius filtering is a stub: `geo.mjs` knows that one ZIP centroid and `withinRadius()` returns everything for any other ZIP — load a full US ZIP→lat/lng table and parametrize the tiles before serving other areas.
- **Two data layers in the app:** volatile listings snapshot (`app/public/data/listings.json`, fetched at runtime) vs. bundled assumptions (reference tables + per-user overrides). `lib/resolveVehicle.ts` joins listing → segment → rates → engine `Vehicle`.
- **Scraping era is over:** `proxy/` (Autotrader `__NEXT_DATA__` scrape) is a fallback only — datacenter IPs (Actions, Workers) get blocked; the durable lesson lives in the `web-data-snapshot` skill. Auto.dev replaced it.
- **Three workflows, two deploy paths** — see the table in README §Automation. Crons stay well inside the free API tier (RAV4-only daily cache refresh + one ~100–130-call annual pull). Never schedule another Auto.dev caller without recomputing the budget; the hand-run `run.mjs` / `query.mjs` / `dump.mjs` spend calls too.
- **Windows control-plane traps** (Supabase/Resend secrets): a PowerShell pipe into `gh secret set` injects a BOM → use `--body`; details in the `supabase-email-alerts` skill and global CLAUDE.md.
- **Three copies of the TCO engine:** `app/src/lib/tco.ts` (+ `depreciation.ts`, `data/reference.ts`) is vendored into car-shopping **and** hand-ported as `rav4-alert/tco.mjs` so the digest's ranking matches the app. Neither copy updates itself — after an engine or rate change re-sync both by hand and note it in each place.
- **Secrets and ids live outside this file.** Every key is a GitHub Actions secret or variable, a Supabase function secret or a local env var — §4 *Configuration and secrets* names each one's home; the Supabase project ref appears only as a code default (`rav4-alert/supabase/client.mjs`, `rav4-alert/supabase/config.toml`, `app/src/lib/supabaseClient.ts`). Repo is **public** (MIT-style LICENSE present). Env values / project ids never go in docs.

## 4. Details
### How it works
`app/` is a static SPA: a pure typed engine (`lib/tco.ts`) + `resolveVehicle` + a listings loader,
state in `state/useComparison.ts` (localStorage + compressed share link), charts and a results-first
layout. "Load a real car" is a `<dialog>` (`ListingModal.tsx`) with cascading Make → Model selects
and a min-year filter over the snapshot, which is fetched only when the modal opens; the Deal Alerts
signup is `AlertsModal.tsx` (up to 3 watchlists, multi-select Make/Model/Trim/Fuel sourced from the
same snapshot) → `start_subscription` RPC → the `send-confirmation` Edge Function for the instant
double-opt-in mail. `rav4-alert/` is a set of Node scripts; `alerts.yml` runs them daily in order:
`cache-refresh.mjs` (Auto.dev → Supabase `listings_cache`, `continue-on-error`) → `send-confirmations.mjs`
(fallback confirmations, `continue-on-error`) → `alert-cron.mjs` (per confirmed, not-unsubscribed
subscriber: match each active watchlist against the cache, 5-yr TCO via `tco.mjs`, a Top-10-by-TCO
table then one table per watchlist, NEW badges from `sent_state`, one xlsx tab per watchlist, sent via
Resend). `build-app-listings.mjs` builds the app snapshot; `preview-email.mjs` / `lifecycle-test.mjs`
verify without (or with one real) send. `run.mjs` (`npm run send` / `npm run dry`) is the original
single-user digest that calls Auto.dev directly and tracks seen VINs in `state/seen.json` — kept for
personal use, not part of any workflow. Supabase holds subscribers / watchlists / listings_cache /
sent_state (+ an unused `reference_versions` table) with RLS on every table (anon may only insert an
unconfirmed subscriber) and SECURITY DEFINER RPCs (`confirm_subscriber`, `unsubscribe_all`,
`start_subscription`); the Edge Function keeps `verify_jwt = true` and only ever emails an existing,
unconfirmed, not-yet-emailed subscriber.
```
app/            production SPA (src/lib/tco.ts · resolveVehicle.ts · listings.ts · data/reference.ts · components/ · state/)
rav4-alert/     Deal Alerts backend scripts + supabase/ (SQL, config.toml, functions/) + its own README/RUN_LOG/review-findings
proxy/          legacy scraper (fallback)        prototype/   no-build clickable references
docs/           PRD.md · design/ARCHITECTURE.md · design/tco-model.md
.github/workflows/  deploy.yml · refresh-listings.yml · alerts.yml
.claude/        launch.json + static-server.js (local preview helpers; gitignored, local only)
```
Skeleton aliases for the engineering standard (`D:/Meaningful/AI/agent-skills/rules/engineering-principles.md`),
inside `app/src/`: `lib/` = engine (pure; the lint forbids framework, I/O and upward imports there, with
`listings.ts` and `supabaseClient.ts` marked as step-3 offenders), `components/` = ui, `state/` = the hook that
owns localStorage, the share link and profiles (no adapters folder yet), `App.tsx` + `main.tsx` = the app shell.

### Data layer (where the numbers come from)
- **Reference tables** — `app/src/data/reference.ts` exports `REFERENCE` (`asOf`, `source`, `rates`, `regions`, `incentives`). `rates` has ten segment keys (`car-economy` … `minivan`), each a `RateRow` (stand-in `mpg`, `depRateNew` / `depRateUsed`, `insurance`, `maintenance`, `repair`, warranty years/miles) with optional `byPowertrain` overrides for hybrid/EV; `regions` has national, CA, TX, NY, FL (fuel, electricity, sales tax, registration, insurance multiplier); `incentives` is per powertrain × new/used (only EV non-zero). Deliberately segment-level, not per-trim — rough, transparent, editable (`docs/design/ARCHITECTURE.md` §6). `lib/resolveVehicle.ts` joins listing → segment → rates, applies the region multiplier and leaves `resaleValue: null` for the engine's retention curve (`lib/depreciation.ts`).
- **Listings snapshot** — `app/public/data/listings.json` (~1 MB, tracked, shipped with the Pages build, fetched at runtime with `cache: 'no-store'`). Built by `rav4-alert/build-app-listings.mjs`: six Auto.dev model queries (RAV4 / Highlander / CR-V × gas / hybrid, 2020+, near the POC ZIP / 200 mi), normalized to the app's `Listing` shape with the segment assigned per model and each VIN's `firstSeen` carried forward across rebuilds (days on market). The previous file is backed up beside it as `*.bak.json` (gitignored). `build-applistings-from-cache.mjs` rebuilds it from `listings_cache` for 0 API calls.
- **Alert cache** — Supabase `listings_cache`: `vin` (PK / upsert key), make, model, trim, year, price, mileage, condition, powertrain (derived from the model name), segment, lat/lng (from Auto.dev's `location`), city, state, dealer, vdp, carfax_url, `history` jsonb, `raw`, `first_seen` (kept on conflict) / `last_seen`. Fed only by `cache-refresh.mjs` (`--dry`, `--models "Make:Model:segment"`, `--max-pages N`, default 25 pages per tile); `seed-cache.mjs` fills it from the app snapshot without API calls (lossy: no lat/lng, history, carfax).
- **Watchlist `filters` jsonb** — `{ makes[], models[], fuels[], trims[], zip, radius, priceMin, priceMax, yearMin, milesMax }` (arrays mean any-of; `alert-cron.mjs` filters make/model/fuel/price/year/miles in SQL, trims in JS). Legacy single-value `make` / `model` / `powertrain` and `xlePlusOnly` are still honoured; `isXlePlus` in `digest.mjs` treats any trim not starting with "LE" as XLE-and-above, so SE/XSE count today.
- **Digest TCO** — `rav4-alert/tco.mjs` mirrors the app engine, its depreciation curve and `REFERENCE` by hand (region CA, listings treated as used) — see the sync rule in §3.

### Configuration and secrets (names only — values never here)
| Name | Lives in | Used by |
|---|---|---|
| `AUTODEV_API_KEY` | GitHub Actions repo secret · Windows User env var locally | `cache-refresh.mjs`, `build-app-listings.mjs`, `run.mjs` / `query.mjs` / `dump.mjs` |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (legacy alias `SUPABASE_SERVICE_ROLE_KEY`) | repo secrets · local env | every server script via `rav4-alert/supabase/client.mjs` (the URL falls back to the project URL hard-coded there) |
| `RESEND_API_KEY` | repo secret **and** a Supabase function secret (`npx supabase secrets set … --project-ref <ref>`) | `alert-cron.mjs`, `send-confirmations.mjs`, `run.mjs`, the Edge Function (both strip a stray BOM) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | GitHub Actions repository **variables** (not secrets — the publishable key is browser-safe, RLS protects data) · `app/.env.local` locally (gitignored) | the SPA (`app/src/lib/supabaseClient.ts`), injected at build time by `deploy.yml` and `refresh-listings.yml` |
| `CONFIRM_SENDER` | optional Supabase function secret | overrides the confirmation sender; the digest sender is `SETTINGS.sender` in `rav4-alert/config.mjs` |
| `SUPABASE_ACCESS_TOKEN` | local only | `npx supabase functions deploy send-confirmation --project-ref <ref>` (the function's own `SUPABASE_URL` / service-role key are injected by Supabase) |
| `APP_URL`, `TEST_EMAIL` | local env, optional | live-URL override for confirm/unsubscribe links (`config.mjs`); `lifecycle-test.mjs` recipient (sends real mail) |

- Schema changes are applied by pasting SQL into the Supabase SQL editor, in order `schema.sql` → `phase2b.sql` → `phase3-resubscribe.sql` (no migration tool); the Edge Function is a separate `functions deploy`.
- Resend sending domain `send.xuspark.com`: DKIM, SPF and return-path MX records were added at SiteGround (the domain's DNS host, 2026-06). Migrating to a XuSeak domain means verifying the new domain in Resend first, then updating `SETTINGS.sender` and the function's default / `CONFIRM_SENDER`.

### How to work on it
App: `cd app; npm install; npm run dev` while working, then `npm run check` (lint, typecheck, tests,
build) before any push: it is the validation for every app change and the same command Actions runs
before anything deploys (ADR-001); a push to `main` deploys only if `app/**` changed, and then only once
the `check` job is green; confirm the run and that the live page's `<meta name="build-commit">` equals
the pushed commit. Backend: run scripts from `rav4-alert/` with env vars set (never commit them);
`preview-email.mjs` / `lifecycle-test.mjs` before touching the cron (`alert-cron.mjs --dry` and
`cache-refresh.mjs --dry` write previews to `out/` without sending or writing); workflow secrets via
`gh secret set NAME --body ...`. Snapshot refresh: run `refresh-listings.yml` manually (or
`build-applistings-from-cache.mjs` for a 0-API-call rebuild from the cache). Diagnostics:
`verify-rpc.mjs`, `check-sub.mjs`, `check-applistings.mjs`, `check-xlsx.mjs` / `verify-xlsx.mjs`
(no API calls); `query.mjs` / `dump.mjs` probe Auto.dev and do spend calls.

### Current state & open items
Comparator live; alerts POC live (daily 15:00 UTC digest). Open / blockers before monetizing:
Auto.dev commercial license · Stripe paywall · real cost data (Edmunds/AAA) · quieter digests
(`SETTINGS.emailMode` in `rav4-alert/config.mjs` is dead — `alert-cron.mjs` always sends every match
with NEW badges; implement `new-only` or delete the setting, `review-findings.md` S7) · radius
filtering needs a full ZIP-centroid table (`geo.mjs` stub) · 200-mi radius is wide · whether SE/XSE
should count as "XLE and above" (today they do) · `deploy.yml` uses Node-20-era action versions
(bump). Repo-local status: `rav4-alert/RUN_LOG.md`.
Engineering-standard debt (audit 2026-10-21, ADR-001): purity, retrofit step 3 — `app/src/lib/listings.ts`
calls `fetch` and `app/src/lib/supabaseClient.ts` creates the Supabase client from inside the pure folder;
both move to an adapters folder (callers: `App.tsx`, `AlertsModal.tsx`, `ConfirmPage.tsx`, `UnsubscribePage.tsx`);
`app/src/state/useComparison.ts` types saved data as `any` five times in its hydration path (replace with
`unknown` plus one sanitizer at the edge); each carries a one-line lint marker naming the entry. Size, step 4:
`AlertsModal.tsx` 337 lines, split at its next touch. The Node version is not pinned (CI 22, machine 24).
The gate in `refresh-listings.yml` is validated by parsing only until the next manual or annual run.

### Change highlights
- 2026-10-21 — Command surface and CI gate (ADR-001, the first entry of the new `DECISIONS.md`): ESLint with the standard's boundary and size rules, `npm run lint`, `npm run typecheck` and `npm run check`, a `check` job that both deploy workflows' deploying jobs need, and `check.yml` for other branches and pull requests; three known debts marked in their files. No behavior or UI change.
- 2026-10-16 — Build-commit stamp: the built page carries `<meta name="build-commit">` with the deployed commit (GitHub Actions' `GITHUB_SHA`; `local` for a local build), so a deploy is proven live by that id, not by a `?t=` query the Pages CDN ignores (app/index.html, app/vite.config.ts (process reached through globalThis: this tsconfig type-checks the config without Node types)).
- 2026-10-09 — Owner-requested XuSeak rebrand: website/account pages, digest and both confirmation email templates, linked documentation and workspace index. Pages deployment succeeded; instant-confirmation function deployed as version 6 with JWT verification preserved. Resend lists only `send.xuspark.com` as verified, so that sender is the remaining migration item.
- Brand audit method (2026-10-09): search tracked files in all 13 registered personal repositories with `git grep -l -i -E 'xu[ -]?spark'`, excluding private/local/employer paths; inspect active UI, email templates, documentation and deployment consumers. Preserve dated history and stable identifiers. Verification: app type-check/build, 42 existing tests, offline `buildHtml` digest render, live main/confirm/unsubscribe bylines and destinations, local/live bundle filename match, and an empty function POST returning 400 without sending email. Real email delivery was not exercised. Future email-domain migration must verify the new domain in Resend before updating both `SETTINGS.sender` and the Edge Function's sender/override.
- 2026-06-27 — big listings refresh moved monthly → annual (API budget).
- 2026-06 — Deal Alerts Phase 2 (double opt-in with instant confirmation, per-preference digest tables, xlsx attachment, re-subscribe RPC), Resend domain verified, twice-daily → daily cron.
- 2026-06 — "Load a real car" modal + Auto.dev-sourced snapshot replaces the Autotrader scrape; car-shopping vendors the engine.
- 2026-06-15 — repo created; prototype → Vite/React/TS app; curve-based depreciation, share links, charts.

## 5. Pointers
- [README.md](README.md) — public product face: features, data model, automation table, repo structure, quick start.
- [DECISIONS.md](DECISIONS.md) — ADR log, started 2026-10-21 (ADR-001 command surface and CI gate); earlier decisions stay in the design docs it points to.
- [docs/PRD.md](docs/PRD.md) · [docs/design/ARCHITECTURE.md](docs/design/ARCHITECTURE.md) · [docs/design/tco-model.md](docs/design/tco-model.md) (every formula).
- [rav4-alert/README.md](rav4-alert/README.md) · [rav4-alert/RUN_LOG.md](rav4-alert/RUN_LOG.md) · [rav4-alert/review-findings.md](rav4-alert/review-findings.md) — the alerts backend.
- [prototype/README.md](prototype/README.md) — the no-build reference UI.
- Operational configuration: §4 *Configuration and secrets* names every env var's home; values and the project ref stay in GitHub, Supabase, local env and code defaults — never in this public file. Skills: `supabase-email-alerts`, `web-data-snapshot`.
