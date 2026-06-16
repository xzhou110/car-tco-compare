# Car TCO Compare — production app

Vite + React + TypeScript implementation of the TCO comparison tool. The calculation
engine is a pure, typed, unit-tested module ported from the validated prototype.

## Scripts

```bash
npm install      # install deps (Node 18+)
npm run dev      # dev server (Vite)
npm test         # Vitest engine unit suite
npm run build    # tsc --noEmit type-check + production bundle to dist/
npm run preview  # serve the production build
```

## Features

- Compare **2–6 cars** — add/remove, each with its own slot color.
- **7-line Edmunds-style TCO**: depreciation, financing, fuel/energy, insurance, maintenance, repairs, taxes & fees (minus incentives).
- **Warranty-aware repairs** — repairs are $0 while a car is within its age *and* mileage warranty, then kick in.
- **Per-condition financing** (separate new vs. used brackets; down payment as % of price).
- **Auto-save** to `localStorage` + **shareable URL** (state encoded in the hash) — close it and pick up later, or send a link.
- Per-car **presets** and **saved cars**.
- Category breakdown + cumulative-cost chart (starts at purchase price, recovers resale at sale).
- Progressive disclosure, responsive layout, reduced-motion support, PWA manifest.

## Architecture

```
src/
  lib/tco.ts          pure calculation engine  ← single source of truth for the math
  lib/tco.test.ts     Vitest unit tests
  lib/format.ts       currency / number formatters
  data/presets.ts     sample vehicles, defaults, slot colors
  types.ts            domain types
  state/useComparison.ts   state hook (localStorage + URL hash + profiles)
  components/         AssumptionsBar, VehicleCard, ResultsSummary, CategoryBreakdown, CumulativeChart, Field
  App.tsx · main.tsx
```

The engine has **no DOM dependency**, so it's tested in isolation and could be reused
server-side. See [`../docs/design/tco-model.md`](../docs/design/tco-model.md) for the formulas
and [`../docs/design/ui-handoff.md`](../docs/design/ui-handoff.md) for design tokens.

> All built-in numbers are illustrative heuristics — verify depreciation, incentives,
> insurance, and APRs against live sources before relying on a result.
