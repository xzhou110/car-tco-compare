---
name: car-tco-compare
summary: Public Total-Cost-of-Ownership car comparator (up to 6 cars, real Auto.dev listings) plus the "Deal Alerts" email backend (Supabase + Resend + Actions cron); the XuSpark side-project funnel
status: live
live: https://xzhou110.github.io/car-tco-compare/
repo: https://github.com/xzhou110/car-tco-compare
updated: 2026-09-24
---

# car-tco-compare — TCO comparator + Deal Alerts

## 1. Summary
A public, free, static web app that compares **total cost of ownership** (depreciation, financing,
fuel/energy, insurance, maintenance, repairs, taxes & fees) for up to 6 new/used cars under *your*
holding period and mileage — with a "Load a real car" modal fed by an **Auto.dev listings
snapshot** (RAV4 / Highlander / CR-V, 2020+). The same repo hosts **Deal Alerts**: sign up (double
opt-in, instant confirmation), get a TCO-ranked email digest of matching cars. Product thesis: the
free calculator is the funnel, paid alerts come later. Branded as a **XuSpark** project.
**Live**; the alerts backend runs as a POC on free tiers; the comparator's pure engine is also
vendored into [`garage`](../../garage/PROJECT.md).

## 2. Key facts
| | |
|---|---|
| **Kind** | web app (public static SPA) + backend (cron email service) |
| **Stack** | Vite + React + TypeScript (app/, 42 Vitest tests) · Node ESM scripts (rav4-alert/) · Supabase (Postgres, RPCs, Edge Function) · Resend · GitHub Actions |
| **Local path** | `D:\Meaningful\AI\claude_projects\github\car-tco-compare` ⚠ legacy nesting under `github/` — the only project not at the workspace root |
| **Run** | `cd app; npm run dev` (launch config `car-tco-app`, port 5191) · prototype: launch config `car-tco-prototype` (port 8123) or open `prototype/index.html` |
| **Deploy** | `deploy.yml` on push to `main` touching `app/**` → GitHub Pages; `refresh-listings.yml` (annual + manual) rebuilds the snapshot **and self-deploys** (bot-token commits can't trigger `deploy.yml`) |
| **Data / backends** | Auto.dev API (free 1,000 calls/mo — `rav4-alert/cache-refresh.mjs` is the ONLY caller) · Supabase project (free tier; env `SUPABASE_PUBLISHABLE_KEY` browser / `SUPABASE_SECRET_KEY` server) · Resend, verified domain `send.xuspark.com` · segment×powertrain reference tables bundled in `app/src/data/reference.ts`. **$0/month today.** |
| **Related** | [`garage`](../../garage/PROJECT.md) vendors `lib/tco` from here · [`/build` plugin](../../claude-marketplace/PROJECT.md) (Deal Alerts Phase 2 was built with it) · skills: `supabase-email-alerts` (generalized from this backend), `web-data-snapshot`, `ship-web-app` |
| **Started · last major change** | 2026-06-15 · 2026-06-27 (listings refresh monthly → annual to cut API calls) |

## 3. Key things to know
- **All cost rates are illustrative placeholders** (segment-level, labelled "Est." in-app). No commercial "cheapest to own" claim until Edmunds/AAA-grade data replaces them. Listings are a best-effort snapshot — verify before buying (the README's disclaimer is deliberate; liability matters).
- **Auto.dev facts:** 20 records/page on the starter tier (`limit` ignored — paginate `page`; a call = a page); filters make/model/year/miles/price/zip/distance but **no trim filter** (filter client-side); `history` (accidents/owners) is populated for ~2% of 2020+ cars → display, don't filter. **Commercial license required before charging** — the #1 launch blocker.
- **Tile cache architecture:** the cron pulls (model × region) tiles into `listings_cache`; per-user alerts are pure DB filters, so API cost is decoupled from subscriber count. Unsubscribed rows are kept forever (`unsubscribed_at`), re-subscribe is an idempotent RPC.
- **Two data layers in the app:** volatile listings snapshot (`app/public/data/listings.json`, fetched at runtime) vs. bundled assumptions (reference tables + per-user overrides). `lib/resolveVehicle.ts` joins listing → segment → rates → engine `Vehicle`.
- **Scraping era is over:** `proxy/` (Autotrader `__NEXT_DATA__` scrape) is a fallback only — datacenter IPs (Actions, Workers) get blocked; the durable lesson lives in the `web-data-snapshot` skill. Auto.dev replaced it.
- **Three workflows, two deploy paths** — see the table in README §Automation. Crons stay well inside the free API tier (RAV4-only daily cache refresh + one ~100-call annual pull). Never add a second Auto.dev caller without recomputing the budget.
- **Windows control-plane traps** (Supabase/Resend secrets): a PowerShell pipe into `gh secret set` injects a BOM → use `--body`; details in the `supabase-email-alerts` skill and global CLAUDE.md.
- Changes to `app/src/lib/tco.ts` do **not** propagate to garage's vendored copy — re-sync by hand and note it in both repos.
- Repo is **public** (MIT-style LICENSE present). Env values / project ids never go in docs.

## 4. Details
### How it works
`app/` is a static SPA: a pure typed engine (`lib/tco.ts`) + `resolveVehicle` + a listings loader,
state in `state/useComparison.ts` (localStorage + compressed share link), charts and a results-first
layout. `rav4-alert/` is a set of Node scripts run by GitHub Actions: `cache-refresh.mjs` (Auto.dev →
Supabase `listings_cache`), `send-confirmations.mjs`, `alert-cron.mjs` (per-subscriber TCO-ranked
digest with xlsx attachment via Resend), plus `build-app-listings.mjs` for the app snapshot and
`preview-email.mjs` / `lifecycle-test.mjs` to verify without real sends. Supabase holds subscribers /
watchlists / listings_cache / sent_state with SECURITY DEFINER RPCs (`confirm_subscriber`,
`unsubscribe_all`, `start_subscription`) and the `send-confirmation` Edge Function.
```
app/            production SPA (src/lib/tco.ts · resolveVehicle.ts · listings.ts · data/reference.ts · components/ · state/)
rav4-alert/     Deal Alerts backend scripts + supabase/ (SQL) + its own README/RUN_LOG/review-findings
proxy/          legacy scraper (fallback)        prototype/   no-build clickable references
docs/           PRD.md · design/ARCHITECTURE.md · design/tco-model.md
.github/workflows/  deploy.yml · refresh-listings.yml · alerts.yml
.claude/        launch.json + static-server.js (local preview helpers)
```

### How to work on it
App: `cd app; npm install; npm run dev` · `npm test` · `npm run build`; push to `main` deploys only
if `app/**` changed. Backend: run scripts from `rav4-alert/` with env vars set (never commit them);
`preview-email.mjs` / `lifecycle-test.mjs` before touching the cron; workflow secrets via
`gh secret set NAME --body ...`. Snapshot refresh: run `refresh-listings.yml` manually (or
`build-applistings-from-cache.mjs` for a 0-API-call rebuild from the cache).

### Current state & open items
Comparator live; alerts POC live (daily 15:00 UTC digest). Open / blockers before monetizing:
Auto.dev commercial license · Stripe paywall · real cost data (Edmunds/AAA) · `EMAIL_MODE` →
new-only for quieter digests · 200-mi radius is wide · whether SE/XSE count as "XLE and above" ·
`deploy.yml` uses Node-20-era action versions (bump). Repo-local status: `rav4-alert/RUN_LOG.md`.

### Change highlights
- 2026-06-27 — big listings refresh moved monthly → annual (API budget).
- 2026-06 — Deal Alerts Phase 2 (double opt-in with instant confirmation, per-preference digest tables, xlsx attachment, re-subscribe RPC), Resend domain verified, twice-daily → daily cron.
- 2026-06 — "Load a real car" modal + Auto.dev-sourced snapshot replaces the Autotrader scrape; garage vendors the engine.
- 2026-06-15 — repo created; prototype → Vite/React/TS app; curve-based depreciation, share links, charts.

## 5. Pointers
- [README.md](README.md) — public product face: features, data model, automation table, repo structure, quick start.
- [docs/PRD.md](docs/PRD.md) · [docs/design/ARCHITECTURE.md](docs/design/ARCHITECTURE.md) · [docs/design/tco-model.md](docs/design/tco-model.md) (every formula).
- [rav4-alert/README.md](rav4-alert/README.md) · [rav4-alert/RUN_LOG.md](rav4-alert/RUN_LOG.md) · [rav4-alert/review-findings.md](rav4-alert/review-findings.md) — the alerts backend.
- [prototype/README.md](prototype/README.md) — the no-build reference UI.
- Memory: `car-tco-data-plan.md`, `rav4-alert-app.md` (operational config incl. ids that must not be in this public file). Skills: `supabase-email-alerts`, `web-data-snapshot`.
