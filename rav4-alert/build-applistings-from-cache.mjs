// Rebuild the app's "Load a real car" snapshot (app/public/data/listings.json) FROM the
// Supabase listings_cache — i.e. reuse the data the twice-daily cron already pulled, so
// this costs ZERO Auto.dev calls. Fully rebuilds the file each run (sold/expired cars drop
// out because the cron's expire_stale_listings() already removed them from the cache).
//
// Run:  node build-applistings-from-cache.mjs   (needs SUPABASE_SECRET_KEY)
// Writes: ../app/public/data/listings.json  (previous file backed up first)

import { writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { supabase } from './supabase/client.mjs';

const OUT = new URL('../app/public/data/listings.json', import.meta.url);
const BAK = new URL('../app/public/data/listings.fromcache.bak.json', import.meta.url);
const NOW = new Date().toISOString();
const MIN_YEAR = 2020;

const SEGMENT_BY_MODEL = (model = '') =>
  /highlander/i.test(model) ? 'suv-midsize' : 'suv-compact';

// Page past PostgREST's 1000-row cap.
async function selectAll() {
  const out = [], size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase
      .from('listings_cache')
      .select('vin,make,model,trim,year,price,mileage,condition,powertrain,segment,city,state,dealer,vdp,first_seen,last_seen')
      .range(from, from + size - 1);
    if (error) { console.error('❌ query:', error.message); process.exit(1); }
    out.push(...(data || []));
    if (!data || data.length < size) break;
  }
  return out;
}

function toListing(r) {
  const isHybrid = r.powertrain === 'hybrid' || /hybrid/i.test(r.model || '');
  return {
    source: 'auto.dev',
    url: r.vdp || '',
    vin: r.vin || null,
    year: r.year ?? null,
    make: r.make ?? '',
    model: r.model ?? '',
    trim: r.trim || null,
    price: typeof r.price === 'number' ? r.price : null,
    mileage: typeof r.mileage === 'number' ? r.mileage : null,
    condition: r.condition === 'new' ? 'new' : 'used',
    segment: r.segment || SEGMENT_BY_MODEL(r.model),
    powertrain: isHybrid ? 'hybrid' : 'gas',
    mpg: null, // app fills from its segment reference table
    bodyStyle: 'SUV',
    fuelType: isHybrid ? 'Hybrid' : 'Gas',
    dealer: r.dealer || null,
    location: [r.city, r.state].filter(Boolean).join(', ') || null,
    fetchedAt: r.last_seen || NOW,
    firstSeen: r.first_seen || NOW,
    lastSeen: r.last_seen || NOW,
  };
}

const rows = await selectAll();
const byVin = new Map();
for (const r of rows) {
  if (!r.vin || byVin.has(r.vin)) continue;
  if ((r.year ?? 0) < MIN_YEAR) continue;
  if (typeof r.price !== 'number') continue; // app needs a price for TCO
  byVin.set(r.vin, toListing(r));
}

const listings = [...byVin.values()].sort((a, b) =>
  (a.make + a.model).localeCompare(b.make + b.model) || ((b.year ?? 0) - (a.year ?? 0)) || ((a.price ?? 0) - (b.price ?? 0)));

const byModel = {};
for (const L of listings) { const k = `${L.make} ${L.model}`; byModel[k] = (byModel[k] || 0) + 1; }

const out = {
  generatedAt: NOW,
  source: 'auto.dev',
  via: 'listings_cache (Supabase) — no Auto.dev calls',
  note: 'Auto.dev snapshot rebuilt from the alert cache — verify against the live listing before buying.',
  filters: { minYear: MIN_YEAR },
  count: listings.length,
  listings,
};

if (existsSync(OUT)) copyFileSync(OUT, BAK);
writeFileSync(OUT, JSON.stringify(out), 'utf8');
console.log(`wrote ${listings.length} listings -> app/public/data/listings.json (0 Auto.dev calls)`);
console.log('by model:', JSON.stringify(byModel));
