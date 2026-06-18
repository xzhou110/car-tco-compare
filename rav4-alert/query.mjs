// POC digest preview: query Auto.dev for both RAV4 Hybrid lists, apply the
// filters Auto.dev can't (trim XLE+), dedupe by VIN, and print an email-style
// summary with a Carfax link per car.
//
// Run:  npm run query     (needs AUTODEV_API_KEY in the environment)

import { AutoDev } from '@auto.dev/sdk';

const KEY = process.env.AUTODEV_API_KEY;
if (!KEY) {
  console.error('\n❌ AUTODEV_API_KEY is not set. Set it as a user env var and open a NEW terminal.\n');
  process.exit(1);
}
const auto = new AutoDev({ apiKey: KEY });

// RAV4 Hybrid trim ladder. "XLE and above" = everything except base LE.
const TRIM_RANK = { 'le': 1, 'xle': 2, 'xle premium': 3, 'se': 4, 'xse': 5, 'limited': 6, 'woodland': 7, 'woodland edition': 7 };
const rank = (t) => (t ? (TRIM_RANK[t.toLowerCase().trim()] ?? 99) : 0); // unknown trim -> 99 (kept, flagged)
const isXlePlus = (t) => rank(t) >= 2;

const baseParams = {
  'vehicle.make': 'Toyota',
  'vehicle.model': 'RAV4 Hybrid',
  zip: '94030',
  distance: '200',
  limit: 50,
};

const LISTS = [
  { label: 'List 1 — RAV4 Hybrid, any trim', xlePlusOnly: false,
    params: { ...baseParams, 'vehicle.year': '2020-2026', miles: '0-60000', 'retailListing.price': '0-30000' } },
  { label: 'List 2 — RAV4 Hybrid, XLE and above', xlePlusOnly: true,
    params: { ...baseParams, 'vehicle.year': '2022-2026', miles: '0-60000', 'retailListing.price': '0-35000' } },
];

const money = (n) => (typeof n === 'number' ? '$' + n.toLocaleString('en-US') : '—');
const num = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : '—');

function extract(res) {
  const r = res?.records ?? res?.data ?? res?.listings ?? res;
  if (Array.isArray(r)) return r;
  if (Array.isArray(r?.records)) return r.records;
  return [];
}

async function run({ label, params, xlePlusOnly }) {
  console.log('\n' + '─'.repeat(78) + `\n${label}\n` + '─'.repeat(78));
  let list = extract(await auto.listings(params));

  // dedupe by VIN
  const seen = new Set();
  list = list.filter((x) => (x.vin && !seen.has(x.vin)) && seen.add(x.vin));

  const total = list.length;
  if (xlePlusOnly) list = list.filter((x) => isXlePlus(x.vehicle?.trim));

  console.log(`${list.length} match${list.length === 1 ? '' : 'es'}` +
    (xlePlusOnly ? ` (filtered from ${total}; dropped base-LE trims)` : ` (${total} after dedupe)`) + '\n');

  // sort cheapest first
  list.sort((a, b) => (a.retailListing?.price ?? 1e9) - (b.retailListing?.price ?? 1e9));

  for (const x of list) {
    const v = x.vehicle ?? {}, r = x.retailListing ?? {};
    const flag = rank(v.trim) === 99 ? ' ⚠️trim?' : '';
    console.log(`• ${v.year} RAV4 Hybrid ${v.trim ?? '?'}${flag}  ${v.drivetrain ?? ''} ${v.exteriorColor ?? ''}`.trimEnd());
    console.log(`    ${money(r.price)}  |  ${num(r.miles)} mi  |  ${r.city ?? '?'}, ${r.state ?? ''}  |  ${r.dealer ?? '?'}`);
    console.log(`    listing: ${r.vdp ?? 'n/a'}`);
    console.log(`    carfax:  ${r.carfaxUrl ?? 'n/a'}`);
    console.log(`    vin ${x.vin}  ·  listed ${x.createdAt ?? '?'}`);
  }
}

for (const l of LISTS) await run(l);
console.log('\nDone.\n');
