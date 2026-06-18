// Auto.dev fetch + normalize. Handles pagination (API caps at 20/page).
import { AutoDev } from '@auto.dev/sdk';
import { SETTINGS } from './config.mjs';

const auto = new AutoDev({ apiKey: process.env.AUTODEV_API_KEY });

const extract = (res) => {
  const r = res?.records ?? res?.data ?? res?.listings ?? (Array.isArray(res) ? res : []);
  return Array.isArray(r) ? r : (r?.records ?? []);
};

// Paginate a query until exhausted; dedupe by VIN; return RAW Auto.dev records.
export async function paginate(query, opts = {}) {
  const zip = opts.zip ?? SETTINGS.zip;
  const distance = opts.distance ?? SETTINGS.radius;
  const maxPages = opts.maxPages ?? SETTINGS.maxPages;
  const all = [];
  const seen = new Set();
  let pageSize = null;
  for (let page = 1; page <= maxPages; page++) {
    const batch = extract(await auto.listings({ ...query, zip, distance, page, limit: 50 }));
    if (pageSize === null) pageSize = batch.length;
    for (const x of batch) if (x.vin && !seen.has(x.vin)) { seen.add(x.vin); all.push(x); }
    if (batch.length === 0 || batch.length < pageSize) break;
  }
  return all;
}

// Normalized records for the alert routine.
export async function fetchAll(query) {
  return (await paginate(query)).map(normalize);
}

export function normalize(rec) {
  const v = rec.vehicle ?? {};
  const r = rec.retailListing ?? {};
  const h = rec.history && typeof rec.history === 'object' ? rec.history : null;
  return {
    vin: rec.vin,
    createdAt: rec.createdAt ?? '',
    daysOnMarket: rec.createdAt ? Math.max(0, Math.floor((Date.now() - Date.parse(rec.createdAt)) / 86400000)) : null,
    year: v.year ?? '',
    make: v.make ?? '',
    model: v.model ?? '',
    trim: v.trim ?? '',
    vehicle: [v.year, v.make, v.model, v.trim].filter(Boolean).join(' '),
    fuel: 'Hybrid', // derived: Auto.dev raw `fuel` mislabels hybrids as "Gasoline"
    miles: typeof r.miles === 'number' ? r.miles : null,
    price: typeof r.price === 'number' ? r.price : null,
    baseMsrp: v.baseMsrp ?? null,
    baseInvoice: v.baseInvoice ?? null,
    city: r.city ?? '',
    state: r.state ?? '',
    location: [r.city, r.state].filter(Boolean).join(', '),
    dealer: r.dealer ?? '',
    series: v.series ?? '',
    drivetrain: v.drivetrain ?? '',
    exteriorColor: v.exteriorColor ?? '',
    interiorColor: v.interiorColor ?? '',
    cpo: r.cpo ?? false,
    vdp: r.vdp ?? '',
    primaryImage: r.primaryImage ?? '',
    carfaxUrl: r.carfaxUrl ?? '',
    historyKnown: !!h,
    accidents: h ? h.accidents : null,
    accidentCount: h ? h.accidentCount : null,
    ownerCount: h ? h.ownerCount : null,
    usageType: h ? h.usageType : null,
  };
}
