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
    // Multi-select (makes/models/fuels arrays) with single-value backward-compat for old watchlists.
    const makes = filters.makes ?? (filters.make ? [filters.make] : null);
    if (makes?.length) q = q.in('make', makes);
    const models = filters.models ?? (filters.model ? [filters.model] : null);
    if (models?.length) q = q.in('model', models);
    const fuels = filters.fuels ?? (filters.powertrain ? [filters.powertrain] : null);
    if (fuels?.length) q = q.in('powertrain', fuels);
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

// Strip any stray BOM/whitespace a mis-set secret may carry — a leading U+FEFF makes the
// Resend client throw "Cannot convert argument to a ByteString" while building the auth header.
const RESEND_KEY = (process.env.RESEND_API_KEY || '').replace(/[^\x21-\x7E]/g, '');
const resend = DRY ? null : new Resend(RESEND_KEY);

// The repository is public, so its Actions logs are too: a subscriber is named by the first
// 8 characters of their id, never their address, and provider error text is scrubbed of the
// address (Resend or Supabase may echo it) and of any other address, and logged as message
// text only.
const label = (sub) => String(sub.id).slice(0, 8);
const errText = (e) => (typeof e === 'string' ? e : e?.message || e?.name || 'unknown error');
const ANY_EMAIL = /[^\s@<>()"']+@[^\s@<>()"']+\.[A-Za-z]{2,}/g;
const scrub = (text, email) => (email
  ? String(text).replace(new RegExp(String(email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '<subscriber>')
  : String(text)).replace(ANY_EMAIL, '<email>');

const { data: subs, error: subErr } = await supabase.from('subscribers').select('*')
  .eq('confirmed', true).is('unsubscribed_at', null);
if (subErr) { console.error('❌ subscribers:', subErr.message); process.exit(1); }
console.log(`${subs.length} confirmed subscriber(s).`);

// One subscriber's digest. Throws on any failure (watchlists query, match, send, record)
// so the loop below counts it and goes on to the next subscriber.
async function sendDigest(sub) {
  const who = label(sub);
  const { data: wls, error: wlErr } = await supabase.from('watchlists').select('*')
    .eq('subscriber_id', sub.id).eq('active', true).order('created_at');
  if (wlErr) throw new Error(`watchlists: ${wlErr.message}`); // an error is not "no watchlists"
  if (!wls?.length) { console.log(`  ${who}: no active watchlists, skip`); return; }

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

  const intro = `<p style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.4;margin:0 0 6px">Hi 👋</p>
    <p style="font-family:system-ui,-apple-system,sans-serif;font-size:13px;line-height:1.6;color:#444;margin:0 0 14px">Here are the lowest <b>total-cost-to-own</b> cars matching your ${wls.length} preference${wls.length === 1 ? '' : 's'} right now${totalNew ? ` — including <b>${totalNew} new</b> since last time` : ''}. The 🏆 top 10 by 5-year cost are first, then a breakdown per preference; full detail (every match, all columns) is in the attached spreadsheet.</p>`;
  const unsubscribeUrl = sub.unsubscribe_token ? `${APP_URL}#/unsubscribe?token=${sub.unsubscribe_token}` : '';
  const html = buildHtml([topTcoSection(allCars, 10), ...sections], { intro, unsubscribeUrl });
  const xlsx = await buildWorkbook(perList);
  writeFileSync(here(`./out/cron_${who}.html`), html, 'utf8');
  writeFileSync(here(`./out/cron_${who}.xlsx`), xlsx); // for inspection (also attached on send)

  const today = new Date().toISOString().slice(0, 10);
  const subject = `Your car deal alert — ${totalMatches} match${totalMatches === 1 ? '' : 'es'}`
    + (totalNew ? ` · ${totalNew} new` : '') + ` — ${today}`;
  console.log(`  ${who}: ${totalMatches} matches across ${wls.length} watchlist(s), ${totalNew} new`);

  if (DRY) { console.log('   [dry] not sending / not recording'); return; }

  const { data, error } = await resend.emails.send({
    from: SETTINGS.sender, to: sub.email, subject, html,
    attachments: [{ filename: `deal-alerts-${today}.xlsx`, content: xlsx }],
  });
  if (error) throw new Error(`Resend: ${errText(error)}`); // nothing recorded: the mail did not go

  // Record everything we just showed (one batched write AFTER a confirmed send).
  const sentRows = perWl.flatMap(({ wl, kept }) => kept.map((c) => ({ watchlist_id: wl.id, vin: c.vin })));
  let upFailed = 0;
  for (let i = 0; i < sentRows.length; i += 500) {
    const { error: upErr } = await supabase.from('sent_state').upsert(sentRows.slice(i, i + 500), { onConflict: 'watchlist_id,vin' });
    if (upErr) { console.error('   ⚠️ sent_state upsert:', scrub(upErr.message, sub.email)); upFailed++; }
  }
  // Mail went out but its NEW badges will repeat next time, so this still counts as a failure.
  if (upFailed) throw new Error(`sent (id ${data?.id}), but ${upFailed} sent_state batch(es) were not recorded`);
  console.log(`   ✅ sent (id ${data?.id}); recorded ${sentRows.length} sent rows.`);
}

// Every subscriber gets a turn even when an earlier one fails; any failure turns the run red.
let failed = 0;
for (const sub of subs) {
  try {
    await sendDigest(sub);
  } catch (e) {
    failed++;
    console.error(`  ❌ ${label(sub)}:`, scrub(errText(e), sub.email));
  }
}
if (failed) { console.error(`${failed} of ${subs.length} subscriber(s) failed`); process.exitCode = 1; }

console.log('Done.');
