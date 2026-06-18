// Seed listings_cache from the snapshot we ALREADY have — zero Auto.dev calls.
// (History / carfax / lat-lng aren't in the lossy app snapshot; the production
// cache-refresh job backfills those. TCO inputs — price/year/miles/segment/
// powertrain — are all present, so the digest pipeline works off this seed.)
//
// Run:  node seed-cache.mjs   (needs SUPABASE_SECRET_KEY)

import { readFileSync } from 'node:fs';
import { supabase, SUPABASE_URL } from './supabase/client.mjs';

const snap = JSON.parse(readFileSync(new URL('../app/public/data/listings.json', import.meta.url), 'utf8'));
const now = new Date().toISOString();

const rows = snap.listings.filter((L) => L.vin).map((L) => {
  const [city, state] = (L.location || '').split(',').map((s) => s.trim());
  return {
    vin: L.vin,
    make: L.make, model: L.model, trim: L.trim, year: L.year,
    price: L.price, mileage: L.mileage,
    condition: L.condition, powertrain: L.powertrain, segment: L.segment,
    city: city || null, state: state || null, dealer: L.dealer,
    vdp: L.url, carfax_url: null, history: null,
    raw: L,
    first_seen: L.firstSeen || L.fetchedAt || now,
    last_seen: L.lastSeen || L.fetchedAt || now,
  };
});

console.log(`Seeding ${rows.length} rows into listings_cache @ ${SUPABASE_URL} ...`);
for (let i = 0; i < rows.length; i += 200) {
  const batch = rows.slice(i, i + 200);
  let ok = false;
  for (let attempt = 1; attempt <= 4 && !ok; attempt++) {
    const { error } = await supabase.from('listings_cache').upsert(batch, { onConflict: 'vin' });
    if (!error) { ok = true; break; }
    console.warn(`  batch @${i} attempt ${attempt}: ${error.message}`);
    await new Promise((r) => setTimeout(r, 800 * attempt));
  }
  if (!ok) { console.error('❌ gave up on batch', i); process.exit(1); }
  console.log(`  upserted ${Math.min(i + 200, rows.length)}/${rows.length}`);
}

const { count, error } = await supabase.from('listings_cache').select('*', { count: 'exact', head: true });
if (error) { console.error('❌ count error:', error.message); process.exit(1); }
console.log(`✅ listings_cache now has ${count} rows.`);
