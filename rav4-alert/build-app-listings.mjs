// #4 — Replace the Autotrader scraper as the web app's data source.
// Pulls RAV4 / Highlander / CR-V (gas + hybrid, 2020+) from Auto.dev near 94030/200mi
// and writes the app's static snapshot in the SAME `Listing` shape the app consumes.
// The app code (loadListingsSnapshot / resolveVehicle / computeTco) is unchanged.
//
// Run:  node build-app-listings.mjs   (needs AUTODEV_API_KEY)
// Writes: ../app/public/data/listings.json  (previous file backed up first)

import { writeFileSync, copyFileSync, existsSync, readFileSync } from 'node:fs';
import { paginate } from './autodev.mjs';

const ZIP = '94030', RADIUS = '200', MIN_YEAR = 2020;

// Auto.dev splits gas vs hybrid into separate model names → query both.
const MODELS = [
  { make: 'Toyota', model: 'RAV4', segment: 'suv-compact' },
  { make: 'Toyota', model: 'RAV4 Hybrid', segment: 'suv-compact' },
  { make: 'Toyota', model: 'Highlander', segment: 'suv-midsize' },
  { make: 'Toyota', model: 'Highlander Hybrid', segment: 'suv-midsize' },
  { make: 'Honda', model: 'CR-V', segment: 'suv-compact' },
  { make: 'Honda', model: 'CR-V Hybrid', segment: 'suv-compact' },
];

const OUT = new URL('../app/public/data/listings.json', import.meta.url);
const BAK = new URL('../app/public/data/listings.scraped.bak.json', import.meta.url);
const NOW = new Date().toISOString();

// Carry forward each VIN's first-seen date so we can show "days on market". The
// snapshot is fully rebuilt each run, so cars that dropped out of Auto.dev's feed
// (sold/removed) expire automatically. (Phase 2 moves this to a DB cache with an
// explicit last_seen sweep + grace window.)
const prevFirstSeen = new Map();
if (existsSync(OUT)) {
  try { for (const L of JSON.parse(readFileSync(OUT, 'utf8')).listings ?? []) if (L.vin) prevFirstSeen.set(L.vin, L.firstSeen ?? L.fetchedAt ?? NOW); } catch {}
}

function toListing(rec, segment) {
  const v = rec.vehicle ?? {}, r = rec.retailListing ?? {};
  const isHybrid = /hybrid/i.test(v.model || '');
  return {
    source: 'auto.dev',
    url: r.vdp || String(rec['@id'] || ''),
    vin: rec.vin || null,
    year: v.year ?? null,
    make: v.make ?? '',
    model: v.model ?? '',
    trim: v.trim || null,
    price: typeof r.price === 'number' ? r.price : null,
    mileage: typeof r.miles === 'number' ? r.miles : null,
    condition: r.used === false ? 'new' : 'used',
    segment,
    powertrain: isHybrid ? 'hybrid' : 'gas',
    mpg: null, // app fills from its segment reference table
    bodyStyle: v.bodyStyle || 'SUV',
    fuelType: isHybrid ? 'Hybrid' : (v.fuel || 'Gasoline'),
    dealer: r.dealer || null,
    location: [r.city, r.state].filter(Boolean).join(', ') || null,
    fetchedAt: new Date().toISOString(),
  };
}

const byVin = new Map();
const queryLog = [];
for (const m of MODELS) {
  const recs = await paginate(
    { 'vehicle.make': m.make, 'vehicle.model': m.model, 'vehicle.year': `${MIN_YEAR}-2026` },
    { zip: ZIP, distance: RADIUS },
  );
  let kept = 0;
  for (const rec of recs) {
    if (!rec.vin || byVin.has(rec.vin)) continue;
    if ((rec.vehicle?.year ?? 0) < MIN_YEAR) continue;
    byVin.set(rec.vin, toListing(rec, m.segment));
    kept++;
  }
  queryLog.push({ make: m.make, model: m.model, returned: recs.length, kept });
  console.log(`${m.make} ${m.model}: ${recs.length} fetched, ${kept} new`);
}

const listings = [...byVin.values()].sort((a, b) =>
  (a.make + a.model).localeCompare(b.make + b.model) || ((b.year ?? 0) - (a.year ?? 0)) || ((a.price ?? 0) - (b.price ?? 0)));

let newCount = 0;
for (const L of listings) {
  L.lastSeen = NOW;
  L.firstSeen = prevFirstSeen.get(L.vin) ?? NOW;
  if (L.firstSeen === NOW) newCount++;
}
const expiredCount = [...prevFirstSeen.keys()].filter((v) => !byVin.has(v)).length;

const out = {
  generatedAt: new Date().toISOString(),
  source: 'auto.dev',
  note: 'Auto.dev API snapshot — verify against the live listing before buying.',
  filters: { models: MODELS.map((m) => `${m.make} ${m.model}`), minYear: MIN_YEAR, zip: ZIP, radius: RADIUS },
  queries: queryLog,
  count: listings.length,
  listings,
};

if (existsSync(OUT)) copyFileSync(OUT, BAK);
writeFileSync(OUT, JSON.stringify(out), 'utf8');

const byModel = {};
for (const L of listings) { const k = `${L.make} ${L.model}`; byModel[k] = (byModel[k] || 0) + 1; }
console.log(`\nwrote ${listings.length} listings -> app/public/data/listings.json`);
console.log('by model:', JSON.stringify(byModel));
console.log('previous snapshot backed up -> app/public/data/listings.scraped.bak.json');
