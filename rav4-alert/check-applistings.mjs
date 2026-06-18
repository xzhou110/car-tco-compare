// Validate the generated app snapshot against the app's `Listing` contract.
import { readFileSync } from 'node:fs';
const data = JSON.parse(readFileSync(new URL('../app/public/data/listings.json', import.meta.url), 'utf8'));
const L = data.listings;
const required = ['source', 'url', 'vin', 'year', 'make', 'model', 'trim', 'price', 'mileage',
  'condition', 'segment', 'powertrain', 'mpg', 'bodyStyle', 'fuelType', 'dealer', 'location', 'fetchedAt'];
const validCond = new Set(['new', 'used']);
const validPt = new Set(['gas', 'hybrid', 'ev']);
const validSeg = new Set(['car-economy', 'car-midsize', 'car-luxury', 'car-sport', 'suv-compact',
  'suv-midsize', 'suv-large', 'luxury-suv', 'truck', 'minivan']);

const problems = [];
for (const [i, r] of L.entries()) {
  for (const k of required) if (!(k in r)) problems.push(`#${i} missing ${k}`);
  if (!validCond.has(r.condition)) problems.push(`#${i} bad condition: ${r.condition}`);
  if (!validPt.has(r.powertrain)) problems.push(`#${i} bad powertrain: ${r.powertrain}`);
  if (!validSeg.has(r.segment)) problems.push(`#${i} bad segment: ${r.segment}`);
}

const dist = (key) => { const m = {}; for (const r of L) m[r[key]] = (m[r[key]] || 0) + 1; return m; };
const years = L.map((r) => r.year).filter(Boolean);
const prices = L.map((r) => r.price).filter((n) => typeof n === 'number');
console.log('count field:', data.count, '| array length:', L.length, '| source:', data.source);
console.log('powertrain:', JSON.stringify(dist('powertrain')));
console.log('condition:', JSON.stringify(dist('condition')));
console.log('segment:', JSON.stringify(dist('segment')));
console.log('year range:', Math.min(...years), '-', Math.max(...years));
console.log('price range: $' + Math.min(...prices).toLocaleString(), '- $' + Math.max(...prices).toLocaleString());
console.log('missing price:', L.filter((r) => r.price == null).length, '| missing mileage:', L.filter((r) => r.mileage == null).length);
console.log('sample[0]:', JSON.stringify(L[0]));
console.log(problems.length ? `❌ ${problems.length} problems:\n` + problems.slice(0, 10).join('\n') : '✅ all 1863 records valid against the Listing shape');
