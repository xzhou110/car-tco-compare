// Data-catalog dump: pull ALL RAV4 Hybrids near 94030 (paginated, no price/year/
// mileage filters) so we see the full breadth + every field, then flatten to a
// wide CSV you can open in Excel / Google Sheets.
//
// Run:  node dump.mjs      (needs AUTODEV_API_KEY in the environment)
// Output: out/rav4_available.csv

import { AutoDev } from '@auto.dev/sdk';
import { mkdirSync, writeFileSync } from 'node:fs';

const KEY = process.env.AUTODEV_API_KEY;
if (!KEY) { console.error('❌ AUTODEV_API_KEY not set.'); process.exit(1); }
const auto = new AutoDev({ apiKey: KEY });

const baseParams = {
  'vehicle.make': 'Toyota',
  'vehicle.model': 'RAV4 Hybrid',
  zip: '94030',
  distance: '200',
  limit: 50, // server appears to cap at ~20; we paginate regardless
};

const extract = (res) => {
  const r = res?.records ?? res?.data ?? res?.listings ?? (Array.isArray(res) ? res : []);
  return Array.isArray(r) ? r : (r?.records ?? []);
};

// Paginate via `page` until a page comes back empty (or smaller than the first page).
const all = [];
const seen = new Set();
let pageSize = null;
for (let page = 1; page <= 15; page++) {
  const res = await auto.listings({ ...baseParams, page });
  if (page === 1) {
    const meta = { ...res };
    delete meta.records; delete meta.data; delete meta.listings;
    console.log('Response metadata (non-record keys):', JSON.stringify(meta));
  }
  const batch = extract(res);
  if (pageSize === null) pageSize = batch.length;
  let added = 0;
  for (const x of batch) { if (x.vin && !seen.has(x.vin)) { seen.add(x.vin); all.push(x); added++; } }
  console.log(`  page ${page}: ${batch.length} returned, ${added} new (total ${all.length})`);
  if (batch.length === 0 || batch.length < pageSize) break;
}

const COLUMNS = [
  ['vin', (x) => x.vin], ['createdAt', (x) => x.createdAt],
  ['lng', (x) => x.location?.[0]], ['lat', (x) => x.location?.[1]],
  ['year', (x) => x.vehicle?.year], ['make', (x) => x.vehicle?.make], ['model', (x) => x.vehicle?.model],
  ['trim', (x) => x.vehicle?.trim], ['series', (x) => x.vehicle?.series],
  ['bodyStyle', (x) => x.vehicle?.bodyStyle], ['type', (x) => x.vehicle?.type],
  ['drivetrain', (x) => x.vehicle?.drivetrain], ['engine', (x) => x.vehicle?.engine], ['fuel', (x) => x.vehicle?.fuel],
  ['cylinders', (x) => x.vehicle?.cylinders], ['doors', (x) => x.vehicle?.doors], ['seats', (x) => x.vehicle?.seats],
  ['transmission', (x) => x.vehicle?.transmission],
  ['exteriorColor', (x) => x.vehicle?.exteriorColor], ['interiorColor', (x) => x.vehicle?.interiorColor],
  ['baseMsrp', (x) => x.vehicle?.baseMsrp], ['baseInvoice', (x) => x.vehicle?.baseInvoice], ['confidence', (x) => x.vehicle?.confidence],
  ['price', (x) => x.retailListing?.price], ['miles', (x) => x.retailListing?.miles],
  ['cpo', (x) => x.retailListing?.cpo], ['used', (x) => x.retailListing?.used],
  ['city', (x) => x.retailListing?.city], ['state', (x) => x.retailListing?.state], ['dealer', (x) => x.retailListing?.dealer],
  ['photoCount', (x) => x.retailListing?.photoCount], ['primaryImage', (x) => x.retailListing?.primaryImage],
  ['vdp', (x) => x.retailListing?.vdp], ['carfaxUrl', (x) => x.retailListing?.carfaxUrl],
  ['history', (x) => (x.history == null ? '' : JSON.stringify(x.history))],
];

const esc = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

const csv = [COLUMNS.map(([n]) => n).join(','),
  ...all.map((x) => COLUMNS.map(([, f]) => esc(f(x))).join(','))].join('\n');

mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
writeFileSync(new URL('./out/rav4_available.csv', import.meta.url), csv, 'utf8');

console.log(`\nTOTAL unique listings: ${all.length}`);
console.log(`Wrote out/rav4_available.csv  (${COLUMNS.length} columns)`);
const prices = all.map((x) => x.retailListing?.price).filter((n) => typeof n === 'number');
const years = all.map((x) => x.vehicle?.year).filter(Boolean);
if (prices.length) console.log(`Price range: $${Math.min(...prices).toLocaleString()} – $${Math.max(...prices).toLocaleString()}`);
if (years.length) console.log(`Year range:  ${Math.min(...years)} – ${Math.max(...years)}`);
const trims = {};
for (const x of all) { const t = x.vehicle?.trim ?? '?'; trims[t] = (trims[t] ?? 0) + 1; }
console.log('Trims:', Object.entries(trims).sort((a,b)=>b[1]-a[1]).map(([t, c]) => `${t}:${c}`).join('  '));

// --- History coverage analysis (the key question for the no-accident/personal-use filters) ---
const withHist = all.filter((x) => x.history && typeof x.history === 'object');
console.log(`\nHistory populated: ${withHist.length}/${all.length} (${Math.round(100*withHist.length/all.length)}%)`);
const usage = {}; for (const x of withHist) { const u = x.history.usageType ?? '(none)'; usage[u] = (usage[u] ?? 0) + 1; }
console.log('  usageType:', Object.entries(usage).map(([u, c]) => `${u}:${c}`).join('  '));
const accT = withHist.filter((x) => x.history.accidents === true).length;
console.log(`  accidents: true:${accT}  false:${withHist.length - accT}`);
// coverage by model-year bucket, since newer cars seem to lack history
const byEra = { '<=2019': [0,0], '2020+': [0,0] };
for (const x of all) { const k = (x.vehicle?.year ?? 0) >= 2020 ? '2020+' : '<=2019'; byEra[k][0]++; if (x.history) byEra[k][1]++; }
for (const [k,[tot,h]] of Object.entries(byEra)) console.log(`  ${k}: ${h}/${tot} have history`);
