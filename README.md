# car-tco-compare

Compare **Total Cost of Ownership (TCO)** across new, used, and multiple cars —
purchase, depreciation, financing, insurance, fuel/charging, maintenance, repairs,
taxes & fees, and resale. Put **up to 6 vehicles** side by side under *your* holding
period and mileage, and see the real cost of ownership — not just the sticker price.

### 🚗 [Open the live app →](https://xzhou110.github.io/car-tco-compare/)

Runs in your browser — no install, no sign-up.

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
  year, trim) you can filter (make/model, segment, condition, powertrain, price, region) and
  drop into the comparison. Every imported field stays editable.
- **Compare 1–6 cars** side by side — start with one, add/remove freely, each with its own name and color.
- **Edmunds-style 7-line TCO**: depreciation, financing, fuel/energy, insurance, maintenance, repairs, taxes & fees (minus incentives).
- **Shared assumptions** (holding years, annual miles, tax, fuel/electricity price, financing) for an apples-to-apples comparison — and **save your own defaults**.
- **Per-condition financing** — separate New vs Used down-payment %, APR, and term.
- **Presets + saved cars** — load a built-in preset or a car you saved; **delete saved cars inline**.
- **Results-first layout** — the verdict (ranked summary with total, $/yr, ¢/mi, and the winner) sits at the top, above the inputs.
- **Cost breakdown** — a vertical stacked column per car, plus a cumulative-cost-over-time chart. Both are **interactive**: hover a breakdown segment to see its exact dollar value and share of the car's total spend, or hover the cumulative chart to snap a crosshair to the nearest year and read every car's running total at that point.
- **Light / dark theme**, **auto-save** to your browser, and a **shareable URL** that encodes the whole comparison.

## How the data works (two sets)

The app stays a **static, free, client-only SPA** — no backend in production.

- **Set 1 — Listings (real, refreshed):** a generator scrapes Autotrader for the curated
  models, normalizes them, and writes [`app/public/data/listings.json`](app/public/data/listings.json).
  Vite copies `public/` into the build, so the snapshot ships to GitHub Pages and the app
  fetches it at runtime (lazy-loaded when you open "Load a real car"). The scrape runs **on
  your machine** (a residential IP — the only place the free scrape works reliably), so
  refreshing the data is just: re-run the generator → commit → push → the deploy Action
  republishes.
- **Set 2 — Assumptions (curated, stable):** segment × powertrain cost-rate tables plus a
  region table ([`app/src/data/reference.ts`](app/src/data/reference.ts)). A pure, unit-tested
  [`resolveVehicle()`](app/src/lib/resolveVehicle.ts) joins a listing to its segment estimates
  to fill a full vehicle for the engine — which is left untouched.

> The scraper is for **personal, low-volume** use and is subject to the source site's terms.

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
    │   ├── lib/*.test.ts           ← Vitest unit suites (26 tests)
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
npm test         # run the unit tests (26)
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
