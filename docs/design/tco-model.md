# TCO Calculation Methodology

**Status:** Draft v0.3 (retention-curve depreciation)
**Last updated:** 2026-06-18

Single source of truth for the production calculation engine
([`app/src/lib/tco.ts`](../../app/src/lib/tco.ts) + [`depreciation.ts`](../../app/src/lib/depreciation.ts)).
The model is deliberately **rough and transparent** — big estimates, no false precision, every
input user-overridable.

> v0.3: depreciation moved from a flat declining-balance rate to an age-based **value-retention
> curve** (RAV4-anchored); the per-car "Age now" input became **Model year** (age is now derived);
> defaults refreshed (sales tax 9%, fuel $6.00/gal, electricity $0.35/kWh, new-car APR 5%).

> v0.2 simplified from v0.1 per review: dropped small one-time fees (doc/title/initial
> reg) and separate tire inputs (tires now folded into Maintenance); removed per-year
> growth multipliers (flat rough annuals); financing split into New vs Used brackets;
> cumulative chart now starts at the purchase price.

> Notation: `Y` = holding years, `M` = annual miles, `total miles = Y · M`.

## The 7 itemized lines (Edmunds-style)

```
TotalTCO = Depreciation + Financing + Fuel/Energy + Insurance
         + Maintenance + Repairs + Taxes & fees − Incentives
```

---

### 1. Depreciation — usually the largest line
```
Depreciation = PurchasePrice − ResaleValue
```
`ResaleValue` is editable; if blank we seed it from a **value-retention curve by age**
(`app/src/lib/depreciation.ts`) rather than a flat rate — a car drops fast early, then levels
off, which a flat `(1−rate)^Y` curve can't capture.

**The curve** (`RETENTION_BY_AGE`) is the fraction of original (age-0) value retained at each
whole-year age, anchored to the published **Toyota RAV4 depreciation curve** (a strong-
retention benchmark):

| age (yr) | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| retention | 100% | 86% | 83% | 80% | 77% | 72% | 69% | 57% | 53% | 52% | 49% |

Linear-interpolated between whole years; past age 10 it keeps declining gently to a salvage
floor (~12%).

**Resale is priced off the purchase point** — the price you paid already reflects the value
the car lost *before* you bought it, so we only count value lost from now until you sell:
```
ageNow   = currentYear − modelYear                 // auto-derived from the model year
saleAge  = ageNow + Y
depFactor = annualDepRate / 0.16                   // 0.16 = RAV4 benchmark ⇒ depFactor 1.0
ret(age) = max(0.10, 1 − depFactor · (1 − curve(age)))   // depFactor scales the LOSS
ResaleValue = PurchasePrice · ret(saleAge) / ret(ageNow)   (clamped [0, price], rounded $100)
```
So a **new** RAV4 (`ageNow 0`, `depFactor 1`) held 5 yr seeds resale ≈ 72% of price; a faster-
depreciating class (higher `annualDepRate` → `depFactor > 1`) loses proportionally more. Drive
the estimate with the **model year** and **holding period**; override `ResaleValue` per car for
an atypical vehicle. (Heuristic — the curve shape is RAV4-anchored; segment-specific curves are
a future data task.)

### 2. Financing — split by condition (New vs Used)
New and used loans differ a lot, so financing is **one global toggle with two brackets**.
Each car uses the bracket matching its `condition`. **Down payment is a % of price.**
```
bracket  = financing[condition]            // {downPct, apr, termYears}
downPay  = bracket.downPct · PurchasePrice
financed = PurchasePrice + SalesTax − downPay
```
Standard amortization; we count only **interest paid during the holding period**:
```
r = apr/12 ; n = termYears·12
payment = financed · r / (1 − (1+r)^−n)      // (r=0 → financed/n)
For m in 1..min(n, Y·12): interest += balance·r ; balance −= payment − interest_m
Financing = Σ interest
```
Loan outlasting ownership: remaining balance is settled at sale (captured via resale), not a cost.

### 3. Fuel / energy
```
Gas/Hybrid:  (totalMiles / MPG)      · FuelPricePerGallon
EV:          (totalMiles / MiPerKWh) · ElectricityPricePerKWh
```

### 4. Insurance
```
Insurance = AnnualPremium · Y          (flat)
```

### 5. Maintenance — flat rough annual, **includes tires**
```
Maintenance = MaintenanceAnnual · Y
```
Scheduled service + tires rolled into one rough number. (v0.1's age-growth curve was
dropped for simplicity; bump the annual figure for older cars if you want.)

### 6. Repairs — zero under warranty, then flat
```
For each year k in 0..Y−1:
   ageThatYear   = ageAtPurchase + k
   milesThatYear = odometerAtPurchase + (k+1)·M
   underWarranty = ageThatYear < warrantyYears AND milesThatYear < warrantyMiles
   repair_k      = underWarranty ? 0 : RepairAnnual
Repairs = Σ repair_k
```
This is the **used-car risk premium** and the **value of a warranty**, made explicit —
the core of the new-vs-used comparison.

### 7. Taxes & fees — simplified
```
Taxes & fees = PurchasePrice · SalesTaxRate + RegistrationAnnual · Y
```
Dropped: doc, title, initial registration (small, noisy). `RegistrationAnnual` is a single
rough shared assumption (not per-car).

### Incentives
```
Incentives = EV credit / rebate / etc.    (subtracted; FLAG as live data to verify)
```

---

## Derived metrics
```
CostPerYear = TotalTCO / Y
CostPerMile = TotalTCO / (Y · M)
Winner      = lowest TotalTCO (named in the banner with its total)
```

## Cumulative cost over time (chart)
Starts at the **purchase price** (cash committed for the asset), adds running costs each
year, and **recovers resale at sale** so the endpoint equals TotalTCO:
```
cumulative[0] = PurchasePrice + SalesTax − Incentives
for k in 1..Y:
   cumulative[k] = cumulative[k−1]
                 + Insurance + Energy/Y + Maintenance + RegistrationAnnual
                 + repair_k + interest_k
cumulative[Y] −= ResaleValue        // sell the car, recover its value (line dips at the end)
```
This makes the chart read like real cash flow: a big step up at purchase, a gradual climb,
then a drop when you sell. (Depreciation is captured implicitly by purchase-up-front minus
resale-recovered, so it is *not* added again as a yearly line.)

---

## Defaults (seed values — all user-editable)

| Parameter | Default |
|---|---|
| Holding period `Y` | 5 years |
| Annual miles `M` | 12,000 |
| Sales tax | 9.0% |
| Registration (est) | $200/yr |
| Fuel price | $6.00/gal |
| Electricity | $0.35/kWh |
| Depreciation | RAV4-anchored retention curve; `annualDepRate` 0.16 (new) / 0.12 (used) scales it |
| **Financing — New** | 10% down · 5.0% APR · 5 yr |
| **Financing — Used** | 15% down · 9.9% APR · 5 yr |

> **Source discipline:** every default is a heuristic starting point, not current market
> truth. Verify depreciation, incentives, insurance quotes, and APRs against live sources
> before acting on any result.
