# car-tco-compare

Compare **Total Cost of Ownership (TCO)** across new, used, and multiple cars —
purchase, depreciation, financing, insurance, fuel/charging, maintenance, repairs,
taxes & fees, and resale. Put **up to 6 vehicles** side by side under *your* holding
period and mileage, and see the real cost of ownership — not just the sticker price.

> ⚠️ All built-in numbers are **illustrative heuristics**. Depreciation, incentives,
> insurance, and APRs change constantly and must be verified against live sources
> before relying on a result for a real purchase.

## Status

Pre-build: **PRD + design approved-pending-review**, plus a **clickable prototype** for feedback.

## Repo structure

```
car-tco-compare/
├── README.md                  ← you are here
├── docs/
│   ├── PRD.md                 ← product requirements (problem, scope, roadmap)
│   └── design/
│       ├── DESIGN.md          ← architecture, data model, UX, component plan
│       └── tco-model.md       ← exact calculation methodology (every formula)
└── prototype/                 ← no-build clickable sample (vanilla HTML/CSS/JS)
    ├── index.html             ← double-click to open
    ├── css/styles.css
    └── js/{data,tco,app}.js
```

The production app (Vite + React + TypeScript) will live in `src/` once the design is
signed off — see the roadmap in [`docs/PRD.md`](docs/PRD.md).

## Quick start

```powershell
# open the prototype
start prototype\index.html
```

Then load presets, edit numbers, flip the holding period, and watch the comparison update.

## Read next

- **What we're building & why:** [`docs/PRD.md`](docs/PRD.md)
- **How it's built:** [`docs/design/DESIGN.md`](docs/design/DESIGN.md)
- **How every dollar is computed:** [`docs/design/tco-model.md`](docs/design/tco-model.md)
- **Run the prototype:** [`prototype/README.md`](prototype/README.md)
