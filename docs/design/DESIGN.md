# App Design — Car TCO Compare

**Status:** Draft v0.2
**Last updated:** 2026-06-15

> **v0.2 deltas:** model simplified to 7 Edmunds-style lines (see `tco-model.md`);
> vehicles are now an **array of 2–6** (not fixed A/B); **save/load profiles** via
> `localStorage`; **financing has New/Used brackets** with **down-payment %**; cumulative
> chart starts at purchase price. Data model and UX below updated accordingly.
>
> **v0.3 (built):** the production app is implemented in [`../../app/`](../../app/)
> (Vite + React + TS). The engine lives at `app/src/lib/tco.ts` with a Vitest suite;
> state (localStorage + shareable URL hash) in `app/src/state/useComparison.ts`.
> Where this doc says `src/`, read `app/src/`.

Companion to [`../PRD.md`](../PRD.md) and [`tco-model.md`](tco-model.md). Covers
architecture, data model, UX layout, and the path from prototype → production.

---

## 1. Architecture overview

Two stages, deliberately:

### Stage 0 — Prototype (this repo, `prototype/`)
- **Zero build, zero dependencies.** Plain HTML + CSS + vanilla JS (ES modules).
- Runs by **double-clicking `prototype/index.html`** (or a tiny static server).
- Goal: get the *model* and *UX* in front of you fast, iterate on feedback cheaply.
- Throwaway-friendly — we validate, then rebuild clean.

### Stage 1 — Production (`src/`, added after design sign-off)
- **Vite + React + TypeScript** SPA. Component-driven, typed model, unit-tested engine.
- State in URL (shareable comparisons) + `localStorage` (save/restore).
- Same calculation engine, ported to typed `src/lib/tco.ts` with a Vitest suite.

```
                 ┌────────────────────────────────────────┐
                 │              UI layer                   │
                 │  Assumptions bar · Vehicle A · Vehicle B │
                 │  Results: summary · breakdown · chart   │
                 └───────────────┬────────────────────────┘
                                 │ inputs (plain objects)
                 ┌───────────────▼────────────────────────┐
                 │        Calculation engine (pure)        │
                 │  computeTco(vehicle, assumptions)       │
                 │  → { total, perYear, perMile, byCategory,│
                 │      cumulative[] }                      │
                 └───────────────┬────────────────────────┘
                                 │
                 ┌───────────────▼────────────────────────┐
                 │      Preset data (sample vehicles)      │
                 └────────────────────────────────────────┘
```

The engine is a **pure function** — no DOM, no I/O. This is the key design decision: it
makes the model testable, portable from prototype to production unchanged in spirit, and
keeps "math" and "pixels" cleanly separated.

---

## 2. Data model

### `Assumptions` (shared)
```
{
  holdingYears, annualMiles, salesTaxRate,
  fuelPricePerGallon, electricityPricePerKWh,
  financing: { enabled, downPayment, apr, termYears },
  opportunityCost: { enabled, discountRate }
}
```

### `Vehicle`
```
{
  id, name, condition: 'new' | 'used' | 'cpo',
  purchasePrice,
  powertrain: 'gas' | 'hybrid' | 'ev',
  mpg,                 // gas/hybrid
  miPerKWh,            // ev
  modelYear, odometerAtPurchase,   // age "now" is derived from modelYear (currentYear − modelYear)
  resaleValue,         // editable; auto-seeded from the retention curve if blank
  annualDepRate,       // scales the retention curve's loss (depFactor = rate / 0.16)
  insuranceAnnual,
  maintenanceBase, maintenanceGrowth,
  warrantyYears, warrantyMiles, repairBase, repairGrowth,
  tireSetCost, tireLifeMiles,
  docFee, titleFee, registrationInitial, registrationAnnual,
  incentives
}
```

### `TcoResult` (engine output)
```
{
  total, perYear, perMile,
  byCategory: { depreciation, financingInterest, energy, insurance,
                maintenance, repairs, tires, taxesAndFees, incentives },
  cumulative: number[]   // length holdingYears + 1, for the crossover chart
}
```

---

## 3. UX layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Car TCO Compare            [ Load preset ▾ ]  [ Reset ]              │
├─────────────────────────────────────────────────────────────────────┤
│  SHARED ASSUMPTIONS                                                   │
│  Hold: [5] yrs   Miles/yr: [12,000]   Tax: [7]%   Fuel $[3.75]/gal   │
│  Elec $[0.16]/kWh    ◉ Cash  ◯ Finance → Down[ ] APR[ ]% Term[ ]yr   │
├──────────────────────────────────┬──────────────────────────────────┤
│  VEHICLE A         [preset ▾]     │  VEHICLE B         [preset ▾]     │
│  ── Purchase ──────────────────   │  ── Purchase ──────────────────   │
│  Name, condition, price           │  Name, condition, price           │
│  ── Energy ────────────────────   │  ── Energy ────────────────────   │
│  Powertrain, MPG / mi·kWh         │  Powertrain, MPG / mi·kWh         │
│  ── Ownership ─────────────────   │  ── Ownership ─────────────────   │
│  age, odo, resale, insurance,     │  age, odo, resale, insurance,     │
│  maint, warranty, repairs, tires  │  maint, warranty, repairs, tires  │
│  ── Fees & incentives ─────────   │  ── Fees & incentives ─────────   │
├──────────────────────────────────┴──────────────────────────────────┤
│  RESULTS                                                              │
│  ┌── Vehicle A ──┐   ┌── Vehicle B ──┐    🏆 B is $4,210 cheaper      │
│  │ $38,450 total │   │ $34,240 total │       ($702/yr · 5.9¢/mi less) │
│  │ $7,690 / yr   │   │ $6,848 / yr   │                                │
│  │ 64.1¢ / mile  │   │ 57.1¢ / mile  │                                │
│  └───────────────┘   └───────────────┘                               │
│                                                                       │
│  COST BREAKDOWN — one VERTICAL stacked column per car (taller=more)  │
│    $44.5k   $37.7k                                                   │
│    ▓▓ ▓▓    ← taxes / repairs / maint / insurance / energy (upward)  │
│    ██ ██    ← depreciation (bottom)                                  │
│    [ legend of components at the bottom ]                            │
│                                                                       │
│  CUMULATIVE COST OVER TIME (two lines, shows crossover year)         │
│  $ ▁▂▃▅▆▇  A                                                          │
│    ▁▂▃▄▅▆  B                                                          │
└─────────────────────────────────────────────────────────────────────┘
```

### Layout rules
- **Answer-first ordering:** Results (summary + winner + charts) sit at the **top**, then
  Shared assumptions, then the car inputs, then "How it works". The verdict is the product,
  and defaults/persisted state mean there's always a result to show on load.
- **Shared assumptions** sit above the car inputs (they drive every car).
- **Car inputs** are a responsive grid of 1–6 cards; fields collapse to one column when narrow.
- **Cost breakdown** = vertical stacked columns (taller = costs more), components stacked
  bottom-to-top in a fixed order/color; **category legend at the bottom**, consistent with
  the cumulative chart. Scrolls horizontally within its panel when many cars don't fit.
- **Both charts are interactive on hover** (mouse + touch via pointer events): the breakdown
  shows a per-segment value + %-of-total tooltip; the cumulative chart snaps a crosshair to the
  nearest year and lists every car's running total there. Tooltips share `ChartTooltip` and stay
  on-screen by flipping near edges. No chart library — hand-rolled HTML bars + inline SVG.
- Recompute live on every change. Powertrain selector toggles the efficiency field (MPG ⇄ mi/kWh).

### Visual language
- Neutral, finance-tool aesthetic; white/light surface, one accent color per vehicle
  (A = teal, B = amber) used consistently in inputs, bars, and lines.
- Numbers are the hero — large, tabular figures for the three headline metrics.
- Charts are dependency-free **inline SVG** (bars + lines) in the prototype.

---

## 4. Component breakdown (production / `src/`)

```
src/
  main.tsx
  App.tsx
  state/                 useComparison() hook — assumptions + 2 vehicles, URL/localStorage sync
  lib/
    tco.ts               pure engine (port of prototype/js/tco.js)
    tco.test.ts          Vitest unit tests for every formula + edge cases
    format.ts            currency / number / percent formatters
  data/
    presets.ts           curated sample vehicles
  components/
    AssumptionsBar.tsx
    VehicleCard.tsx       (rendered per car, 1–6)
    LoadMenu.tsx          load preset/saved car + inline delete of saved
    Field.tsx             labeled inputs
    ResultsSummary.tsx    headline metrics + winner badge
    CategoryBreakdown.tsx vertical stacked columns per car (legend at bottom); hover segment → value + % tooltip
    CumulativeChart.tsx   crossover line chart; hover → nearest-year crosshair + per-car running-total tooltip
    ChartTooltip.tsx      shared cursor-following tooltip overlay (edge-flipping, pointer/touch aware)
    HowItWorks.tsx        plain-language methodology
```

The prototype mirrors this structure informally:
`js/data.js` (presets), `js/tco.js` (engine), `js/app.js` (UI wiring).

---

## 5. Calculation flow

1. User edits any input → debounced `recompute()`.
2. For each vehicle: `computeTco(vehicle, assumptions)` → `TcoResult`.
3. Find the cheapest (lowest TotalTCO) → winner banner names it + its total.
4. Render: summary metrics, vertical stacked-column breakdown (one per car), cumulative lines.
5. Resale auto-seed: if the user hasn't manually overridden `resaleValue`, recompute the
   default from the depreciation curve whenever price/age/miles change; once edited, respect the override.

---

## 6. Edge cases & validation

- MPG / mi·kWh must be > 0 (guard divide-by-zero).
- Resale value clamped to `[0, purchasePrice]`.
- APR 0% handled (no amortization blow-up).
- Loan term shorter/longer than holding period both handled (see model §2).
- Negative inputs rejected with inline hints.
- EV selected → hide MPG, show mi/kWh, use electricity price; gas/hybrid → inverse.

---

## 7. Testing strategy (production)

- **Unit:** every formula in `tco.ts` with known-good fixtures (hand-computed).
- **Property:** more miles ⇒ more energy; longer hold ⇒ more maintenance; etc. (monotonicity).
- **Snapshot:** a couple of full preset comparisons to catch regressions.
- **Edge:** 0% APR, cash, EV, warranty boundary year, resale clamps.

---

## 8. Tech decisions & rationale

| Decision | Why |
|---|---|
| No-build prototype first | Fastest path to clickable feedback; validate model before investing in tooling. |
| Pure engine, separate from UI | Testable, portable prototype→prod, keeps math honest. |
| Vite + React + TS for prod | Modern, fast, typed; great for form-heavy reactive UIs. |
| Inline SVG charts (no chart lib) | Zero deps in prototype; full control; small surface area. |
| URL + localStorage state | Shareable comparisons without a backend. |
| Manual data entry in v1 | Avoids brittle scraping/API dependencies; data assists come in v2 with verification flags. |

---

## 9. Open design questions (for your review)

1. **Resale default visibility** — show the auto-estimate inline with a "✎ override" affordance, or a separate "estimate" vs "my number" field? *(Proposed: single field, auto-seeded, editable.)*
2. **How many preset cars** to curate, and which segments? *(Proposed: ~6 covering new/used, gas/hybrid/EV, economy/SUV.)*
3. **Chart priority** — is the cumulative crossover chart worth the space, or is the category breakdown enough for v1? *(Proposed: keep both.)*
4. **Opportunity cost** — expose the toggle in v1 or hide until v1.x? *(Proposed: hidden/advanced.)*
