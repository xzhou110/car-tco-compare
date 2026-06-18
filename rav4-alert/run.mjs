// Orchestrator: fetch both lists → filter → render → email via Resend → persist state.
// Run:  npm run send        (needs AUTODEV_API_KEY and RESEND_API_KEY in env)
//       npm run dry         (build email + workbook, write preview, DO NOT send)

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { Resend } from 'resend';
import { SETTINGS, LISTS } from './config.mjs';
import { fetchAll } from './autodev.mjs';
import { filterList, summarySection, buildHtml, buildCsv, buildWorkbook, topTcoSection } from './digest.mjs';
import { tcoForCar } from './tco.mjs';

const DRY = process.argv.includes('--dry');
const here = (p) => new URL(p, import.meta.url);
const STATE = here('./state/seen.json');

if (!process.env.AUTODEV_API_KEY) { console.error('❌ AUTODEV_API_KEY not set.'); process.exit(1); }
if (!DRY && !process.env.RESEND_API_KEY) { console.error('❌ RESEND_API_KEY not set.'); process.exit(1); }

// load "seen" VIN state
let seen = new Set();
if (existsSync(STATE)) { try { seen = new Set(JSON.parse(readFileSync(STATE, 'utf8'))); } catch {} }
const firstRun = seen.size === 0;

mkdirSync(here('./out/'), { recursive: true });
mkdirSync(here('./state/'), { recursive: true });

const sections = [];
const perList = [];
const counts = [];
const newVins = new Set();
const allKeptVins = [];
const allCars = [];

for (const list of LISTS) {
  const cars = await fetchAll(list.query);
  const { kept, dropped } = filterList(cars, list);
  for (const c of kept) { allKeptVins.push(c.vin); if (!seen.has(c.vin)) newVins.add(c.vin); }
  for (const c of kept) c.tco = tcoForCar(c);
  allCars.push(...kept);

  sections.push(summarySection(list, kept, newVins));
  writeFileSync(here(`./out/${list.id}_detail.csv`), buildCsv(kept), 'utf8'); // handy raw CSV
  perList.push({ tab: list.name.split('—')[0].trim(), cars: kept });          // → workbook tab

  const nNew = kept.filter((c) => newVins.has(c.vin)).length;
  counts.push({ id: list.id, total: kept.length, nNew, dropped, fetched: cars.length });
  console.log(`${list.name}: ${kept.length} matches (${nNew} new) from ${cars.length} fetched · dropped ${JSON.stringify(dropped)}`);
}

// one .xlsx with a tab per list
const xlsxBuf = await buildWorkbook(perList);
writeFileSync(here('./out/rav4_listings.xlsx'), xlsxBuf);
const attachments = [{ filename: 'rav4_listings.xlsx', content: xlsxBuf }];

const html = buildHtml([topTcoSection(allCars, 10), ...sections]);
writeFileSync(here('./out/preview.html'), html, 'utf8');

const totalNew = newVins.size;
const totalMatches = counts.reduce((s, c) => s + c.total, 0);
const subject = `RAV4 Hybrid alert — ${counts.map((c) => `${c.id === 'list1' ? 'L1' : 'L2'}:${c.total}`).join(' · ')}` +
  (firstRun ? ' (baseline)' : ` · ${totalNew} new`) + ` — ${new Date().toISOString().slice(0, 10)}`;

if (DRY) {
  console.log(`\n[dry run] No email sent. Preview → out/preview.html · workbook → out/rav4_listings.xlsx`);
  console.log(`Subject would be: ${subject}`);
  process.exit(0);
}

const resend = new Resend(process.env.RESEND_API_KEY);
const { data, error } = await resend.emails.send({
  from: SETTINGS.sender,
  to: SETTINGS.recipient,
  subject,
  html,
  attachments,
});

if (error) { console.error('❌ Resend error:', error); process.exit(1); }

writeFileSync(STATE, JSON.stringify([...new Set([...seen, ...allKeptVins])], null, 0), 'utf8');
console.log(`\n✅ Email sent to ${SETTINGS.recipient} (id ${data?.id}). ${totalMatches} matches, ${totalNew} new. State saved.`);
