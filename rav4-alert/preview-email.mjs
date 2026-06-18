// DEV verification: build the alert email + xlsx straight from listings_cache,
// bypassing the subscribers table (so it works before phase2b.sql is applied and
// makes no Auto.dev calls). Mirrors the cron's rendering. Run: node preview-email.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { supabase } from './supabase/client.mjs';
import { filterList, summarySection, buildHtml, buildWorkbook, topTcoSection, rankTopVins } from './digest.mjs';
import { tcoForCar } from './tco.mjs';
import { withinRadius } from './geo.mjs';

const PREFS = [
  { name: 'RAV4 Hybrid — under $30k (any trim)', filters: { make: 'Toyota', model: 'RAV4 Hybrid', priceMax: 30000, yearMin: 2020, milesMax: 60000, xlePlusOnly: false, zip: '94030', radius: 200 } },
  { name: 'RAV4 Hybrid XLE+ — under $35k', filters: { make: 'Toyota', model: 'RAV4 Hybrid', priceMax: 35000, yearMin: 2022, milesMax: 60000, xlePlusOnly: true, zip: '94030', radius: 200 } },
];

function cacheRowToCar(r) {
  const createdAt = r.raw?.createdAt || r.first_seen || '';
  const h = r.history && typeof r.history === 'object' ? r.history : null;
  return {
    vin: r.vin, createdAt, year: r.year, make: r.make, model: r.model, trim: r.trim || '',
    vehicle: [r.year, r.make, r.model, r.trim].filter(Boolean).join(' '),
    fuel: r.powertrain === 'hybrid' ? 'Hybrid' : 'Gas', miles: r.mileage, price: r.price,
    baseMsrp: null, baseInvoice: null, city: r.city || '', state: r.state || '',
    location: [r.city, r.state].filter(Boolean).join(', '), dealer: r.dealer || '',
    series: '', drivetrain: '', exteriorColor: '', interiorColor: '', cpo: false,
    vdp: r.vdp || '', primaryImage: '', carfaxUrl: r.carfax_url || '',
    historyKnown: !!h, accidents: h ? h.accidents : null, accidentCount: h ? h.accidentCount : null,
    ownerCount: h ? h.ownerCount : null, usageType: h ? h.usageType : null,
  };
}
async function selectAll(buildQuery) {
  const out = [], size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await buildQuery().range(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < size) break;
  }
  return out;
}
async function match(filters) {
  const build = () => {
    let q = supabase.from('listings_cache').select('*');
    if (filters.make) q = q.eq('make', filters.make);
    if (filters.model) q = q.eq('model', filters.model);
    if (filters.priceMin) q = q.gte('price', filters.priceMin);
    if (filters.priceMax) q = q.lte('price', filters.priceMax);
    if (filters.yearMin) q = q.gte('year', filters.yearMin);
    if (filters.milesMax) q = q.lte('mileage', filters.milesMax);
    return q;
  };
  let rows = await selectAll(build);
  if (filters.zip && filters.radius) rows = withinRadius(rows, filters.zip, filters.radius);
  const cars = rows.map(cacheRowToCar);
  const xle = !!filters.xlePlusOnly && /rav4/i.test(filters.model || '');
  const { kept } = filterList(cars, { xlePlusOnly: xle });
  for (const c of kept) c.tco = tcoForCar(c);
  return kept;
}

const perWl = [];
for (const p of PREFS) perWl.push({ wl: p, kept: await match(p.filters) });
const allCars = perWl.flatMap((x) => x.kept);
const topVins = rankTopVins(allCars, 10);
const newVins = new Set(allCars.map((c) => c.vin)); // preview: mark all NEW
const sections = perWl.map(({ wl, kept }) => summarySection({ name: wl.name }, kept, newVins, topVins));
const perList = perWl.map(({ wl, kept }) => ({ tab: wl.name, cars: kept }));
const intro = `<p style="font:15px system-ui;margin:0 0 4px">Hi 👋</p>
  <p style="font:13px system-ui;color:#444;margin:0 0 14px;line-height:1.5">Here are the lowest <b>total-cost-to-own</b> cars matching your ${PREFS.length} preferences right now. The 🏆 top 10 by 5-year cost are first, then a breakdown per preference; full detail is in the attached spreadsheet.</p>`;
const html = buildHtml([topTcoSection(allCars, 10), ...sections], { intro, unsubscribeUrl: 'https://example.com/#/unsubscribe?token=demo' });
const xlsx = await buildWorkbook(perList);

mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
writeFileSync(new URL('./out/preview-email.html', import.meta.url), html, 'utf8');
writeFileSync(new URL('./out/preview-deal-alerts.xlsx', import.meta.url), xlsx);
console.log(perWl.map(({ wl, kept }) => `${wl.name}: ${kept.length}`).join('\n'));
console.log(`top-10 vins: ${topVins.size}; wrote out/preview-email.html + out/preview-deal-alerts.xlsx`);
