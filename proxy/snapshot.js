/*
 * Snapshot generator (integration approach #1: static JSON for the deployed app).
 * Curated to the models the user wants to preload: Toyota RAV4, Toyota Highlander,
 * Honda CR-V — model year 2020+. Scrapes each model across a few metros, enforces
 * model + year in code (Autotrader mixes in a few sponsored "similar" cars),
 * dedupes by VIN, writes:
 *   app/public/data/listings.json   (Vite copies public/ -> dist/, so it ships to Pages)
 * Refresh flow: run on your machine (residential IP), then commit + push the JSON;
 * the deploy Action republishes. Low volume + polite delay on purpose.
 *
 *   node proxy/snapshot.js
 */
const fs = require('fs');
const path = require('path');
const { searchAutotrader } = require('./scrape');

const MIN_YEAR = 2020;
// Autotrader make/model codes + a normalized matcher to drop contaminating results.
const MODELS = [
  { make: 'TOYOTA', model: 'RAV4', expect: 'rav4' },
  { make: 'TOYOTA', model: 'HIGHLANDER', expect: 'highlander' },
  { make: 'HONDA', model: 'CRV', expect: 'crv' },
];
const ZIPS = ['60601', '90001', '10001', '77001']; // Chicago, LA, NYC, Houston
const RADIUS = '100';
const OUT = path.join(__dirname, '..', 'app', 'public', 'data', 'listings.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

(async () => {
  const byVin = new Map();
  const queryLog = [];
  for (const m of MODELS) {
    let kept = 0;
    for (const zip of ZIPS) {
      const r = await searchAutotrader(zip, RADIUS, m.make, m.model, MIN_YEAR);
      const ok = (r.listings || []).filter((L) => L.price && L.year >= MIN_YEAR && norm(L.model) === m.expect);
      for (const L of ok) if (L.vin && !byVin.has(L.vin)) { byVin.set(L.vin, L); kept++; }
      queryLog.push({ make: m.make, model: m.model, zip, returned: (r.listings || []).length, matched: ok.length, error: r.error || null });
      console.log(`${m.make} ${m.model} @ ${zip}: returned ${(r.listings || []).length}, matched ${ok.length}${r.error ? ' (' + r.error + ')' : ''}`);
      await sleep(1500); // be polite
    }
  }

  const listings = [...byVin.values()].sort((a, b) =>
    (a.make + a.model).localeCompare(b.make + b.model) || b.year - a.year || a.price - b.price);

  const out = {
    generatedAt: new Date().toISOString(),
    source: 'autotrader',
    note: 'Free direct-scrape snapshot — best-effort, verify against the live listing before buying.',
    filters: { models: MODELS.map((m) => m.make + ' ' + m.model), minYear: MIN_YEAR, zips: ZIPS, radius: RADIUS },
    queries: queryLog,
    count: listings.length,
    listings,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 0));

  const byModel = {};
  const yrs = listings.map((L) => L.year);
  listings.forEach((L) => { const k = L.make + ' ' + L.model; byModel[k] = (byModel[k] || 0) + 1; });
  console.log(`\nwrote ${listings.length} listings -> ${OUT}`);
  console.log('by model: ' + JSON.stringify(byModel));
  console.log('year range: ' + Math.min(...yrs) + '–' + Math.max(...yrs));
})();
