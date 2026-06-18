# Code Review — Deal Alerts backend (Phase 2)

Reviewer pass over: `alert-cron.mjs`, `cache-refresh.mjs`, `seed-cache.mjs`, `seed-watchlists.mjs`,
`supabase/client.mjs`, `supabase/schema.sql`, with integration spot-checks of `digest.mjs`,
`tco.mjs`, `autodev.mjs`, `config.mjs`.

Verdict legend per finding: **severity** (low/med/high/critical) · **confidence** (how sure I am it's real).

---

## Must-fix

### M1 — sent_state is recorded for ALL current matches, not just NEW → silent "first-run swallow" + idempotency hazard
**`alert-cron.mjs:103-108`** · severity: high · confidence: high

After a successful send the code upserts **every** kept VIN across every watchlist into `sent_state`,
not just the ones it flagged NEW. That is intentional per the comment, but it has two real consequences:

1. **No de-dup safety if the email send half-succeeds.** `resend.emails.send` returns success, then the
   upsert loop runs. If the process dies between `send` (line 97) and finishing the upsert loop (line 108),
   some watchlists get recorded and some don't → next run re-sends the un-recorded ones as "NEW" again. The
   send is not transactional with the state write. For a twice-daily personal digest this is tolerable, but
   it should be flagged: there is no per-VIN "we actually told the user about this" guarantee.
2. **The diff is computed before the send but recorded after.** `newVins` is computed in the first pass
   (lines 73-79). If two watchlists share a VIN and only one is "new", the NEW badge logic is fine, but the
   recording loop will upsert the VIN under *both* watchlist_ids regardless — which is correct for PK
   (watchlist_id,vin), so no double-send. OK. The real risk is only the partial-failure window in (1).

**Fix:** wrap the per-watchlist `sent_state` upserts into a single `upsert` call (one array, all watchlists)
so it's one network round-trip and atomic-ish, and/or move the recording to only happen after confirming the
send id is present. Minimally, collect all rows and upsert once after the send:
```js
const rows = perWl.flatMap(({ wl, kept }) => kept.map((c) => ({ watchlist_id: wl.id, vin: c.vin })));
if (rows.length) await supabase.from('sent_state').upsert(rows, { onConflict: 'watchlist_id,vin' });
```

### M2 — 1000-row default cap silently truncates matches on every read (no `.range()` / `.limit()`)
**`alert-cron.mjs:45-51` (cache query), `:61` (subscribers), `:66-67` (watchlists), `:75` (sent_state); `cache-refresh.mjs:74` count is fine** · severity: high · confidence: high

PostgREST caps un-ranged selects at **1000 rows** by default. None of the reads page or set a limit:

- **`matchWatchlist` (line 45-51):** a broad watchlist (e.g. `make=Toyota` with no model, or a high
  priceMax) over a 1863-row cache will silently return only the first 1000 rows, in undefined order. Cars
  beyond row 1000 are **never matched, never alerted** — a correctness bug that worsens as the cache grows
  (cache-refresh has 6 tiles × up to 25 pages). The user would never know matches were dropped.
- **`sent_state` read (line 75):** a long-lived watchlist will eventually accumulate >1000 sent VINs;
  past 1000, `sentSet` is incomplete → previously-sent cars get re-flagged NEW and **re-sent**. Same root
  cause, different symptom (false NEW instead of missing match).
- **subscribers / watchlists:** low risk at current scale but same latent bug for the product stage.

**Fix:** explicitly page these reads with `.range(from, to)` in a loop until a short page is returned, or at
minimum add an explicit `.limit()` with a value you've reasoned about and assert `data.length < limit`. For
`sent_state` the cleaner fix is to not fetch all sent VINs at all — see M3.

### M3 — `matchWatchlist` re-queries the whole cache once per watchlist and fetches all sent VINs per watchlist (N+1, and feeds M2)
**`alert-cron.mjs:44-57, 73-79`** · severity: med · confidence: high

For every watchlist, the code runs a fresh `select('*')` over `listings_cache` (full row incl. `raw` and
`history` jsonb) plus a `select('vin')` over `sent_state`. With S subscribers × W watchlists that's
S×W full-cache scans pulling the heavy `raw` blob each time. At POC scale (1 sub, 2 lists) it's fine, but:

- it amplifies M2 (every one of those reads is capped at 1000), and
- `select('*')` pulls `raw` (the entire Auto.dev record) and `history` for rows you only need a handful of
  fields from — wasteful payload over the wire.

**Fix:** select only the columns `cacheRowToCar` actually uses (drop `raw` unless needed — note `cacheRowToCar`
reads `r.raw?.createdAt`, so keep `raw->createdAt` or store `created_at`/`first_seen` and use that). For
`sent_state`, instead of "fetch all sent VINs then diff in JS," consider checking membership server-side or
fetching sent VINs filtered to the candidate VIN set (`.in('vin', keptVins)`), which also sidesteps the M2
cap on `sent_state`.

### M4 — `first_seen` is lost / wrong, which corrupts "days on market" in the email
**`alert-cron.mjs:24` + `digest.mjs:24,47,88` + `cache-refresh.mjs:34-46` + `seed-cache.mjs:24`** · severity: med · confidence: high

`cacheRowToCar` derives `createdAt` from `r.raw?.createdAt || r.first_seen || ''`. But:

- **cache-refresh** writes `raw: rec` where `rec.createdAt` is the Auto.dev listing-creation date — good.
- **seed-cache** writes `raw: L` from the lossy app snapshot; if `L.createdAt` is absent it falls back to
  `r.first_seen`, which seed-cache sets to `L.firstSeen || L.fetchedAt || now`. So for seeded rows the
  "Listed" date and "Days on market" can be **the seed time, not the true listing date** — every seeded car
  can show "0 days listed / listed today," which is exactly the signal the user cares about. Flag as a data-
  quality bug the user should be aware of (it makes the headline "days on market" untrustworthy for the
  seeded 1863 rows).
- `cacheRowToCar` uses `r.raw?.createdAt`. `recToRow` does **not** copy `createdAt` to a top-level column,
  so the only source is the jsonb `raw` blob — which is why M3's "drop raw" suggestion must preserve it.

**Fix:** persist a real top-level `listed_at`/`created_at` column on `listings_cache` populated from
`rec.createdAt` at refresh time, and read that. Decide explicitly what "days on market" means for snapshot-
seeded rows (probably: blank, not 0).

---

## Should-fix

### S1 — `priceMax` / `yearMin` / `milesMax` filters are dropped when the value is 0 (truthiness bug)
**`alert-cron.mjs:48-50`** · severity: med · confidence: high

`if (filters.priceMax)` / `if (filters.yearMin)` / `if (filters.milesMax)` skip the filter when the value is
`0`. `priceMax: 0` or `milesMax: 0` would be silently ignored and return everything. The filters come from a
user-controlled `filters` jsonb (anon can INSERT watchlists per RLS), so a malformed/edge watchlist quietly
becomes an unbounded query — which also collides with M2 (returns 1000 random rows). `0` is a nonsensical
max, but "silently ignore the filter" is the wrong failure mode; it should match nothing or be rejected.

**Fix:** test for presence/type, not truthiness: `if (filters.priceMax != null)` (and likewise), or
validate the filter shape on read. Same pattern is fine for `make`/`model` since empty string ≈ "no filter".

### S2 — Null `price`/`mileage`/`year` rows are silently excluded by `lte`/`gte` (data loss the user can't see)
**`alert-cron.mjs:48-50` + `schema.sql:38` (nullable price/mileage/year)** · severity: med · confidence: high

`listings_cache.price/mileage/year` are nullable, and `recToRow` writes `null` when Auto.dev omits a number.
A `.lte('price', …)` / `.gte('year', …)` filter in PostgREST does **not** match NULL rows, so any listing
with a missing price, mileage, or year is dropped from every filtered watchlist — even though such a car
might be exactly what the buyer wants (price "call dealer" is common on real listings). This is "intended-ish"
per the brief, but it's a silent omission with no count surfaced. At minimum it should be visible.

**Fix:** decide the policy explicitly. If null-price cars should still surface (flagged "price n/a"), use an
`.or('price.lte.X,price.is.null')` filter, and likewise for miles. Also: `cacheRowToCar` sets `price` from
`r.price` (may be null) and `tcoForCar` returns `null` for non-number price, so digest already renders "—"
for TCO — the rendering side is fine; only the SQL filter drops them. Log a per-watchlist "N excluded for
missing price/miles" count so it's not silent.

### S3 — Geo radius is not enforced; works only because the cache is a single 94030/200mi tile
**`alert-cron.mjs:44-50` (no lat/lng filter), `schema.sql:51` (geo index exists, unused), `PHASE2.md:24` (promises haversine)** · severity: med · confidence: high (correctness risk is real for the product)

The brief flags this as acceptable for now, and it is — *as long as* every row in `listings_cache` is within
the one 94030/200mi tile cache-refresh pulls. But this is a **latent correctness landmine**: the moment a
second region tile is added to `cache-refresh` (or a watchlist sets a tighter `zip`/`radius`), alert-cron will
happily email the user cars hundreds of miles away, because `filters.zip`/`filters.radius` are accepted into
the schema/filters but never applied. The watchlist UI can already collect `zip`/`radius` (schema comment
line 26), so a user can set them and be silently ignored.

**Fix:** either (a) enforce haversine using the `lat`/`lng` columns + `filters.zip`/`radius` now (the geo
index already exists), or (b) explicitly reject/ignore `zip`/`radius` in the watchlist filter shape and add a
guard/assert in cache-refresh that it only ever pulls the single supported tile, with a comment that
alert-cron assumes a single-region cache. Don't leave an accepted-but-ignored geo filter.

### S4 — `subs` can be falsy on error path / no-confirmed-subscribers handling
**`alert-cron.mjs:61-63`** · severity: low · confidence: high

If `subErr` is set, the code exits — good. But `subs` could in principle be `null` with no error; line 63
does `subs.length` which would throw a less-clear error. Minor robustness.
Also line 66 destructures only `data` from the watchlists query and ignores its `error` — a transient
watchlists query failure becomes "no active watchlists, skip" (line 68) and the subscriber is silently
skipped with a misleading log. Same pattern at line 75 (`sent_state` error ignored → `sentSet` empty → every
match re-flagged NEW and re-sent).

**Fix:** `const subs = data ?? []`; and check `error` on the watchlists (line 66) and sent_state (line 75)
queries — on error, skip/abort that subscriber loudly rather than treating it as "empty."

### S5 — Subject line shows raw per-watchlist match counts with no list labels, and is misleading vs PRD
**`alert-cron.mjs:91-92`** · severity: low · confidence: med

`perWl.map(({ kept }) => kept.length).join(' · ')` yields e.g. `18 · 5` with no indication which list is
which, and the count is **total current matches**, while the body leads with NEW. PRD §7 specifies
`List 1: a, List 2: b`. Cosmetic but it's a spec deviation and the bare numbers read oddly.

**Fix:** label them, or use the documented format. Low priority.

### S6 — `xlsx` workbook is rebuilt and attached even when there are zero matches
**`alert-cron.mjs:83-100`** · severity: low · confidence: med

When `totalMatches === 0` (all watchlists empty), the code still builds an empty workbook and sends an email
with a "0 matches" subject and an empty attachment. For a twice-daily digest that's noise — the user gets an
email every run even when nothing matches. Decide whether "no matches" should send at all.

**Fix:** `if (!totalMatches) { log + continue; }` before building/sending, or gate on `totalNew` if the
intent is "only email when something is new." (Note `emailMode: 'new-only'` exists in `config.mjs:7` but is
never read in alert-cron — see S7.)

### S7 — `SETTINGS.emailMode` and `SETTINGS.recipient` are dead in alert-cron
**`config.mjs:6-7` vs `alert-cron.mjs`** · severity: low · confidence: high

`config.mjs` defines `emailMode` ('all' | 'new-only') and `recipient`, but alert-cron ignores both — it
sends to `sub.email` (correct for multi-user) and always uses "all" mode. The dead `emailMode` is a trap:
someone will set it to `new-only` expecting behavior change and get none. `LISTS` in config.mjs is also dead
for the cron (it reads watchlists from the DB now).

**Fix:** either implement `emailMode` (skip watchlists/whole email when no NEW) or delete the dead settings to
avoid confusion. Note D3/config say POC sends only to the owner; the cron relies on Resend test mode to
enforce that rather than code — fine, but worth a comment.

---

## Nice-to-have / low

### N1 — `seed-cache.mjs` reads a sibling-repo path that may not exist; hard failure with stack trace
**`seed-cache.mjs:11`** · severity: low · confidence: med

`readFileSync(new URL('../app/public/data/listings.json', …))` reaches outside `rav4-alert` into `../app`.
If that file is absent the script throws a raw ENOENT. One-off script, low stakes, but a clear error message
("run build-app-listings first") would help.

### N2 — Watchlist tab name parsing assumes an em-dash; falls back to full name
**`alert-cron.mjs:82`** · severity: low · confidence: high

`wl.name.split('—')[0].trim() || wl.name` — relies on the seeded names containing `—`. User-created
watchlists (anon insert, free-text `name`) won't, so the tab becomes the full name, then `buildWorkbook`
truncates to 31 chars and strips invalid sheet chars (`digest.mjs:155`). Works, just fragile. Also two
watchlists whose names collide after truncation/sanitization will produce **duplicate worksheet names**, which
ExcelJS rejects (throws). Low probability at POC, real for the product.

**Fix:** derive tab names from a stable id and de-dupe (`Sheet 1`, `Sheet 2` fallback).

### N3 — `paginate` page-size detection can under-fetch
**`autodev.mjs:19-25`** · severity: low · confidence: med

`pageSize` is set from the length of page 1 and the loop breaks when a later page is shorter. If page 1 comes
back partial (API hiccup / a short first page) `pageSize` is set too low and pagination stops early, missing
listings. Requests `limit: 50` while the PRD/header say the API caps at 20/page — if the API silently caps at
20, `pageSize` becomes 20 and behavior is fine, but the mismatch is worth a comment. cache-refresh is the only
caller and is throttled, so low impact, but it can under-populate the cache (feeding M2/S2 emptiness).

**Fix:** break on `batch.length === 0` only, or compare against the requested `limit`, not the first page's
length.

### N4 — `expire_stale_listings` deletes hard; a single failed cache-refresh can wipe the cache
**`schema.sql:75-82` + `cache-refresh.mjs:72`** · severity: low · confidence: med

`expire_stale_listings(36h)` hard-deletes rows whose `last_seen` is older than the grace window. If
cache-refresh runs but Auto.dev returns few/zero rows (429, outage, bad query) and then expiry runs, rows that
*are* still for sale but weren't seen this run age out and get deleted after 36h of failures → alert-cron
silently goes quiet (no matches, no error). The 36h grace mitigates a single miss; sustained failures don't.
Also note: expiry runs even after a partial upsert in cache-refresh (the upsert loop exits the process on
error at line 70, so expiry won't run on upsert failure — good — but it *does* run after a successful upsert
of a near-empty fetch).

**Fix:** guard expiry on a sanity threshold (e.g. skip expiry if this run upserted < X% of current row count),
or soft-delete (set an `inactive` flag) instead of hard delete.

### N5 — `cacheRowToCar` hard-codes `cpo:false`, `series/drivetrain/colors: ''` — workbook columns always blank
**`alert-cron.mjs:33-36`** · severity: low · confidence: high

These fields exist in `DETAIL_COLS` (digest.mjs) and in the PRD's CSV spec, but alert-cron always emits empty
strings/false for them (the cache schema doesn't store them; only `raw` jsonb might). So the attached
spreadsheet has several permanently-blank columns vs the Phase-1 email. Not a bug, but a quiet feature
regression vs `run.mjs`/`normalize` (which populate them). Either pull from `r.raw` or drop the columns for the
cron workbook.

### N6 — TCO region is hard-coded to CA, ignoring `watchlists.assumptions`
**`tco.mjs:118` (`regionKey='CA'`), `alert-cron.mjs:55`** · severity: low · confidence: high

`tcoForCar` is always called with default CA; the schema's `watchlists.assumptions` (region, holdingYears,
annualMiles, financing) is never read. STATE.md says this is deliberately deferred, so this is just a flag:
the email's "5-yr TCO (CA, 12k mi/yr, no financing)" footnote is accurate today, but the moment assumptions
are surfaced in the UI they'll be silently ignored, like geo (S3). Acceptable for POC; track it.

---

## Security review

Overall: **clean for a server-side service-role tool.** Specific checks:

- **Secrets handling — PASS.** `SUPABASE_SECRET_KEY`/`SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `AUTODEV_API_KEY`
  are read from `process.env` only (`client.mjs:5-6`, `alert-cron.mjs:20,59`, `autodev.mjs:5`). None are
  logged or written to disk. `.gitignore` excludes `.env`, `out/`, `*.log`. `.env.example` contains only a
  placeholder. Error logs print `error.message`/`error` objects (e.g. `alert-cron.mjs:101` logs the Resend
  error object) — verify the Resend/Supabase error objects don't embed the API key on auth failures; they
  generally don't, but logging the whole `error` object (line 101) is slightly riskier than logging
  `error.message`. **Low-confidence flag:** prefer `console.error('Resend:', error.message)`.
- **client.mjs default URL hardcodes the project ref** (`grlkuouatrehmrutulhj.supabase.co`, line 5). That's
  not a secret (project URL is public), but hard-coding it means a missing `SUPABASE_URL` env silently points
  at the real prod project — fine here, mildly surprising. Low.
- **RLS — PASS, with one note.** Schema enables RLS on all tables and grants anon **INSERT only** on
  subscribers + watchlists (`schema.sql:93-98`), no anon SELECT/UPDATE/DELETE. Server uses the service role
  which bypasses RLS. **Note (med, latent):** anon `with check (true)` on watchlists lets any anon caller
  insert a watchlist with an **arbitrary `subscriber_id`** (FK only requires it exist) and arbitrary
  `filters` jsonb. So a malicious anon can attach watchlists to *another* subscriber's id, or insert
  garbage/huge `filters` that alert-cron then trusts (feeds S1/S2/S3). Also anon can insert a subscriber row
  but `confirmed` defaults false and the cron only reads `confirmed=true`, so the double-opt-in gate holds —
  **provided** nothing lets anon set `confirmed=true`. The INSERT policy `with check (true)` does **not**
  restrict columns, so an anon INSERT could attempt `confirmed: true` directly. **Verify**: PostgREST will
  write any column the anon role has table privileges for; with RLS insert `with check(true)` and default
  grants this can bypass double opt-in. **Fix:** add a `with check` that forbids `confirmed = true` on anon
  insert (e.g. `with check (confirmed = false)`), and consider validating `filters` server-side. This is the
  most important security item.
- **Injection — PASS.** All DB access goes through the Supabase query builder (parameterized); no string-built
  SQL. `expire_stale_listings` is parameterized plpgsql. No shell/eval.
- **Output rendering — PASS.** `digest.mjs` escapes text via `esc()` for HTML cells. `c.vdp`/`c.carfaxUrl`
  are interpolated into `href="…"` after `esc()` (escapes `<>&` but not quotes); since `esc` doesn't escape
  `"`, a crafted `vdp` containing a double-quote could break out of the attribute and inject markup into the
  email HTML. Source of `vdp` is Auto.dev / the snapshot (semi-trusted), and the email is sent to the user
  themselves, so impact is low, but **flag (low-med):** `esc()` should also escape `"` (and ideally validate
  the URL scheme is http/https) before use in an `href`. A `javascript:`-scheme vdp would render as a
  clickable link in the email body.

---

## Verdict: **ship-with-fixes**

The pipeline is correct for the happy path and the security posture is sound for a service-role tool, but
there are real correctness bugs that will bite as the cache/watchlists grow.

- **Counts:** Must-fix 4 · Should-fix 7 · Nice-to-have 6 · Security notes within (1 med-latent RLS item).
- **Must-fix before relying on it beyond the current 1-subscriber POC:**
  - **M2** (1000-row cap silently truncates matches *and* re-sends old cars once sent_state > 1000) — highest-impact correctness bug.
  - **M1** (record only-NEW / make the state write atomic with the send) — idempotency.
  - **M4** (days-on-market is wrong for seeded rows — undermines the core "new listing" signal).
  - **Security RLS** (anon can insert with arbitrary `subscriber_id` and possibly `confirmed=true` — bolt down the `with check`).
- **Should-fix soon:** S1 (0-value filter truthiness), S2 (null price/miles silently dropped), S3 (geo accepted-but-ignored).
- The POC as run (1 sub, 2 lists, 1863-row single-tile cache, send-to-self) works and is safe to keep running; the above are required before adding tiles, real users, or trusting "days on market."
