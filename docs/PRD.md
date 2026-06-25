# Product Requirements — Car TCO Compare

**Status:** Consolidated v1.0 · **Owner:** xzhou · **Last updated:** 2026-06-18

> **The single, canonical PRD.** It consolidates the former `PRD.md` (core calculator) +
> `PRD-data-layer.md` (real-listings data layer) + the Deal-Alerts docs (`rav4-alert/PRD.md`,
> `PHASE2.md`, `STATE.md`, `DECISIONS.md`), which have been removed. Technical detail lives in
> [`design/ARCHITECTURE.md`](design/ARCHITECTURE.md) (system/data/backend) and
> [`design/tco-model.md`](design/tco-model.md) (every formula). The Deal-Alerts subproject keeps
> its own current operational guide at [`../rav4-alert/README.md`](../rav4-alert/README.md), and its
> open code-review items at [`../rav4-alert/review-findings.md`](../rav4-alert/review-findings.md).

---

## 1. What it is (today, live)

A **transparent, editable, side-by-side Total-Cost-of-Ownership calculator** for car buyers, live as a free static SPA on GitHub Pages (Vite + React + TS) with a pure, unit-tested engine. It has grown into **three pillars**:

1. **The calculator** — compare 1–6 vehicles on an Edmunds-style 7-line TCO under *your* holding period, mileage, region, and financing. Numbers are the hero; nothing is a black box; every input is editable.
2. **The real-listing data layer** — "Load a real car" pulls live listings (Toyota RAV4/Hybrid, Toyota Highlander/Hybrid, Honda CR-V/Hybrid; 2020+; ~1,600 cars) from the **Auto.dev API**, normalizes them to a snapshot shipped with the build, and drops a real car into a comparison with price/mileage/year/efficiency prefilled.
3. **Deal alerts** — an email backend (Supabase + Resend + GitHub Actions cron) where a visitor signs up (double opt-in, instant confirmation) with up to 3 multi-select preferences and gets a daily, TCO-ranked digest of matching cars.

A project by **XuSpark** (xuspark.com). License today: **PolyForm Noncommercial 1.0.0** (source-available; commercial rights reserved by the owner).

## 2. Problem & motivation

Buyers anchor on the wrong number — **sticker price** or **monthly payment** — when the decision that matters is **TCO**: net cost from purchase to resale (depreciation, financing interest, fuel/energy, insurance, maintenance, out-of-warranty repairs, taxes & fees, minus incentives). A car $8k cheaper up front can cost *more* to own.

Two questions buyers can't easily answer today:
1. **New vs. Used** — is the new-car depreciation hit worth the warranty/lower repair risk vs. used (someone else ate depreciation, you take repair risk)?
2. **Car A vs. Car B** — over *my* holding period and *my* miles, which is genuinely cheaper to own?

Existing calculators (Edmunds TCO, KBB 5-Year Cost to Own) are black boxes, locked to specific trims, not editable, and won't put arbitrary vehicles side by side under your assumptions.

## 3. Users & use cases

| Persona | Need |
|---|---|
| **Pragmatic shopper** (primary) | "Should I buy this 3-yr-old CPO or a new one?" → filters used compact SUVs under $30k, compares the best three |
| **Two-finalists buyer** | "RAV4 Hybrid vs. CR-V Hybrid for 7 years — which is cheaper to live with?" → drops both real listings, compares *their* prices |
| **EV-curious buyer** | "Does EV fuel savings offset higher price + depreciation?" |
| **Long-hold owner** | "I keep cars 10 yr / 150k mi — does that flip the answer?" |
| **Hands-off hunter** | "Email me when a matching deal hits the market." → Deal Alerts |
| **Skeptic** | "Where did $1,600 insurance come from?" → sees the segment source, edits it |

## 4. Goals & non-goals

**Goals**
- Compare **1–6 vehicles** (any mix of new/used, gas/hybrid/EV); a single car works as a standalone TCO.
- **Shared assumptions** (holding period, annual miles, tax, fuel/electricity, financing, region) for an apples-to-apples view.
- Override **every** cost input per vehicle — no hidden math.
- **Load real cars** with believable, sourced, segment-based ownership-cost defaults.
- Clear **winner / per-car total / cost-per-year / cost-per-mile**, plus a cost breakdown and a per-year cumulative view.
- Save cars locally; share a comparison via a compact link.
- Hands-off **deal alerts** by email.

**Non-goals (current)**
- Live per-keystroke listing search in the hosted app (snapshot is scheduled, not per-request).
- Lease vs. buy modeling (fast-follow).
- Cloud accounts / multi-user sync for the calculator (local-browser save only; the alert backend has its own subscriber store).
- Cars.com / CarGurus / Carfax / private-party data, paid unblockers.
- More than 6 vehicles at once.

## 5. Functional requirements

### 5.1 Shared assumptions
Holding years (def 5) · annual miles (def 12,000) · sales tax (def 9%) · fuel $/gal (def 6.00) · electricity $/kWh (def 0.35) · registration $/yr (def 200) · financing (global toggle, **New vs Used brackets**: down %, APR, term) · region overlay (fuel/elec/tax/registration/insurance multiplier).

### 5.2 Per-vehicle inputs
Name · condition (new/used/CPO) · purchase price · powertrain (gas/hybrid/EV) · efficiency (MPG or mi/kWh) · **model year** (age derived) · odometer at purchase · resale value (auto-seeded from the retention curve, editable) · `annualDepRate` (scales the curve) · annual insurance · annual maintenance (tires folded in) · warranty years/miles (suppress repairs while in force) · annual repairs (out of warranty) · incentives.

### 5.3 Real-listing data layer
- "Load a real car" modal: filter by make/model, **year**, segment, condition, fuel type, max price, region → "add to compare" populates a card via `resolveVehicle()` and the existing slot, with imported fields tagged **sourced** until edited.
- A "listings as of \<date\>" note; graceful fallback to bundled presets if the snapshot is missing.
- `resolveVehicle(listing, region, tables) → Vehicle` is pure and unit-tested; leaves `resaleValue: null` so the engine seeds it.

### 5.4 Outputs
Total TCO · cost/year · cost/mile · **winner banner** (cheapest, above the cards) · **cost breakdown** (vertical stacked column per car, 7 components, interactive tooltips) · **cumulative cost over time** (per-year, recovers resale at sale, interactive crosshair). All recompute live.

### 5.5 Deal alerts
- Subscribe form (email + up to 3 named multi-select preferences: make / model / trim / fuel type; min/max price; RAV4-only "XLE and above").
- **Double opt-in** (instant confirmation email via Supabase Edge Function → Resend, idempotent) + unsubscribe + idempotent re-subscribe.
- Daily cron: refresh the listings cache (Auto.dev → Supabase), filter per watchlist, compute TCO (a faithful mirror of the app engine), rank, diff vs. sent-state, email **new** matches only — a brief per-preference table + a detailed XLSX/CSV sheet.
- **API calls scale with models × regions, not users** (cache filled once; each user is a DB filter).

### 5.6 Honesty / liability (cross-cutting)
- Listings are best-effort snapshots — "verify against the live listing before buying."
- Cost assumptions are illustrative segment estimates — "verify against real quotes." Every default is a heuristic, labeled, dated, and editable. No false precision; no asserted authority.

## 6. The TCO model (summary)

`TotalTCO = Depreciation + Financing + Fuel/Energy + Insurance + Maintenance + Repairs + Taxes & fees − Incentives`. Depreciation uses an age-based **value-retention curve** (RAV4-anchored), driven by model year + holding period, scaled per car by `annualDepRate`. Financing counts only interest paid during the hold, split New/Used. Repairs are zero under warranty, then flat — the explicit new-vs-used risk premium. **Full methodology and every formula:** [`design/tco-model.md`](design/tco-model.md). The Deal-Alerts digest uses a JS mirror ([`../rav4-alert/tco.mjs`](../rav4-alert/tco.mjs)) kept in sync.

## 7. Data: two sets

| | **Set 1 — Listings** | **Set 2 — Assumptions** |
|---|---|---|
| What | price, mileage, year, make/model/trim, VIN, segment, powertrain, mpg | depreciation/insurance/maintenance/repair **rates** + region table + incentives |
| Source | **Auto.dev API** (free tier, 1,000 calls/mo) | curated; **currently illustrative placeholders** pending Edmunds TCO / AAA sourcing |
| Granularity | one specific car | a segment × powertrain (+ region) |
| Cadence | monthly snapshot (app) + daily cache (alerts) | static, refreshed ~yearly |
| Lives | `app/public/data/listings.json` (ships with build) | `app/src/data/reference.ts` (bundled) |

**Join key = `segment`** (a listing self-classifies from body style + fuel type). The legacy free Autotrader scraper in `proxy/` is kept only as a fallback; Auto.dev is the live source. **Commercial redistribution of Auto.dev data requires a license** (see §10).

## 8. Current status

- ✅ **Calculator** — production app live on Pages; pure typed engine + Vitest suite (42 tests).
- ✅ **Data layer** — Set-2 tables + `resolveVehicle`, Auto.dev pull → `listings.json` (~1,600 cars, 3 models, monthly Action), browse/import UI.
- ✅ **Deal alerts** — Supabase schema + RPCs, daily cron, Resend on a **verified** domain (`alerts@send.xuspark.com`), instant double-opt-in confirmation (Edge Function), idempotent re-subscribe, digest + confirmation emails, branding. (Per [`../rav4-alert/README.md`](../rav4-alert/README.md); confirm the Supabase SQL — `schema.sql` → `phase2b.sql` → `phase3-resubscribe.sql` — has actually been applied in your project.)
- 🔭 **Set-2 data sourcing** — tables are still illustrative placeholders (the credibility ceiling for any paid product).
- 🔭 **Open hardening items** — see [`../rav4-alert/review-findings.md`](../rav4-alert/review-findings.md): the M1/M2/M4 + RLS must-fixes were applied; S1–S7 / N1–N6 + a latent RLS note remain open.

## 9. Commercialization (new)

> See the strategy memo for the ranked plans and step-by-steps. This section freezes the **constraints any commercial path must clear**, so they aren't rediscovered later.

1. **Auto.dev licensing is the gate.** The free tier is for noncommercial use. Any path that *charges users while redistributing Auto.dev listings* (subscription, B2B with embedded inventory) needs a **commercial license** — confirm terms and price before charging. A pure-referral/affiliate model that monetizes *intent* (not data resale) largely sidesteps this.
2. **"Illustrative placeholder" cost tables are a liability once money changes hands.** A free tool can caveat them; a paid product cannot. Source Set 2 from **Edmunds True Cost to Own / AAA Your Driving Costs / EPA / EIA** before charging for the ranking.
3. **Traffic is the real bottleneck, not the monetization mechanic.** A Pages tool with no audience earns ~$0 from any model. The first commercial experiment must be cheap and must confront demand/traffic directly.
4. **Relicense deliberately.** Owner holds all commercial rights (PolyForm Noncommercial). To commercialize, dual-license or fork a private commercial build; decide the posture before launch.
5. **Liability/disclosure.** Charging for car-buying guidance raises the bar on disclaimers, data accuracy, and the "Est." discipline. Affiliate/insurance referrals carry **FTC disclosure** obligations.

**Monetization candidates (ranked):** (1) affiliate/intent layer on the free tool [cheapest, fastest to validate]; (2) freemium Deal-Alerts subscription [recurring, leans on built infra]; (3) B2B white-label engine / TCO API [highest ceiling, slowest]. Treated as a **ladder**, not either/or.

## 10. Roadmap

| Phase | Scope |
|---|---|
| **Done** | No-build prototype → production calculator → real-listing data layer → deal-alerts backend |
| **Activate** | Run the double opt-in SQL; finish live confirm/unsubscribe verification |
| **Commercialize v0 (test waters)** | Affiliate/intent layer + analytics + a small traffic experiment (see strategy) |
| **Commercialize v1** | If signal: source Set-2 data, broaden inventory, Auto.dev commercial license, Stripe + freemium alerts |
| **Later** | Lease vs. buy, opportunity-cost toggle, PDF/CSV export, B2B widget/API, segment-specific depreciation curves |

## 11. Risks

| Risk | Mitigation |
|---|---|
| Garbage-in/garbage-out; false precision | Good defaults, ranges, tooltips; show the breakdown; encourage flexing hold/miles |
| Depreciation is the hardest, biggest line | Transparent overridable curve; segment-specific curves later |
| Auto.dev ToS / commercial license | Stay in free tier for the free tool; license before charging; referral model sidesteps resale |
| Snapshot/cache staleness | Show `generatedAt`; scheduled refresh; app still works if stale |
| Narrow inventory (3 models) | Fine as a niche wedge; breadth is the gating unlock for a paid alert product |
| No audience yet | The first commercial step is a cheap traffic + intent test, not a build |

## 12. Open questions

1. Snapshot/inventory breadth — keep curated popular models (like-for-like), or widen to more models/segments for a paid alert product?
2. Region grain — states vs. ~9 census regions.
3. Commercial license posture — dual-license vs. private commercial fork.
4. Which monetization rung to climb first, and the traffic plan behind it.
