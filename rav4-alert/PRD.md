# PRD — RAV4 Hybrid Listing Alert

**Status:** POC · **Owner:** xzhou · **Last updated:** 2026-06-17

## 1. Problem
Manually checking CarGurus / AutoTrader / Cars.com / Carfax for a used RAV4 Hybrid
that matches a precise set of criteria is tedious and easy to miss new listings.
Those sites also block automated access. We want an automated digest emailed twice a
day. Long-term: a consumer-facing app where anyone can set up such alerts.

## 2. Goals
- **POC (this doc):** prove a correctly-filtered digest email — brief summary in the
  body + a detailed data sheet attached — can be generated and delivered to the inbox.
- **v1 (personal):** twice-daily email of *new* matching listings, run automatically.
- **Future (product):** multi-user, self-serve saved searches, web UI.

## 3. Non-goals (POC)
- No scraping of the four retail sites (proven blocked — 403/timeout).
- No multi-user, web UI, or accounts.
- No paid per-VIN history lookups.
- No scheduling yet (run on demand).
- No "new since last run" state yet (POC sends all current matches).

## 4. Users
- **Now:** a specific buyer (you).
- **Later:** used-car shoppers who want hands-off alerts.

## 5. Data source
- **Auto.dev Listings API** via `@auto.dev/sdk`. Starter tier: 1,000 calls/mo, **20
  results/page → must paginate**.
- Rich vehicle + listing fields available (make/model/trim/series/year/price/miles/
  dealer/location/photos/vdp/carfaxUrl).
- **History** (`accidents`, `accidentCount`, `ownerCount`, `oneOwner`, `usageType`)
  exists but is populated for only ~2% of listings and ~0.4% of 2020+ cars.

## 6. Search lists & filter criteria
Near **zip 94030, 200-mile radius**, Toyota RAV4 Hybrid.

| | List 1 | List 2 |
|---|---|---|
| Trim | any | **XLE and above** (excl. base LE) |
| Max miles | 60,000 | 60,000 |
| Max price | $30,000 | $35,000 |
| Min year | 2020 | 2022 |

**Filter placement:**
- **API-side:** make, model, year range, miles range, price range, zip, distance.
- **Client-side:** trim XLE+ (List 2); dedupe by VIN; pagination.
- **History (opportunistic):** if data present, **exclude** accident cars and
  fleet/corporate-use cars (and any "…Fleet" trim). If history is absent (the common
  case for 2020+), **keep and flag "unverified"** with a Carfax link to check. We do
  *not* hard-drop on missing data, or the list would be empty.

## 7. Output / email design
- **Sender (POC):** `onboarding@resend.dev` (Resend shared domain — no domain setup).
- **Recipient (POC):** the Resend account email (free tier limit until a domain is verified).
- **Subject:** `RAV4 Hybrid alert — N matches (List 1: a, List 2: b) — <date>`
- **Body (brief table, per list):** Listed date · Year · Vehicle (make model trim) ·
  Fuel · Miles · Price · Location (city, state) · Dealer · Accident · Usage.
  Vehicle links to the listing.
- **Attachment (detail CSV):** createdAt, year, make/model/trim, fuel, miles, price,
  baseMsrp, baseInvoice, city/state, dealer, accident, accidentCount, ownerCount,
  usageType, series, drivetrain, exteriorColor, interiorColor, cpo, vdp, vin,
  primaryImage, carfaxUrl. Opens in Excel / Google Sheets.

## 8. De-dupe & "new since last run" (v1, not POC)
Persist seen VINs (JSON/SQLite); email only new matches. POC sends all current matches.

## 9. Scheduling (v1, not POC)
Recommended: **GitHub Actions cron**, twice daily (free, cloud, runs when PC is off,
secrets via repo secrets). Alternatives: Claude cloud routine; Windows Task Scheduler.

## 10. Architecture
Node + `@auto.dev/sdk` (data) + `resend` (email). Secrets in env vars
(`AUTODEV_API_KEY`, `RESEND_API_KEY`). Pipeline: **fetch (paginated) → normalize →
filter → render (HTML + CSV) → send**.

## 11. Success criteria (POC)
One command pulls both lists, applies all filters, and delivers an email with a brief
per-list table plus the detail CSV attached — no errors — to the inbox.

## 12. Open questions / risks
- Resend recipient limited to the account email until a domain is verified.
- History coverage is low for target (2020+) cars → "no accident / personal use"
  can't be *guaranteed* pre-click; we flag + link Carfax instead.
- Auto.dev commercial licensing/redistribution for the product stage.
- Confirm: 200-mile radius (wide) and whether SE/XSE count as "XLE and above"
  (currently treated as yes).
