// Deal Alerts cron — the per-subscriber digest job. Reads watchlists from Supabase,
// filters the listings_cache (NO Auto.dev calls), computes TCO, finds NEW listings
// vs sent_state, renders the digest (reusing digest.mjs/tco.mjs) and emails it.
//
// Run:  node alert-cron.mjs            (needs SUPABASE_SECRET_KEY + RESEND_API_KEY)
//       node alert-cron.mjs --dry      (build, write previews, DO NOT send/record)
//
// One email per confirmed subscriber: 🏆 Top-10 across their watchlists, then one
// summary table per watchlist, with a single .xlsx attachment (one tab per watchlist).

import { mkdirSync, writeFileSync } from 'node:fs';
import { Resend } from 'resend';
import { supabase } from './supabase/client.mjs';
import { SETTINGS, APP_URL } from './config.mjs';
import { filterList, summarySection, buildHtml, buildWorkbook, topTcoSection, rankTopVins } from './digest.mjs';
import { tcoForCar } from './tco.mjs';
import { withinRadius } from './geo.mjs';

const DRY = process.argv.includes('--dry');
const here = (p) => new URL(p, import.meta.url);
if (!DRY && !process.env.RESEND_API_KEY) { console.error('❌ RESEND_API_KEY not set.'); process.exit(1); }
mkdirSync(here('./out/'), { recursive: true });

// Map a listings_cache row to the normalized "car" shape digest.mjs/tco.mjs expect.
function cacheRowToCar(r) {
  const createdAt = r.raw?.createdAt || r.first_seen || '';
  const h = r.history && typeof r.history === 'object' ? r.history : null;
  return {
    vin: r.vin, createdAt,
    year: r.year, make: r.make, model: r.model, trim: r.trim || '',
    vehicle: [r.year, r.make, r.model, r.trim].filter(Boolean).join(' '),
    fuel: r.powertrain === 'hybrid' ? 'Hybrid' : 'Gas',
    miles: r.mileage, price: r.price,
    baseMsrp: null, baseInvoice: null,
    city: r.city || '', state: r.state || '', location: [r.city, r.state].filter(Boolean).join(', '),
    dealer: r.dealer || '', series: '', drivetrain: '', exteriorColor: '', interiorColor: '',
    cpo: false, vdp: r.vdp || '', primaryImage: '', carfaxUrl: r.carfax_url || '',
    historyKnown: !!h,
    accidents: h ? h.accidents : null, accidentCount: h ? h.accidentCount : null,
    ownerCount: h ? h.ownerCount : null, usageType: h ? h.usageType : null,
  };
}

// Page through a query past PostgREST's 1000-row cap (buildQuery returns a FRESH
// query each call, since Supabase builders are single-use).
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

// Pull cache rows matching a watchlist's filters (SQL where possible; trim in JS).
async function matchWatchlist(filters) {
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
  // Radius filter by ZIP centroid (no-op until cache rows carry lat/lng — see geo.mjs).
  if (filters.zip && filters.radius) rows = withinRadius(rows, filters.zip, filters.radius);
  let cars = rows.map(cacheRowToCar);
  // Trim filter: the explicit trims chosen in the form (exact, case-insensitive).
  const trims = Array.isArray(filters.trims) ? filters.trims.map((t) => String(t).toLowerCase()) : [];
  if (trims.length) cars = cars.filter((c) => c.trim && trims.includes(String(c.trim).toLowerCase()));
  // Legacy fallback for old watchlists: "XLE and above" (RAV4 only) when no trims given.
  const xle = trims.length === 0 && !!filters.xlePlusOnly && /rav4/i.test(filters.model || '');
  const { kept } = filterList(cars, { xlePlusOnly: xle }); // legacy xle + price sort
  for (const c of kept) c.tco = tcoForCar(c);
  return kept;
}

const resend = DRY ? null : new Resend(process.env.RESEND_API_KEY);

const { data: subs, error: subErr } = await supabase.from('subscribers').select('*')
  .eq('confirmed', true).is('unsubscribed_at', null);
if (subErr) { console.error('❌ subscribers:', subErr.message); process.exit(1); }
console.log(`${subs.length} confirmed subscriber(s).`);

for (const sub of subs) {
  const { data: wls } = await supabase.from('watchlists').select('*')
    .eq('subscriber_id', sub.id).eq('active', true).order('created_at');
  if (!wls?.length) { console.log(`  ${sub.email}: no active watchlists, skip`); continue; }

  // First pass: matches + which VINs are NEW (not yet emailed for that watchlist).
  const perWl = [];
  const newVins = new Set();
  for (const wl of wls) {
    const kept = await matchWatchlist(wl.filters || {});
    const sent = await selectAll(() => supabase.from('sent_state').select('vin').eq('watchlist_id', wl.id));
    const sentSet = new Set(sent.map((s) => s.vin));
    for (const c of kept) if (!sentSet.has(c.vin)) newVins.add(c.vin);
    perWl.push({ wl, kept });
  }

  const allCars = perWl.flatMap(({ kept }) => kept);
  const topVins = rankTopVins(allCars, 10);
  const sections = perWl.map(({ wl, kept }) => summarySection({ name: wl.name }, kept, newVins, topVins));
  const perList = perWl.map(({ wl, kept }) => ({ tab: wl.name, cars: kept }));
  const totalMatches = allCars.length;
  const totalNew = newVins.size;

  const intro = `<p style="font:15px system-ui;margin:0 0 4px">Hi 👋</p>
    <p style="font:13px system-ui;color:#444;margin:0 0 14px;line-height:1.5">Here are the lowest <b>total-cost-to-own</b> cars matching your ${wls.length} preference${wls.length === 1 ? '' : 's'} right now${totalNew ? ` — including <b>${totalNew} new</b> since last time` : ''}. The 🏆 top 10 by 5-year cost are first, then a breakdown per preference; full detail (every match, all columns) is in the attached spreadsheet.</p>`;
  const unsubscribeUrl = sub.unsubscribe_token ? `${APP_URL}#/unsubscribe?token=${sub.unsubscribe_token}` : '';
  const html = buildHtml([topTcoSection(allCars, 10), ...sections], { intro, unsubscribeUrl });
  const xlsx = await buildWorkbook(perList);
  const slug = sub.email.replace(/[^a-z0-9]/gi, '_');
  writeFileSync(here(`./out/cron_${slug}.html`), html, 'utf8');
  writeFileSync(here(`./out/cron_${slug}.xlsx`), xlsx); // for inspection (also attached on send)

  const today = new Date().toISOString().slice(0, 10);
  const subject = `Your car deal alert — ${totalMatches} match${totalMatches === 1 ? '' : 'es'}`
    + (totalNew ? ` · ${totalNew} new` : '') + ` — ${today}`;
  console.log(`  ${sub.email}: ${totalMatches} matches across ${wls.length} watchlist(s), ${totalNew} new`);

  if (DRY) { console.log('   [dry] not sending / not recording'); continue; }

  const { data, error } = await resend.emails.send({
    from: SETTINGS.sender, to: sub.email, subject, html,
    attachments: [{ filename: `deal-alerts-${today}.xlsx`, content: xlsx }],
  });
  if (error) { console.error('   ❌ Resend:', error); continue; }

  // Record everything we just showed (one batched write AFTER a confirmed send).
  const sentRows = perWl.flatMap(({ wl, kept }) => kept.map((c) => ({ watchlist_id: wl.id, vin: c.vin })));
  for (let i = 0; i < sentRows.length; i += 500) {
    const { error: upErr } = await supabase.from('sent_state').upsert(sentRows.slice(i, i + 500), { onConflict: 'watchlist_id,vin' });
    if (upErr) console.error('   ⚠️ sent_state upsert:', upErr.message);
  }
  console.log(`   ✅ sent (id ${data?.id}); recorded ${sentRows.length} sent rows.`);
}

console.log('Done.');
