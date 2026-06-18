// The ONLY Auto.dev caller. Paginate supported (model × region) tiles, upsert into
// listings_cache (last_seen=now; first_seen preserved on conflict), then expire stale.
// This is what the GitHub Actions cron runs before alert-cron.
//
// Run:  node cache-refresh.mjs                 (full refresh; respects --max-pages)
//       node cache-refresh.mjs --dry           (fetch + report, no DB write)
//       node cache-refresh.mjs --models "Toyota:RAV4 Hybrid:suv-compact" --max-pages 1   (smoke test)
//
// Call budget: ~1 Auto.dev call per page (~20 listings). POC is narrowed to 2 RAV4
// tiles (~a few dozen calls); add tiles / raise --max-pages cautiously (starter 429s).

import { paginate } from './autodev.mjs';
import { supabase } from './supabase/client.mjs';

const argv = process.argv;
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const DRY = argv.includes('--dry');
const MAX_PAGES = parseInt(arg('--max-pages', '25'), 10);
const ZIP = '94030', RADIUS = '200', MIN_YEAR = 2020;

// POC: narrowed to Toyota RAV4 only (gas + hybrid) to keep Auto.dev usage low.
// Add more tiles here later (Highlander, CR-V, …) when scaling past the POC.
const ALL_TILES = [
  { make: 'Toyota', model: 'RAV4', segment: 'suv-compact' },
  { make: 'Toyota', model: 'RAV4 Hybrid', segment: 'suv-compact' },
];
const only = arg('--models', '');
const tiles = only
  ? only.split(',').map((s) => { const [make, model, segment] = s.split(':'); return { make, model, segment }; })
  : ALL_TILES;

function recToRow(rec, segment) {
  const v = rec.vehicle || {}, r = rec.retailListing || {};
  const h = rec.history && typeof rec.history === 'object' ? rec.history : null;
  return {
    vin: rec.vin, make: v.make, model: v.model, trim: v.trim || null, year: v.year ?? null,
    price: typeof r.price === 'number' ? r.price : null, mileage: typeof r.miles === 'number' ? r.miles : null,
    condition: r.used === false ? 'new' : 'used', powertrain: /hybrid/i.test(v.model || '') ? 'hybrid' : 'gas', segment,
    lat: rec.location?.[1] ?? null, lng: rec.location?.[0] ?? null,
    city: r.city || null, state: r.state || null, dealer: r.dealer || null,
    vdp: r.vdp || String(rec['@id'] || ''), carfax_url: r.carfaxUrl || null,
    history: h, raw: rec, last_seen: new Date().toISOString(),
    // first_seen intentionally omitted → default now() on insert, preserved on conflict.
  };
}

const rows = [];
const seen = new Set();
for (const t of tiles) {
  const recs = await paginate(
    { 'vehicle.make': t.make, 'vehicle.model': t.model, 'vehicle.year': `${MIN_YEAR}-2026` },
    { zip: ZIP, distance: RADIUS, maxPages: MAX_PAGES },
  );
  let kept = 0;
  for (const rec of recs) {
    if (!rec.vin || seen.has(rec.vin)) continue;
    if ((rec.vehicle?.year ?? 0) < MIN_YEAR) continue;
    seen.add(rec.vin); rows.push(recToRow(rec, t.segment)); kept++;
  }
  console.log(`${t.make} ${t.model}: ${recs.length} fetched, ${kept} unique`);
}
console.log(`Pulled ${rows.length} rows (max ${MAX_PAGES} pages/tile).`);

if (DRY) { console.log('[dry] not writing.'); process.exit(0); }

for (let i = 0; i < rows.length; i += 200) {
  const { error } = await supabase.from('listings_cache').upsert(rows.slice(i, i + 200), { onConflict: 'vin' });
  if (error) { console.error('❌ upsert:', error.message); process.exit(1); }
}
const { data: expired, error: eErr } = await supabase.rpc('expire_stale_listings', { grace_hours: 36 });
if (eErr) console.warn('⚠️ expire rpc:', eErr.message); else console.log('expired stale rows:', expired);
const { count } = await supabase.from('listings_cache').select('*', { count: 'exact', head: true });
console.log(`✅ listings_cache now ${count} rows.`);
