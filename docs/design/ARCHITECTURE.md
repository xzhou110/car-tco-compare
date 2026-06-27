# Architecture — Car TCO Compare

**Status:** Consolidated v1.0 · **Last updated:** 2026-06-18

> **The single, canonical design/architecture doc.** It consolidates the former `DESIGN.md`
> (app architecture, data model, UX, components), `data-architecture.md` (real-data flow),
> `segment-model.md` (Set-2 tables + `resolveVehicle`), and `ui-handoff.md` (design tokens +
> UI patterns), which have been removed. The full calculation methodology stays in its own
> focused doc: [`tco-model.md`](tco-model.md) (every formula). Product scope: [`../PRD.md`](../PRD.md).

---

## 1. System overview

Two cooperating pieces, both free-tier:

```
  ┌─────────────────────────────────────────────┐      ┌──────────────────────────────┐
  │  Static SPA  (GitHub Pages)                  │      │  Deal-Alerts backend          │
  │  Vite + React + TS, client-only, no backend  │      │  Supabase + GH Actions + Resend│
  │  • pure TCO engine (tco.ts)                  │      │  • subscribers + watchlists    │
  │  • resolveVehicle() join                     │      │  • listings_cache (model×region)│
  │  • localStorage + shareable-link state       │      │  • daily cron → digest          │
  │  • fetches listings.json snapshot at runtime │◀────▶│  • double opt-in via Edge Fn    │
  └─────────────────────────────────────────────┘      └──────────────────────────────┘
            ▲ snapshot shipped in build                     ▲ Auto.dev → cache (scales w/ models×regions)
            └──────────── Auto.dev API ──────────────────────┘
```

The deployed site is **100% static** — the only server-side component is the alert backend's cron, which runs on GitHub Actions and writes to Supabase.

## 2. Two-stage build (deliberate)

- **Stage 0 — Prototype (`prototype/`)** — zero build, vanilla HTML/CSS/JS ES modules; runs by opening the file. Goal: get the *model* and *UX* in front of the user fast and cheap. Kept as the clickable design reference.
- **Stage 1 — Production (`app/`)** — Vite + React + TypeScript SPA; component-driven, typed model, **pure unit-tested engine**; state in localStorage + a compressed shareable link.

**The key decision:** the calculation engine is a **pure function** (no DOM, no I/O). It makes the model testable, keeps math and pixels separate, and ported prototype→production unchanged in spirit.

## 3. App architecture

```
        UI layer  (AssumptionsBar · VehicleCard×1–6 · ResultsSummary · CategoryBreakdown · CumulativeChart)
            │ inputs (plain objects)
        Calculation engine (pure)   computeTco(vehicle, assumptions) → TcoResult
            │
        Data: reference tables (Set 2) + listings snapshot (Set 1) + presets fallback
```

**Component layout (`app/src/`):**
```
main.tsx · App.tsx
state/useComparison.ts        assumptions + vehicles[], localStorage + shareable-link sync
lib/tco.ts                    pure engine            (+ tco.test.ts)
lib/depreciation.ts           value-retention curve  (+ depreciation.test.ts)
lib/resolveVehicle.ts         listing+tables→Vehicle (+ resolveVehicle.test.ts)
lib/listings.ts               load + filter snapshot (+ listings.test.ts)
lib/format.ts                 currency/number/percent
data/reference.ts             Set-2 segment×powertrain + region + incentives
data/presets.ts               sample vehicles / fallback seed
components/                   ListingModal, AssumptionsBar, VehicleCard, LoadMenu, Field,
                             ResultsSummary, CategoryBreakdown, CumulativeChart, ChartTooltip,
                             HowItWorks, AlertsModal, ConfirmPage, UnsubscribePage, MultiSelect
```

**Calculation flow:** edit input → recompute → `computeTco` per vehicle → find cheapest → render summary, stacked-column breakdown, cumulative lines. Resale auto-seeds from the curve until the user overrides it.

## 4. Data model

```
Assumptions { holdingYears, annualMiles, salesTaxRate, fuelPricePerGallon,
              electricityPricePerKWh, registrationAnnual,
              financing:{ new:{downPct,apr,termYears}, used:{...} }, region }

Vehicle     { id, name, condition:'new'|'used'|'cpo', purchasePrice,
              powertrain:'gas'|'hybrid'|'ev', mpg | miPerKWh,
              modelYear, odometerAtPurchase,        // age derived = currentYear − modelYear
              resaleValue,        // editable; auto-seeded from retention curve if blank
              annualDepRate,      // scales the curve loss (depFactor = rate / 0.16)
              insuranceAnnual, maintenanceAnnual,   // maintenance includes tires
              warrantyYears, warrantyMiles, repairAnnual, incentives }

TcoResult   { total, perYear, perMile,
              byCategory:{ depreciation, financingInterest, energy, insurance,
                           maintenance, repairs, taxesAndFees, incentives },
              cumulative:number[] }   // length holdingYears+1, for the crossover chart

Listing     { source, url, vin, year, make, model, trim, price, mileage,
              condition:'new'|'used', segment, powertrain, mpg,
              bodyStyle, fuelType, dealer, location, fetchedAt }
```

## 5. Data-layer architecture (Set 1 — listings)

**The decision that shaped everything (historical):** free scraping of retail sites works from a *residential* IP and is blocked from datacenter IPs — so a cloud Action can't scrape. The answer was a **static snapshot** generated locally, committed, and shipped in the build. **Today the live source is the Auto.dev API** (clean, licensable, no IP games); the `proxy/` Autotrader scraper is kept only as a fallback, and the snapshot model still holds:

```
  Auto.dev API ──pull──▶ build-app-listings.mjs ──normalize/dedupe by VIN──▶ app/public/data/listings.json
                                                                                     │ vite copies public/→dist/
                                                                          GitHub Pages ships it
                                                                                     │ runtime fetch (lazy)
                                                                          resolveVehicle() → computeTco()
```

- `base: './'` → the app fetches `${BASE_URL}data/listings.json`; missing/blocked snapshot → falls back to presets, core compare never breaks.
- **Two stores, two cadences:** the app snapshot refreshes **annually** (`refresh-listings.yml`, + manual on-demand); the alert cache refreshes **daily** in Supabase (`alerts.yml`). Both stay well inside Auto.dev's free 1,000-calls/mo tier (RAV4-only daily + one ~100-call full pull once a year ≈ <150/mo).

## 6. Segment assumption model (Set 2)

Slow-changing, curated cost rates keyed by **`segment × powertrain`**, plus a **region** table and an **incentives** table — replacing per-car guesses with sourced, segment-keyed defaults that stay rough, transparent, and editable.

- **~10 segments:** `car-economy`, `car-midsize`, `car-luxury`, `car-sport`, `suv-compact`, `suv-midsize`, `suv-large`, `luxury-suv`, `truck`, `minivan`. A listing self-classifies from body style + fuel type — no VIN decode.
- **Rate row →** `annualDepRate` (scales the retention curve), `insurance` (× region multiplier), `maintenance` (incl. tires), `repair` (out of warranty), `warrantyYears/Miles`, with `byPowertrain` overrides (hybrid/EV).
- **Region row →** fuel $/gal, electricity $/kWh, sales tax, registration $/yr, insurance multiplier. Fallback chain: state → national → factory default.
- **`resolveVehicle(src, region, tables) → Vehicle`** — pure, unit-tested: start from the listing (price, mileage→odometer, year→modelYear, powertrain), look up rates, apply region insurance multiplier, leave `resaleValue: null` for the engine to seed, return a fully-editable `Vehicle`.

> ⚠️ **All Set-2 numbers are currently illustrative placeholders** (`source: 'Illustrative placeholders (Edmunds TCO + AAA pending)'`). Each table carries `source` + `asOf`; one global "assumptions as of \<date\>" line is shown. **Sourcing these is the prerequisite for any paid product** (see PRD §9).

## 7. Deal-alerts backend architecture

```
                ┌─ daily cron (GitHub Actions, alerts.yml) ────────────────┐
 Auto.dev ─pull▶ │ refresh listings_cache (tiles: model × region)          │
                │ expire_stale_listings()  [sold-car cleanup]              │
                │ for each active watchlist:                               │
                │   filter cache (zip radius via haversine, price, trim…)  │
                │   compute TCO (tco.mjs mirror) → rank                     │
                │   diff vs sent_state → NEW only → Resend → record state   │
                └──────────────────────────────────────────────────────────┘
 Static app ─anon key▶ Supabase: insert subscriber + watchlist; double opt-in confirm email
```

- **Stack:** Supabase (Postgres + RLS + SECURITY DEFINER RPCs + Edge Function), GitHub Actions cron, Resend (verified domain `send.xuspark.com`), Stripe (future paywall).
- **Key property:** API calls scale with **models × regions**, not users — the cache is filled once; each user is a DB filter (0 API calls per user).
- **Double opt-in:** anon insert (RLS `with check (confirmed=false)`), instant confirmation email via Edge Function → Resend (idempotent so the cron fallback never double-sends), `confirm_subscriber` + `unsubscribe_all` RPCs, idempotent re-subscribe. *(Activation requires running `rav4-alert/supabase/phase2b.sql` once.)*
- **Schema/SQL:** `rav4-alert/supabase/{schema.sql, phase2b.sql, phase3-resubscribe.sql}`; functions in `rav4-alert/supabase/functions/send-confirmation/`.

## 8. UI / design language

**Tokens (CSS vars, theme-aware; `:root[data-theme="dark"]` override):**

| Token | Value | Use |
|---|---|---|
| `--ink` / `--muted` / `--faint` | `#14202c` / `#5f6b78` / `#707c8a` | text tiers (≥4.5:1 on white) |
| `--line` / `--surface` / `--surface-2` | `#e6eaef` / `#fff` / `#f7f9fc` | borders / cards / insets |
| `--accent` / `--good` | `#2f6fed→#2459c8` / `#16a34a` | actions, focus / "cheapest" |
| radius / shadow | 14·9px / `0 2px 6px /.06`, `0 12px 28px /.07` | cards, controls / elevation |
| Slot colors (×6) | teal · amber · indigo · rose · green · violet | per-vehicle identity everywhere |
| Category colors (×7) | dep `#4f6bed` · fin `#e0851e` · energy `#16a34a` · ins `#d6457f` · maint `#0f9b8e` · repair `#8b5cf6` · taxes `#64748b` | fixed per cost component |

System font stack; **tabular numerals** on all money; hero total ~27px/800; soft dual radial-gradient background.

**Patterns & layout rules:**
- **Answer-first ordering** — results (winner banner + summary + charts) sit at the **top**, then shared assumptions, then car inputs, then "How it works." There's always a result on load (defaults/persisted state).
- **Vehicle card** — colored top border (slot color); `Car` + `Energy` always visible; `Depreciation` + `Running costs` collapsed `<details>` (values stay mounted and feed the calc even when collapsed).
- **Winner banner** above the summary cards, tinted with the winner's slot color; cheapest summary card gets a green ring + ribbon; rank chips #1–#6.
- **Cost breakdown** — one vertical stacked column per car (taller = costs more), 7 components stacked bottom-to-top in fixed order/color, legend at bottom, horizontal scroll when many cars; hover a segment → value + %-of-total tooltip.
- **Cumulative chart** — inline SVG, per-slot gradient fill, dashed gridlines; hover snaps a crosshair to the nearest year and lists every car's running total. Both charts share `ChartTooltip` (edge-flipping, pointer/touch aware). **No chart library** — hand-rolled HTML bars + inline SVG.
- Recompute live on every change; powertrain selector toggles MPG ⇄ mi/kWh.

**Accessibility:** text ≥4.5:1; visible focus ring on every control; ≥44px touch targets; charts not color-only (text legend + values); `prefers-reduced-motion` honored.

## 9. Automation (GitHub Actions)

| Workflow | Trigger | Does |
|---|---|---|
| `deploy.yml` | push to `main` touching `app/**` (+ manual) | Build the Vite app → publish to Pages |
| `refresh-listings.yml` | cron Jan 1 16:00 UTC (+ manual) | Rebuild `listings.json` (3 models, Auto.dev), commit, **self-deploy** (a `GITHUB_TOKEN` commit can't trigger `deploy.yml`) |
| `alerts.yml` | cron 15:00 UTC (+ manual) | Refresh alert cache, send confirmations, send each subscriber their TCO-ranked digest |
| `pages-build-deployment` | every Pages deploy | GitHub-managed last-mile publish |

## 10. Testing strategy

- **Unit** — every formula in `tco.ts`/`depreciation.ts` against hand-computed fixtures; `resolveVehicle` and `listings` filters (Vitest, 42 tests).
- **Property** — monotonicity (more miles ⇒ more energy; longer hold ⇒ more maintenance).
- **Snapshot** — full preset comparisons catch regressions.
- **Edge** — 0% APR, cash, EV, warranty boundary year, resale clamps, divide-by-zero guards.

## 11. Tech decisions & rationale

| Decision | Why |
|---|---|
| No-build prototype first | Fastest path to clickable feedback before investing in tooling |
| Pure engine, separate from UI | Testable, portable, keeps math honest |
| Vite + React + TS | Modern, typed, great for form-heavy reactive UIs |
| Inline SVG charts (no lib) | Zero deps, full control, small surface |
| localStorage + compressed shareable link | Shareable comparisons with no backend; clean address bar |
| Static snapshot for listings | Free, no server; the app site never makes a live API call |
| Auto.dev as live source (over scraping) | Clean, licensable, no residential-IP dependency; scraper kept as fallback |
| Alerts cache keyed by model×region | API cost scales with catalog, not users |

## 12. Appendix

- **Full calculation methodology:** [`tco-model.md`](tco-model.md)
- **Product scope & commercialization constraints:** [`../PRD.md`](../PRD.md)
