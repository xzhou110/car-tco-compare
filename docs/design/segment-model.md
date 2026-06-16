# Design — Segment Assumption Model (Set 2)

**Status:** Draft v0.1 (for review)
**Last updated:** 2026-06-16
**Companion to:** [`../PRD-data-layer.md`](../PRD-data-layer.md), [`data-architecture.md`](data-architecture.md)

Single source of truth for **Set 2** — the slow-changing, curated cost assumptions. These
tables replace the hard-coded per-car guesses in
[`../../app/src/data/presets.ts`](../../app/src/data/presets.ts) with sourced, segment-keyed
defaults that remain **rough, transparent, and user-editable** (consistent with
[`tco-model.md`](tco-model.md)'s "no false precision" stance).

> All numbers below are **illustrative placeholders** pending sourcing from Edmunds True
> Cost to Own + AAA "Your Driving Costs". Each table ships with `source` + `asOf`.

---

## 1. Keys

- **`segment`** — body/size class (the join key with a scraped listing's decoded body class).
- **`powertrain`** — `gas | hybrid | ev` (already in the `Vehicle` type; modifies the rates).
- **`region`** — US state (fallback: national) for the location-varying inputs.

Cost rates are keyed by **`segment × powertrain`**. Location inputs are keyed by **`region`**.

## 2. Segment taxonomy (proposed ~10)

| key | label | examples |
|---|---|---|
| `car-economy` | Economy car | Corolla, Civic |
| `car-midsize` | Midsize car | Camry, Accord |
| `car-luxury` | Luxury / sport sedan | 3-Series, A4 |
| `suv-compact` | Compact SUV | RAV4, CR-V |
| `suv-midsize` | Midsize SUV | Highlander, Pilot |
| `suv-large` | Large SUV | Tahoe, Telluride |
| `truck` | Pickup truck | F-150, Tacoma |
| `minivan` | Minivan | Sienna, Odyssey |
| `car-sport` | Sports/performance | Mustang, GR86 |
| `luxury-suv` | Luxury SUV | X5, GLE |

An Autotrader listing's `bodyStyles` + `bodyStyleSubType` (+ price) map onto these directly
(e.g. "Sport Utility" / "Midsize" → `suv-midsize`) — so a scraped listing self-classifies, no
VIN decode needed. Mapping lives in `proxy/scrape.js` (`segmentFor`) and the resolver.

## 3. Cost-rate table — `segment × powertrain`

Fields per row (feed the matching `Vehicle` fields):

| field | feeds `Vehicle.` | notes |
|---|---|---|
| `annualDepRate` | `annualDepRate` | seeds resale via existing `seedResaleValue` |
| `insuranceAnnual` | `insuranceAnnual` | base; × region `insuranceMultiplier` |
| `maintenanceAnnual` | `maintenanceAnnual` | includes tires (per model doc) |
| `repairAnnual` | `repairAnnual` | applies once out of warranty |
| `warrantyYears` / `warrantyMiles` | same | typical for the segment/brand-tier |

Illustrative slice (placeholders):

| segment | powertrain | depRate | insurance | maint | repair | warrYr/Mi |
|---|---|---|---|---|---|---|
| suv-compact | gas | 0.16 | 1550 | 700 | 500 | 3 / 36k |
| suv-compact | hybrid | 0.16 | 1600 | 700 | 500 | 3 / 36k |
| car-economy | gas | 0.15 | 1400 | 550 | 400 | 3 / 36k |
| car-luxury | gas | 0.14 | 1900 | 1600 | 1200 | 4 / 50k |
| car-midsize | ev | 0.18 | 2100 | 500 | 500 | 4 / 50k |

> "Used" cars use a lower `depRate` (the first-year cliff is already behind them) — apply the
> same `condition`-based default the engine already encodes (0.12 used vs 0.16 new) unless the
> segment row overrides it.

## 4. Region table — `region`

| field | feeds `Assumptions.` | source |
|---|---|---|
| `fuelPricePerGallon` | same | EIA |
| `electricityPricePerKWh` | same | EIA |
| `salesTaxRate` | same | state tables |
| `registrationAnnual` | same | state DMV |
| `insuranceMultiplier` | (multiplies segment insurance) | AAA / state averages |

Fallback chain: requested state → national average → current factory default.

## 5. Incentives table

`incentives[ model-or-segment ][ region ] → { amount, kind, asOf, expires? }` — EV credits /
rebates. Feeds `Vehicle.incentives` (subtracted in the engine). Flagged "verify" — most
volatile of Set 2.

## 6. `resolveVehicle` — the pure function

```ts
function resolveVehicle(
  src: ListingPick,            // from a scraped Listing OR a manual segment pick
  region: RegionDefaults,
  tables: ReferenceTables,
): Vehicle
```
Rules:
1. Start from `src` (price, mileage→odometer, year→age, powertrain, name).
2. Look up `tables.rates[segment][powertrain]` → insurance/maint/repair/depRate/warranty.
3. Apply `region.insuranceMultiplier` to insurance.
4. Leave `resaleValue: null` → existing `seedResaleValue` computes it.
5. Return a complete `Vehicle`; **nothing hidden** — every field is now editable in the card.

`region` also overlays the location inputs onto `Assumptions` (fuel/elec/tax/registration).

**This module is pure and unit-tested** (Vitest), same discipline as the engine: given a
segment + region, assert the produced `Vehicle` fields. It's the highest-leverage Set-2 piece.

## 7. Files (production)

```
app/src/data/reference/
  segments.ts        // taxonomy + bodyClass→segment mapping
  rates.ts           // segment × powertrain cost rates (+ source/asOf)
  regions.ts         // region table (+ source/asOf)
  incentives.ts      // incentives table (+ source/asOf)
app/src/lib/
  resolveVehicle.ts       // the pure resolver
  resolveVehicle.test.ts  // Vitest
```
`presets.ts` shrinks to a tiny fallback seed; the rich data moves into `reference/`.

## 8. Provenance (minimal, per decision)

One global "assumptions as of \<date\>" line sourced from the newest `asOf` across tables.
No per-field badges for Set 2 (that's reserved for Set 1's live listings).

## 9. Open questions

1. Taxonomy grain — 10 segments enough, or split further (e.g. compact vs subcompact)?
2. Region grain — 51 states vs ~9 census regions for v2.0?
3. Do `depRate`s come per-segment, or keep the engine's new/used default and only override
   outliers (luxury, EV)? *(Proposed: override outliers only — less to curate.)*