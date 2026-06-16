# Design — Data Layer Architecture

**Status:** Draft v0.2 (free-scrape + static-snapshot)
**Last updated:** 2026-06-16
**Companion to:** [`../PRD-data-layer.md`](../PRD-data-layer.md), [`segment-model.md`](segment-model.md)

How the two data sets reach the existing app. The engine
([`../../app/src/lib/tco.ts`](../../app/src/lib/tco.ts)) does **not** change — this is about
*producing* the `Vehicle` + `Assumptions` it already consumes.

---

## 1. The decision that shapes everything

Free scraping of Autotrader **works from a residential IP and is blocked from datacenter IPs**
(we saw Cars.com tarpit and CarGurus 403 even locally; Autotrader returns a clean 200 here).
A cloud function / GitHub Action would be scraping from a datacenter IP → blocked. So:

> **The scrape runs on the user's machine. Its output is a static JSON snapshot committed to
> the repo. The deployed Pages site only ever reads that JSON — it never scrapes.**

This keeps the deployed app 100% static and free, and lets *every visitor* see real cars with
no install.

## 2. Topology

```
  [your machine, residential IP]                 [GitHub]              [visitor browser]
  node proxy/snapshot.js                          deploy.yml            Pages SPA
   → scrape Autotrader (proxy/scrape.js)           (vite build,          fetch
   → normalize → dedupe by VIN          ── push ─▶  public/ → dist) ──▶  ./data/listings.json
   → write app/public/data/listings.json                                → resolveVehicle()
                                                                         → loadVehicle()
                                                                         → computeTco()
```
- `vite` copies `app/public/` into `dist/`, so `app/public/data/listings.json` ships to Pages
  automatically. `base: './'` means the app fetches it at `${import.meta.env.BASE_URL}data/listings.json`.
- **Refresh = re-run the generator → commit → push.** A local Task Scheduler job automates it.

### Optional dev-only live mode
`proxy/server.js` is the same scraper behind an HTTP endpoint (`/api/search`). When running
locally it gives *you* live on-demand search; an HTTPS page may call `http://localhost`
(secure-context exemption). The deployed site does not depend on it.

## 3. The `Listing` schema (generator output)

```ts
interface Listing {
  source: 'autotrader'; url: string; vin: string | null;
  year: number; make: string; model: string; trim: string | null;
  price: number | null; mileage: number | null;
  condition: 'new' | 'used';
  segment: SegmentKey;          // self-classified from bodyStyles (no VIN decode)
  powertrain: 'gas'|'hybrid'|'ev';  // from fuelType
  mpg: number | null;           // from EPA fields when present, else segment default
  bodyStyle: string; fuelType: string; dealer: string | null; location: string | null;
  fetchedAt: string;
}
```
**Key simplification vs the earlier plan:** Autotrader's embedded data already gives
`bodyStyles` + `fuelType` + `mpg`, so a listing classifies itself — we dropped the NHTSA/EPA
VIN-decode step entirely.

## 4. Listing → Vehicle

```
Listing ──(segment, powertrain)──▶ Set 2 rate table  ──▶ insurance/maint/repair/depRate/warranty
        ──(region)───────────────▶ region table       ──▶ × insurance mult, fuel/elec/tax overlay
        price→purchasePrice · mileage→odometer · year→age · mpg (listing or segment default)
   ⇒ resolveVehicle(listing, region, tables) → Vehicle   (resaleValue:null → engine seeds it)
   ⇒ loadVehicle(slot, vehicle)   // EXISTING hook, unchanged
   ⇒ computeTco(...)              // EXISTING engine, unchanged
```
Listing values win; the user can still edit every field afterward.

## 5. Front-end changes (additive, small)

- `listings` loader: fetch the snapshot once, with a fallback to bundled presets.
- A **browse panel**: filters (text, segment, condition, powertrain, max price, region) over
  the snapshot → "add to compare" → `resolveVehicle` → existing slot/`loadVehicle`.
- A **"listings as of \<generatedAt\>"** note; imported fields tagged sourced until edited.
- State unchanged: imports are just vehicles in the existing comparison state.

## 6. Failure & honesty

- Missing/blocked snapshot → app falls back to presets; never breaks the core compare.
- Scraped data is best-effort; the UI says "verify against the live listing before buying".

## 7. Open decisions

1. Snapshot breadth: metros of "all cars" vs curated popular models.
2. Refresh cadence + whether to keep a small price-history per VIN later.
3. Region grain (states vs census regions).
