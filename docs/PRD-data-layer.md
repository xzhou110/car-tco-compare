# PRD — Data Layer (v2: real listings + segment assumptions)

**Status:** Draft v0.3 (decisions settled; prototype in review)
**Owner:** xzhou
**Last updated:** 2026-06-16
**Parent:** extends [`PRD.md`](PRD.md) — this is the **v2 "Data assists"** roadmap line, specified.

> **v0.3 changes (what we actually validated):** dropped Bright Data / paid APIs (free
> only). Proved **Autotrader** is scrapable for free from a residential IP (Cars.com tarpits,
> CarGurus 403s). Chose the **static-snapshot** integration so the *already-deployed* Pages
> site shows real cars to every visitor with no server. A scraped Autotrader listing
> **self-classifies** into a segment (no VIN-decode round-trip needed).

> Design: [`design/data-architecture.md`](design/data-architecture.md) ·
> [`design/segment-model.md`](design/segment-model.md)

---

## 1. Problem

Every number in the app today is a **hand-entered illustrative heuristic**
([`data/presets.ts`](../app/src/data/presets.ts)). That's the credibility ceiling: a polished
tool over made-up numbers is a toy. Buyers want to compare *real cars for sale* with
*believable* ownership costs. Both need real data — the v2 the parent PRD deferred.

## 2. The two data sets

| | **Set 1 — Listings** | **Set 2 — Assumptions** |
|---|---|---|
| What | price, mileage, year, make/model/trim, VIN | depreciation, insurance, maintenance, repair **rates** |
| Source | **free scrape of Autotrader** (residential IP) | curated once from Edmunds / AAA |
| Granularity | one specific car | a **segment × powertrain** (+ region) |
| Cadence | refreshed on a schedule (snapshot) | static, refreshed ~yearly |
| Lives | `app/public/data/listings.json`, shipped with the build | bundled in `app/src/data/reference/` |

**Join key = `segment`.** An Autotrader listing already carries `bodyStyles` + `fuelType`, so
it self-classifies into a segment + powertrain — that segment indexes the Set 2 rates. The
listing supplies the car-specific facts; Set 2 supplies the typical ongoing costs; together
they fill a `Vehicle` for the unchanged engine.

## 3. Goals

1. Let a user **browse real listings** and drop one into a comparison card with price /
   mileage / year / efficiency prefilled — instead of typing.
2. Replace illustrative cost assumptions with **credible, sourced, segment-based defaults**
   that stay transparent and fully editable.
3. Make the **already-deployed Pages site** show real cars to **any visitor, no install**.
4. Preserve "no black box" — every data-sourced number is visible, editable, and dated.

### Non-goals (v2)

- Live per-keystroke search in the hosted app (the snapshot is refreshed on a schedule, not
  per request — see architecture for why: free scrape only works from a residential IP).
- A paid unblocker / API. Free-only for now.
- Cars.com / CarGurus (both hard-block free scraping) and private-party/Carfax.
- Changing the engine. [`computeTco`](../app/src/lib/tco.ts) stays untouched.

## 4. Users & use cases

| Persona | New capability |
|---|---|
| Two-finalists buyer | "Drop the real RAV4 and CR-V from the list and compare *their* prices." |
| Pragmatic shopper | "Filter used compact SUVs under $30k and compare the three best." |
| Skeptic | "Where did $1,600 insurance come from?" → sees segment source, edits it. |

## 5. Functional requirements

### 5.1 Set 2 — Segment assumptions (no infra)
- Segment taxonomy (~10) × powertrain rate table (`annualDepRate`, `insuranceAnnual`,
  `maintenanceAnnual`, `repairAnnual`, typical warranty); a region table (fuel, electricity,
  sales tax, registration, insurance multiplier); an incentives table. Each versioned
  (`source`, `asOf`).
- A pure, unit-tested **`resolveVehicle(listingOrPick, region, tables) → Vehicle`** that fills
  a card and leaves `resaleValue: null` so the engine's `seedResaleValue` runs.

### 5.2 Set 1 — Listings (snapshot)
- A **generator** scrapes Autotrader across a few metros, normalizes to one `Listing` shape,
  dedupes by VIN, and writes `app/public/data/listings.json` (runs on the user's machine;
  refresh = re-run → commit → push → Pages redeploys).
- The app **loads the snapshot** at runtime and offers a **browse/filter** UI (search text,
  segment, condition, powertrain, max price, region) → **"add to compare"** populates a card
  via `resolveVehicle` and the existing `loadVehicle()`/slot.
- A **"listings as of \<date\>"** note; graceful fallback to presets if the JSON is missing.

### 5.3 Honesty
- Imported fields are tagged sourced (Autotrader + snapshot date) until edited.
- Persistent note: scraped data is best-effort — verify against the live listing before buying.

## 6. Architecture summary (detail in design doc)

- **Static, free, no backend for the deployed site.** The snapshot JSON ships inside the
  Pages build (`vite` copies `public/` → `dist/`).
- **The scrape runs on the user's machine** (residential IP) on a schedule — because free
  scraping is blocked from datacenter IPs (Workers/Actions). It commits the JSON; the Action
  redeploys.
- **Optional local proxy** (`proxy/server.js`) gives *you* live on-demand search in dev; the
  deployed site uses the snapshot. Same normalized `Listing` either way.

## 7. Build order / status

1. ✅ Set 2 tables + `resolveVehicle` + live chain — **prototyped & verified**.
2. ✅ Free Autotrader scraper + **snapshot generator** → 240-listing `listings.json` — **done**.
3. ⏳ **Integration prototype** — browse/import listings inside the existing app's UX (this
   review).
4. ⏳ Port to production `app/` (typed `resolveVehicle.ts` + reference tables + listings
   loader + browse UI + Vitest), validate, deploy.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Autotrader ToS prohibits scraping | Personal use, low volume, scheduled (not per-request); accepted trade for free. |
| Parser breaks on site redesign | One normalizer (`proxy/scrape.js`); snapshot just goes stale, app still works. |
| Datacenter IPs are blocked | Scrape runs locally on a residential IP; that's the whole reason for the snapshot model. |
| Snapshot staleness | Show `generatedAt`; refresh cadence is a simple local scheduled job. |
| Segment tables are rough | Explicitly rough + editable + sourced — matches the model's "no false precision". |

## 9. Success metrics

- A user goes from "open the deployed link" to a comparison of real cars in **< 30s**, no install.
- Every cost assumption shows a source and is editable.
- Set 2 credibility lands even before any listing is imported.

## 10. Open questions

1. Snapshot breadth — a few metros of "all cars" (now), or curated popular models for
   like-for-like comparison?
2. Refresh cadence — daily? weekly? (local scheduled job).
3. Region grain — states vs ~9 census regions for v2.0.
