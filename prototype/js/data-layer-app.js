/*
 * SET 2 prototype — UI wiring. Demonstrates the live-data chain WITHOUT the engine
 * or types changing: a "listing" pick + region → resolveVehicle() → computeTco().
 * The Name/Year/Price/Mileage inputs stand in for what a scraped Listing will supply.
 */

const BASE_ASSUMPTIONS = {
  holdingYears: 5,
  annualMiles: 12000,
  salesTaxRate: 0.06,
  registrationAnnual: 150,
  fuelPricePerGallon: 3.5,
  electricityPricePerKWh: 0.16,
  financing: { enabled: false, new: { downPct: 0.1, apr: 0.069, termYears: 5 }, used: { downPct: 0.15, apr: 0.099, termYears: 5 } },
};

const PROV_LABEL = { listing: 'listing', segment: 'segment table', region: 'region', derived: 'derived' };
const usd = (n) => '$' + Math.round(n).toLocaleString('en-US');
const cents = (n) => (n * 100).toFixed(1) + '¢';

function el(tag, attrs, children) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) { if (k === 'class') e.className = attrs[k]; else if (k === 'html') e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]); }
  (children || []).forEach((c) => e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return e;
}

function option(value, label, selected) {
  const o = el('option', { value }, [label]);
  if (selected) o.selected = true;
  return o;
}

function field(labelText, control) {
  return el('label', { class: 'dl-field' }, [el('span', { class: 'dl-field-label' }, [labelText]), control]);
}

const STATE = { name: '', year: 2023, price: 30000, mileage: 24000, segment: 'suv-compact', powertrain: 'gas', condition: 'used', region: 'national', holdingYears: 5, annualMiles: 12000 };

function buildControls() {
  const segSel = el('select', { id: 'f-segment' }, SEGMENT_LIST.map((s) => option(s.key, s.label, s.key === STATE.segment)));
  const ptSel = el('select', { id: 'f-powertrain' }, [option('gas', 'Gas', true), option('hybrid', 'Hybrid'), option('ev', 'EV')]);
  const condSel = el('select', { id: 'f-condition' }, [option('new', 'New'), option('used', 'Used', true)]);
  const regSel = el('select', { id: 'f-region' }, REGION_LIST.map((r) => option(r.key, r.label, r.key === STATE.region)));

  const listingBox = el('div', { class: 'dl-card' }, [
    el('h3', { class: 'dl-tag-listing' }, ['Listing fields ', el('small', {}, ['(a scrape will fill these)'])]),
    el('div', { class: 'dl-grid' }, [
      field('Name', el('input', { id: 'f-name', type: 'text', placeholder: 'e.g. 2023 RAV4 XLE', value: STATE.name })),
      field('Year', el('input', { id: 'f-year', type: 'number', value: STATE.year })),
      field('Price ($)', el('input', { id: 'f-price', type: 'number', value: STATE.price })),
      field('Mileage', el('input', { id: 'f-mileage', type: 'number', value: STATE.mileage })),
    ]),
  ]);

  const pickBox = el('div', { class: 'dl-card' }, [
    el('h3', {}, ['Classify the car']),
    el('div', { class: 'dl-grid' }, [field('Segment', segSel), field('Powertrain', ptSel), field('Condition', condSel), field('Region', regSel)]),
  ]);

  const assumeBox = el('div', { class: 'dl-card' }, [
    el('h3', {}, ['Shared assumptions']),
    el('div', { class: 'dl-grid' }, [
      field('Holding yrs', el('input', { id: 'f-hold', type: 'number', value: STATE.holdingYears })),
      field('Miles / yr', el('input', { id: 'f-miles', type: 'number', value: STATE.annualMiles })),
    ]),
  ]);

  return el('div', {}, [listingBox, pickBox, assumeBox]);
}

function readState() {
  const g = (id) => document.getElementById(id);
  STATE.name = g('f-name').value;
  STATE.year = +g('f-year').value;
  STATE.price = +g('f-price').value;
  STATE.mileage = +g('f-mileage').value;
  STATE.segment = g('f-segment').value;
  STATE.powertrain = g('f-powertrain').value;
  STATE.condition = g('f-condition').value;
  STATE.region = g('f-region').value;
  STATE.holdingYears = +g('f-hold').value;
  STATE.annualMiles = +g('f-miles').value;
}

const VEHICLE_FIELDS = [
  ['name', 'Name', (x) => x], ['purchasePrice', 'Purchase price', usd], ['condition', 'Condition', (x) => x],
  ['powertrain', 'Powertrain', (x) => x], ['mpg', 'MPG', (x) => x || '—'], ['miPerKWh', 'mi / kWh', (x) => x || '—'],
  ['ageAtPurchase', 'Age at purchase', (x) => x + ' yr'], ['odometerAtPurchase', 'Odometer', (x) => x.toLocaleString()],
  ['annualDepRate', 'Deprec. rate', (x) => (x * 100).toFixed(0) + '%/yr'], ['insuranceAnnual', 'Insurance / yr', usd],
  ['maintenanceAnnual', 'Maintenance / yr', usd], ['repairAnnual', 'Repair / yr', usd],
  ['warrantyYears', 'Warranty yrs', (x) => x], ['warrantyMiles', 'Warranty mi', (x) => x.toLocaleString()],
  ['incentives', 'Incentives', usd], ['resaleValue', 'Resale (5yr)', (x) => x == null ? 'auto-seeded' : usd(x)],
];

function provPill(field) {
  const p = PROVENANCE[field] || 'derived';
  return el('span', { class: 'dl-pill dl-pill-' + p }, [PROV_LABEL[p]]);
}

function render() {
  readState();
  const v = resolveVehicle({ name: STATE.name, segment: STATE.segment, powertrain: STATE.powertrain, condition: STATE.condition, purchasePrice: STATE.price, year: STATE.year, mileage: STATE.mileage }, STATE.region);
  const a = regionAssumptions(STATE.region, Object.assign({}, BASE_ASSUMPTIONS, { holdingYears: STATE.holdingYears, annualMiles: STATE.annualMiles }));
  const r = computeTco(v, a);

  // Resolved vehicle table
  const rows = VEHICLE_FIELDS.map(([key, label, fmt]) =>
    el('tr', {}, [el('td', { class: 'dl-k' }, [label]), el('td', { class: 'dl-v' }, [String(fmt(v[key]))]), el('td', {}, [provPill(key)])]));
  const vehicleTable = el('table', { class: 'dl-table', id: 'resolved-table' }, [el('tbody', {}, rows)]);

  // Region assumptions
  const reg = REFERENCE.regions[STATE.region];
  const regList = el('ul', { class: 'dl-list' }, [
    el('li', {}, ['Fuel: $' + reg.fuelPricePerGallon.toFixed(2) + '/gal']),
    el('li', {}, ['Electricity: $' + reg.electricityPricePerKWh.toFixed(2) + '/kWh']),
    el('li', {}, ['Sales tax: ' + (reg.salesTaxRate * 100).toFixed(2) + '%']),
    el('li', {}, ['Registration: $' + reg.registrationAnnual + '/yr']),
    el('li', {}, ['Insurance mult: ×' + reg.insuranceMultiplier.toFixed(2)]),
  ]);

  // TCO result
  const catRows = Object.keys(r.byCategory).map((k) => el('li', {}, [k + ': ' + usd(r.byCategory[k])]));
  const tco = el('div', {}, [
    el('div', { class: 'dl-metrics' }, [
      el('div', { class: 'dl-metric' }, [el('div', { class: 'dl-metric-num', id: 'tco-total' }, [usd(r.total)]), el('div', { class: 'dl-metric-lab' }, ['Total TCO'])]),
      el('div', { class: 'dl-metric' }, [el('div', { class: 'dl-metric-num' }, [usd(r.perYear)]), el('div', { class: 'dl-metric-lab' }, ['Per year'])]),
      el('div', { class: 'dl-metric' }, [el('div', { class: 'dl-metric-num' }, [cents(r.perMile)]), el('div', { class: 'dl-metric-lab' }, ['Per mile'])]),
    ]),
    el('ul', { class: 'dl-list' }, catRows),
  ]);

  const out = document.getElementById('output');
  out.innerHTML = '';
  out.appendChild(el('div', { class: 'dl-results' }, [
    el('div', { class: 'dl-card' }, [el('h3', {}, ['Resolved vehicle ', el('small', {}, ['(every field editable downstream)'])]), vehicleTable]),
    el('div', { class: 'dl-card' }, [el('h3', { class: 'dl-tag-region' }, ['Region assumptions']), regList]),
    el('div', { class: 'dl-card' }, [el('h3', {}, ['Computed TCO']), tco]),
  ]));
}

// --- Live listings (Set 1, via the local scrape proxy) ---------------------
const PROXY = 'http://localhost:8124';

async function fetchLive() {
  const zip = document.getElementById('f-zip').value || '60601';
  const radius = document.getElementById('f-radius').value || '25';
  const status = document.getElementById('live-status');
  const results = document.getElementById('live-results');
  status.textContent = 'Fetching from Autotrader…';
  results.innerHTML = '';
  try {
    const res = await fetch(PROXY + '/api/search?zip=' + encodeURIComponent(zip) + '&radius=' + encodeURIComponent(radius));
    const data = await res.json();
    if (!data.listings || !data.listings.length) { status.textContent = 'No listings returned (' + (data.error || 'empty') + ').'; return; }
    status.textContent = data.listings.length + ' live listings · ' + data.note + ' · fetched ' + new Date(data.fetchedAt).toLocaleTimeString();
    data.listings.forEach((L) => results.appendChild(listingCard(L)));
  } catch (e) {
    status.innerHTML = 'Could not reach the proxy. Start it first: <code>node proxy/server.js 8124</code>';
  }
}

function listingCard(L) {
  const title = [L.year, L.make, L.model, L.trim].filter(Boolean).join(' ');
  const btn = el('button', { type: 'button' }, ['Use this car →']);
  btn.addEventListener('click', () => useListing(L));
  return el('div', { class: 'dl-card dl-listing' }, [
    el('div', { class: 'dl-listing-title' }, [title]),
    el('div', { class: 'dl-listing-price' }, [usd(L.price)]),
    el('div', { class: 'dl-listing-meta' }, [(L.mileage != null ? L.mileage.toLocaleString() + ' mi' : 'new') + ' · ' + L.condition]),
    el('div', {}, [el('span', { class: 'dl-pill dl-pill-segment' }, [L.segment]), ' ', el('span', { class: 'dl-pill dl-pill-derived' }, [L.powertrain])]),
    el('div', { class: 'dl-listing-meta' }, [[L.dealer, L.location].filter(Boolean).join(' · ')]),
    btn,
  ]);
}

function setVal(id, v) { const e = document.getElementById(id); if (e) e.value = v; }

function useListing(L) {
  STATE.name = [L.year, L.make, L.model, L.trim].filter(Boolean).join(' ');
  STATE.year = L.year; STATE.price = L.price; STATE.mileage = L.mileage || 0;
  STATE.segment = L.segment; STATE.powertrain = L.powertrain; STATE.condition = L.condition;
  setVal('f-name', STATE.name); setVal('f-year', STATE.year); setVal('f-price', STATE.price); setVal('f-mileage', STATE.mileage);
  setVal('f-segment', STATE.segment); setVal('f-powertrain', STATE.powertrain); setVal('f-condition', STATE.condition);
  render();
  document.getElementById('output').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function init() {
  const root = document.getElementById('app');
  root.appendChild(buildControls());
  root.addEventListener('input', render);
  root.addEventListener('change', render);
  document.getElementById('fetch-live').addEventListener('click', fetchLive);
  document.getElementById('asof').textContent = 'Assumptions as of ' + REFERENCE.asOf + ' — ' + REFERENCE.source;
  render();
}

document.addEventListener('DOMContentLoaded', init);
