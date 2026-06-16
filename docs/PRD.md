# Product Requirements Document — Car TCO Compare

**Status:** Draft v0.2 (for review)
**Owner:** xzhou
**Last updated:** 2026-06-15

> **v0.2 changes (from prototype review):**
> - **Simplified to Edmunds-style 7 lines** — Depreciation, Financing, Fuel/energy, Insurance, Maintenance, Repairs, Taxes & fees. Dropped small one-time fees (doc/title/initial reg) and separate tire inputs (tires fold into Maintenance). Rough estimates, no precision chase.
> - **Compare 2–6 cars** (was 2): start at 2, **+ Add** up to 6, each removable.
> - **Save/load car profiles** to the browser (localStorage) by nickname.
> - **Financing split into New vs Used brackets** (different down% / APR / term); **down payment is a % of price**, not a dollar amount.
> - **Cumulative chart starts at the purchase price** and recovers resale at sale.

---

## 1. Problem & Motivation

Most car buyers anchor on the wrong number: **sticker price** or **monthly payment**.
The decision that actually matters is **Total Cost of Ownership (TCO)** — what the car
costs you, net, from the day you buy it to the day you sell it.

A car that is $8,000 cheaper up front can easily be *more* expensive to own once you
account for depreciation, financing interest, fuel/charging, insurance, maintenance,
out-of-warranty repairs, tires, and resale value. The two questions buyers can't easily
answer today:

1. **New vs. Used** — Is taking the depreciation hit on a new car worth the warranty
   coverage and lower repair risk, versus buying used where someone else ate the
   depreciation but you take on repair risk?
2. **Car A vs. Car B** — Across two specific vehicles, which is genuinely cheaper to own
   over *my* holding period and *my* annual mileage?

There are scattered calculators online (Edmunds True Cost to Own, KBB 5-Year Cost to
Own), but they are black boxes, US-market-locked to specific trims, not editable, and
don't let you put two arbitrary vehicles side by side with **your own assumptions**.

## 2. Goal

A transparent, editable, side-by-side TCO calculator where the user can:

- Compare **2 to 6 vehicles** at once (any mix of new/used, gas/hybrid/EV).
- Set **shared ownership assumptions** (holding period, annual miles, tax rate, fuel/energy prices, financing).
- Override **every cost input** per vehicle — nothing is a hidden black box.
- **Save cars** and reload them later (browser storage).
- See a clear **winner (cheapest), per-car total, cost/year, and cost/mile**, plus a **cost breakdown** and a **per-year cumulative cost** view.

### Non-goals (v1)

- Live market pricing / VIN decode / Carfax integration (manual entry first; APIs later).
- Lease vs. buy modeling (buy/finance only in v1; lease is a fast-follow).
- Cloud accounts / multi-user sync (local-browser save only in v1).
- More than 6 vehicles at once.

## 3. Target Users & Use Cases

| Persona | Need |
|---|---|
| **Pragmatic shopper** (primary) | "Should I buy this 3-year-old CPO or a new one?" |
| **Two-finalists buyer** | "RAV4 Hybrid vs. CR-V Hybrid — which is cheaper to live with for 7 years?" |
| **EV-curious buyer** | "Does the fuel savings on an EV offset the higher purchase price and depreciation?" |
| **Long-hold owner** | "I keep cars 10 years / 150k miles — does that change the answer?" |

## 4. User Stories

1. As a buyer, I can pick two preset vehicles and immediately see a TCO comparison, so I get value in <10 seconds.
2. As a buyer, I can edit any number (price, MPG, insurance, resale, APR…) and watch the result update live.
3. As a buyer, I can change the **holding period** and **annual miles** and see how the winner flips.
4. As a buyer, I can see **where the money goes** (depreciation vs. fuel vs. maintenance…) so I understand *why* one wins.
5. As a buyer, I can model **financing** (down payment, APR, term) or pay cash, and see interest cost separately.
6. As a buyer, I can compare a **gas car vs. an EV/hybrid** with the right energy math (MPG vs. mi/kWh).
7. As a buyer, I can reset to defaults or clear and start over.

## 5. Functional Requirements

### 5.1 Shared assumptions (apply to every vehicle)
- Holding period (years) — default 5
- Annual miles driven — default 12,000
- Sales tax rate (%) — applied to purchase price
- Fuel price ($/gal) and electricity price ($/kWh)
- Financing: pay cash toggle; if financing → down payment, APR, loan term

### 5.2 Per-vehicle inputs
- Label / nickname, and a New / Used / CPO tag
- Purchase price
- Powertrain type: Gas / Hybrid / EV
- Efficiency: MPG (gas/hybrid) **or** mi/kWh (EV)
- Vehicle age at purchase (years) and odometer at purchase
- Estimated resale value at end of holding period (auto-estimated, user-editable)
- Annual insurance premium
- Annual maintenance (base) + how fast it grows with age
- Warranty remaining (years / miles) — suppresses repair cost while in force
- Annual repair estimate once out of warranty
- Tire set cost + tire life (miles)
- One-time fees (doc, title, registration) + annual registration
- Incentives / rebates / tax credits (reduces TCO)

### 5.3 Outputs
- **Total TCO** for each vehicle over the holding period
- **Cost per year** and **cost per mile**
- **Winner banner** (above the cards) naming the cheapest car + its total
- **Cost breakdown** (depreciation, financing, fuel/energy, insurance, maintenance, repairs, taxes & fees) as a **vertical stacked column per car** — taller = costs more, components stacked bottom-to-top in a fixed order/color, category legend at the bottom
- **Cumulative cost over time** (per-year line/area), so the user sees crossover points
- Net price drivers called out (e.g., "Depreciation is 47% of the gap")

### 5.4 Behaviors
- All results recompute **live** on any input change.
- "Reset to preset" and "Load preset" actions.
- Sensible defaults so the tool is useful before the user touches anything.
- Input validation (no negative prices, MPG > 0, etc.) with inline hints.

## 6. The TCO Model (summary)

Full methodology and formulas live in [`docs/design/tco-model.md`](design/tco-model.md).
At a glance, **Total TCO =**

```
  Depreciation            (purchase price − resale value)
+ Financing interest      (interest paid during holding period)
+ Energy                  (fuel or electricity over all miles)
+ Insurance               (annual premium × years)
+ Maintenance             (base, growing with vehicle age)
+ Repairs                 (0 while under warranty; grows after)
+ Tires                   (sets needed over miles driven)
+ Taxes & fees            (sales tax + doc/title + annual registration)
− Incentives              (rebates / tax credits)
```

**Key insight the tool must make obvious:** new cars usually win on
maintenance/repairs/warranty but lose on depreciation; used cars usually win on
depreciation but lose on repair risk. The crossover depends on holding period and miles.

## 7. UX Requirements

- Single screen, no navigation needed for the core flow.
- Two columns (Vehicle A | Vehicle B) for inputs; results span full width below.
- Mobile-friendly (columns stack).
- Clarity over density: group inputs into collapsible sections (Purchase, Energy, Ownership, Financing).
- Every assumption visible and editable — reinforce "no black box."
- Light/neutral, finance-tool aesthetic; the *numbers* are the hero.

## 8. Success Metrics

- A user can produce a meaningful comparison in **< 30 seconds** from load.
- User can articulate **why** one car wins after using it (breakdown is understood).
- (Qualitative for v1) Reviewer feedback: "I'd trust this to make a real decision."

## 9. Assumptions & Open Questions

- **A:** Manual input is acceptable for v1; users tolerate entering ~10 numbers per car. *(Validate with you.)*
- **A:** US-centric defaults (USD, gallons, miles) are fine for v1.
- **Q:** Should we model **opportunity cost** of the down payment / cash (cost of capital)? *(Default: optional toggle, off.)*
- **Q:** Lease modeling priority — fast-follow or v1? *(Currently fast-follow.)*
- **Q:** Do we want preset library curated by us, or fully blank/manual? *(v1: small curated preset library + full manual edit.)*

## 10. Roadmap

| Phase | Scope |
|---|---|
| **v0 (this prototype)** | No-build clickable HTML prototype: 2-up compare, full model, presets, breakdown + cumulative chart. For UX/model feedback. |
| **v1** | Production app (Vite + React + TS): same scope, polished, validated, shareable URL state, save/load locally. |
| **v1.x** | Lease vs. buy, opportunity cost toggle, N-vehicle compare, export to PDF/CSV. |
| **v2** | Data assists: depreciation curves by segment, MPG/insurance lookups, optional VIN/market-price APIs (flagged as live data needing verification). |

## 11. Risks

- **Garbage-in/garbage-out:** bad assumptions → wrong conclusion. Mitigate with good defaults, ranges, and tooltips explaining each input.
- **False precision:** a single TCO number implies certainty. Mitigate by showing the breakdown and encouraging users to flex holding period / miles.
- **Depreciation is the hardest input** to estimate and the biggest TCO line. Mitigate with a transparent default curve the user can override, and (later) segment-based data.
