# car-tco-compare

Compare **Total Cost of Ownership (TCO)** across new, used, and multiple cars —
purchase, depreciation, financing, insurance, fuel/charging, maintenance, repairs,
taxes & fees, and resale. Put **up to 6 vehicles** side by side under *your* holding
period and mileage, and see the real cost of ownership — not just the sticker price.

### 🚗 [Open the live app →](https://xzhou110.github.io/car-tco-compare/)

Runs in your browser — no install, no sign-up. A project by **[XuSpark](https://xuspark.com)**.

> ⚠️ **Listings** (price, mileage, year) are a *best-effort* snapshot scraped from
> public listings — verify against the live listing before buying. **Cost assumptions**
> (insurance, maintenance, repairs, depreciation) are *illustrative segment estimates* you
> can edit; verify against real quotes before relying on a result.

## Status

**Production app live on GitHub Pages** (Vite + React + TypeScript) in [`app/`](app/), with a
typed, unit-tested engine. A **real-listing data layer** ships with it: you can **load real
cars** (Toyota RAV4, Toyota Highlander, Honda CR-V; 2020+) straight into the comparison. The
no-build [`prototype/`](prototype/) remains as the design reference.

## Features

- **Load a real car** — a header button opens a modal of **real listings** (price, mileage,
  year, trim) you can filter (make/model, **year**, segment, condition, fuel type, max price)
  and drop into the comparison. Every imported field stays editable. (A region selector sets
  which regional cost assumptions apply.)
- **Deal alerts** — sign up (double opt-in, instant confirmation email) with up to 3 multi-select
  preferences (make / model / trim / fuel type) and get a twice-daily, TCO-ranked digest of
  matching cars. See [`rav4-alert/`](rav4-alert/).
- **Compare 1–6 cars** side by side — start with one, add/remove freely, each with its own name and color.
- **Edmunds-style 7-line TCO**: depreciation, financing, fuel/energy, insurance, maintenance, repairs, taxes & fees (minus incentives).
- **Curve-based depreciation** — resale auto-estimates from a **value-retention-by-age curve** (anchored to the Toyota RAV4 curve), driven by each car's **model year** and your holding period; override per car anytime.
- **Shared assumptions** (holding years, annual miles, tax, fuel/electricity price, financing) for an apples-to-apples comparison — and **save your own defaults**.
- **Per-condition financing** — separate New vs Used down-payment %, APR, and term.
- **Presets + saved cars** — load a built-in preset or a car you saved; **delete saved cars inline**.
- **Results-first layout** — the verdict (ranked summary with total, $/yr, ¢/mi, and the winner) sits at the top, above the inputs.
- **Cost breakdown** — a vertical stacked column per car, plus a cumulative-cost-over-time chart. Both are **interactive**: hover a breakdown segment to see its exact dollar value and share of the car's total spend, or hover the cumulative chart to snap a crosshair to the nearest year and read every car's running total at that point.
- **Light / dark theme**, **auto-save** to your browser, and a **Share** button that builds a compact, compressed link encoding the whole comparison (the address bar stays clean — state lives in localStorage, not the URL).

## How the data works (two sets)

The app stays a **static, free, client-only SPA** — no backend in production.

- **Set 1 — Listings (real, auto-refreshed):** [`build-app-listings.mjs`](rav4-alert/build-app-listings.mjs)
  pulls the curated models (Toyota RAV4 / Highlander, Honda CR-V — gas + hybrid, 2020+) from the
  **Auto.dev API**, normalizes them, and writes [`app/public/data/listings.json`](app/public/data/listings.json).
  Vite copies `public/` into the build, so the snapshot ships to GitHub Pages and the app fetches it
  at runtime (lazy-loaded when you open "Load a real car"). A **weekly GitHub Action**
  ([`refresh-listings.yml`](.github/workflows/refresh-listings.yml)) re-runs the pull, commits the
  snapshot, and redeploys — so the data stays fresh hands-free. (A separate twice-daily
  [Deal Alerts cron](rav4-alert/) keeps its own RAV4 alert cache in Supabase current.)
- **Set 2 — Assumptions (curated, stable):** segment × powertrain cost-rate tables plus a
  region table ([`app/src/data/reference.ts`](app/src/data/reference.ts)). A pure, unit-tested
  [`resolveVehicle()`](app/src/lib/resolveVehicle.ts) joins a listing to its segment estimates
  to fill a full vehicle for the engine — which is left untouched.

> Listings come from the **Auto.dev API** (free tier for now); commercial redistribution needs a license. The legacy Autotrader scraper in [`proxy/`](proxy/) is kept only as a fallback.

## Automation (GitHub Actions)

Four workflows show up under the repo's **Actions** tab. Three are ours (YAML in
[`.github/workflows/`](.github/workflows/)); the fourth is GitHub-managed.

| Workflow | File | Trigger | What it does |
|---|---|---|---|
| **Deploy app to GitHub Pages** | [`deploy.yml`](.github/workflows/deploy.yml) | push to `main` touching `app/**` (+ manual) | Builds the Vite/React app and publishes it to GitHub Pages. The main app deploy. |
| **Refresh listings snapshot (weekly)** | [`refresh-listings.yml`](.github/workflows/refresh-listings.yml) | cron **Mon 16:00 UTC** (8am PT) (+ manual) | Rebuilds the "Load a real car" snapshot ([`listings.json`](app/public/data/listings.json)) for all 3 models from Auto.dev, commits it, **and builds + deploys Pages itself** (a bot-token commit can't trigger `deploy.yml`). |
| **Deal Alerts** | [`alerts.yml`](.github/workflows/alerts.yml) | cron **15:00 + 21:00 UTC** (8am + 2pm PT) (+ manual) | The email backend: refreshes the RAV4 alert cache (Auto.dev → Supabase), sends double-opt-in confirmation emails, then sends each subscriber their TCO-ranked digest. See [`rav4-alert/`](rav4-alert/). |
| **pages-build-deployment** | _(none — GitHub-managed)_ | every Pages deployment | GitHub's own "last-mile" job that actually publishes the uploaded Pages artifact. It appears automatically once Pages is enabled and runs after `deploy.yml` / `refresh-listings.yml` upload the build — you don't author or edit it. |

**Why two deploy paths?** `deploy.yml` handles ordinary code pushes; `refresh-listings.yml`
self-deploys because the snapshot commit it pushes is made with `GITHUB_TOKEN`, and
token-made pushes deliberately **don't** trigger other workflows (loop protection). Both end
by handing an artifact to `pages-build-deployment`. The two Auto.dev crons stay inside the
free 1,000-calls/mo tier (RAV4-only twice daily + one ~100-call full pull weekly ≈ <600/mo).

## Repo structure

```
car-tco-compare/
├── README.md                       ← you are here
├── docs/
│   ├── PRD.md                      ← product requirements (problem, scope, roadmap)
│   ├── PRD-data-layer.md           ← v2 data layer: real listings + segment assumptions
│   └── design/
│       ├── DESIGN.md               ← architecture, data model, UX, component plan
│       ├── tco-model.md            ← exact calculation methodology (every formula)
│       ├── data-architecture.md    ← how real data flows in (snapshot + scraper)
│       ├── segment-model.md        ← segment×powertrain tables + resolveVehicle spec
│       └── ui-handoff.md           ← design tokens + engineering handoff notes
├── proxy/                          ← free Autotrader scraper (Node — run locally)
│   ├── scrape.js                   ← shared scrape + normalize core
│   ├── snapshot.js                 ← writes app/public/data/listings.json
│   └── server.js                   ← optional local live-search proxy (dev only)
├── prototype/                      ← no-build clickable references (vanilla HTML/CSS/JS)
│   ├── index.html                  ← the original TCO tool
│   └── app-integrated.html         ← "Load a real car" integration prototype
└── app/                            ← PRODUCTION app (Vite + React + TS)
    ├── public/data/listings.json   ← real-listing snapshot (ships to Pages)
    ├── src/
    │   ├── lib/tco.ts              ← pure, typed calculation engine
    │   ├── lib/resolveVehicle.ts   ← listing + segment tables → Vehicle (pure)
    │   ├── lib/listings.ts         ← load + filter the snapshot
    │   ├── lib/*.test.ts           ← Vitest unit suites (42 tests)
    │   ├── data/reference.ts       ← segment×powertrain + region tables
    │   ├── data/presets.ts         ← sample vehicles + defaults
    │   ├── components/             ← ListingModal, AssumptionsBar, VehicleCard, charts
    │   ├── state/useComparison.ts  ← state + localStorage + URL-share
    │   └── App.tsx
    └── package.json
```

## Quick start

**Production app** (needs Node 18+):
```powershell
cd app
npm install
npm run dev      # start the dev server
npm test         # run the unit tests (42)
npm run build    # type-check + production bundle
```

**Refresh the real-listing snapshot** (run from the repo root, on your own machine):
```powershell
node proxy/snapshot.js                          # regenerate app/public/data/listings.json
git add app/public/data/listings.json
git commit -m "Refresh listings snapshot"
git push                                         # the deploy Action republishes Pages
```

**Prototype** (no build — just open it):
```powershell
start prototype\index.html            # original tool
start prototype\app-integrated.html   # with the "Load a real car" modal
```

## Read next

- **What we're building & why:** [`docs/PRD.md`](docs/PRD.md) · data layer: [`docs/PRD-data-layer.md`](docs/PRD-data-layer.md)
- **How it's built:** [`docs/design/DESIGN.md`](docs/design/DESIGN.md) · data: [`docs/design/data-architecture.md`](docs/design/data-architecture.md)
- **How every dollar is computed:** [`docs/design/tco-model.md`](docs/design/tco-model.md) · assumptions: [`docs/design/segment-model.md`](docs/design/segment-model.md)
- **Run the prototype:** [`prototype/README.md`](prototype/README.md)

## License

**© 2026 xzhou110 — [PolyForm Noncommercial License 1.0.0](LICENSE).**

This project is **source-available for noncommercial use**. You're welcome to view, run,
study, modify, and share it for any **noncommercial** purpose (personal projects, research,
education, evaluation) — please keep the copyright notice intact.

**Commercial use is reserved.** The copyright holder retains all commercial rights, including
the right to build and sell a commercial product based on this work. If you'd like to use it
commercially, contact the owner for a commercial license.

> Note: because it restricts commercial use, this is technically a *source-available*
> license rather than an OSI-approved *open source* one — the trade-off that lets the code
> stay public while commercialization stays with the owner.
