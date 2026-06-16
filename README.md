# car-tco-compare

Compare **Total Cost of Ownership (TCO)** across new, used, and multiple cars —
purchase, depreciation, financing, insurance, fuel/charging, maintenance, repairs,
taxes & fees, and resale. Put **up to 6 vehicles** side by side under *your* holding
period and mileage, and see the real cost of ownership — not just the sticker price.

> ⚠️ All built-in numbers are **illustrative heuristics**. Depreciation, incentives,
> insurance, and APRs change constantly and must be verified against live sources
> before relying on a result for a real purchase.

## Status

**Production app built** (Vite + React + TypeScript) in [`app/`](app/), with a typed,
unit-tested calculation engine. The original no-build [`prototype/`](prototype/) remains
as the design reference.

## Repo structure

```
car-tco-compare/
├── README.md                  ← you are here
├── docs/
│   ├── PRD.md                 ← product requirements (problem, scope, roadmap)
│   └── design/
│       ├── DESIGN.md          ← architecture, data model, UX, component plan
│       ├── tco-model.md       ← exact calculation methodology (every formula)
│       └── ui-handoff.md      ← design tokens + engineering handoff notes
├── prototype/                 ← no-build clickable sample (vanilla HTML/CSS/JS)
│   ├── index.html             ← double-click to open
│   ├── css/styles.css
│   └── js/{data,tco,app}.js
└── app/                       ← PRODUCTION app (Vite + React + TS)
    ├── src/
    │   ├── lib/tco.ts         ← pure, typed calculation engine
    │   ├── lib/tco.test.ts    ← Vitest unit suite (12 tests)
    │   ├── data/presets.ts    ← sample vehicles + defaults
    │   ├── state/useComparison.ts  ← state + localStorage + URL-share
    │   ├── components/        ← AssumptionsBar, VehicleCard, results, charts
    │   └── App.tsx
    └── package.json
```

## Quick start

**Production app** (needs Node 18+):
```powershell
cd app
npm install
npm run dev      # start the dev server
npm test         # run the engine unit tests
npm run build    # type-check + production bundle
```

**Prototype** (no build — just open it):
```powershell
start prototype\index.html
```

Either way: load presets, edit numbers, flip the holding period, add cars, and watch the
comparison update.

## Read next

- **What we're building & why:** [`docs/PRD.md`](docs/PRD.md)
- **How it's built:** [`docs/design/DESIGN.md`](docs/design/DESIGN.md)
- **How every dollar is computed:** [`docs/design/tco-model.md`](docs/design/tco-model.md)
- **Run the prototype:** [`prototype/README.md`](prototype/README.md)

## License

**© 2026 xzhou110. All rights reserved. Proprietary — see [LICENSE](LICENSE).**

This is a **commercial product in development**, kept source-visible for now — it is **not**
open source. No permission is granted to use, copy, modify, deploy, or distribute it. The
owner retains all rights, including the right to commercialize. (Proprietary is the right
choice here: an open-source license would let others use your code; you can always relax to
a permissive license later, but not the reverse.) Contact the owner for licensing inquiries.
