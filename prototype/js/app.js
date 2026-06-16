/*
 * UI wiring (v0.2) — multi-car compare (2–5), save/load profiles, per-condition financing.
 * Plain global script. Depends on data.js + tco.js globals.
 */

// ---------- constants ----------
const MAX_CARS = 6;
const MIN_CARS = 2;
const PROFILE_KEY = 'carTcoProfiles_v1';
const SESSION_KEY = 'carTcoSession_v1'; // full working state — auto-restored next visit
// per-slot accent colors (one per comparison slot, up to 6)
const COLORS = [
  { c: '#0f9b8e', soft: '#d6f1ee', ink: '#0b6f66' },
  { c: '#e08a1e', soft: '#fbe9cd', ink: '#a8650f' },
  { c: '#5b6ee0', soft: '#e1e6fb', ink: '#3a49aa' },
  { c: '#d6457f', soft: '#fbdbe8', ink: '#a82a5e' },
  { c: '#3f9a4e', soft: '#d8efdb', ink: '#2c7038' },
  { c: '#8b5cf6', soft: '#ece7fc', ink: '#6d28d9' },
];
const color = (i) => COLORS[i % COLORS.length];

// ---------- state ----------
const state = {
  assumptions: structuredClone(DEFAULT_ASSUMPTIONS),
  vehicles: [
    structuredClone(PRESETS.find((p) => p.id === 'rav4h-new')),
    structuredClone(PRESETS.find((p) => p.id === 'rav4h-used')),
  ],
};

// ---------- field schema ----------
const VEHICLE_FIELDS = [
  { key: 'name', type: 'text', group: 'Car', label: 'Nickname' },
  { key: 'condition', type: 'select', options: ['new', 'used'], group: 'Car', label: 'Condition' },
  { key: 'purchasePrice', type: 'number', group: 'Car', label: 'Price', pre: '$', step: 500 },
  { key: 'powertrain', type: 'select', options: ['gas', 'hybrid', 'ev'], group: 'Energy', label: 'Powertrain' },
  { key: 'mpg', type: 'number', group: 'Energy', label: 'Efficiency', suf: 'mpg', step: 1, showIf: 'notev' },
  { key: 'miPerKWh', type: 'number', group: 'Energy', label: 'Efficiency', suf: 'mi/kWh', step: 0.1, showIf: 'ev' },
  { key: 'resaleValue', type: 'number', group: 'Depreciation', label: 'Resale at sale', pre: '$', step: 500, auto: true, hint: 'blank = auto' },
  { key: 'ageAtPurchase', type: 'number', group: 'Depreciation', label: 'Age now', suf: 'yr', step: 1 },
  { key: 'odometerAtPurchase', type: 'number', group: 'Depreciation', label: 'Odometer', suf: 'mi', step: 1000 },
  { key: 'incentives', type: 'number', group: 'Depreciation', label: 'Incentives', pre: '$', step: 250, hint: 'EV credit etc' },
  { key: 'insuranceAnnual', type: 'number', group: 'Running costs', label: 'Insurance', pre: '$', suf: '/yr', step: 50 },
  { key: 'maintenanceAnnual', type: 'number', group: 'Running costs', label: 'Maintenance', pre: '$', suf: '/yr', step: 50, hint: 'incl. tires' },
  { key: 'repairAnnual', type: 'number', group: 'Running costs', label: 'Repairs', pre: '$', suf: '/yr', step: 50, hint: 'post-warranty' },
  { key: 'warrantyYears', type: 'number', group: 'Running costs', label: 'Warranty', suf: 'yr', step: 1, hint: 'from new' },
  { key: 'warrantyMiles', type: 'number', group: 'Running costs', label: 'Warranty', suf: 'mi', step: 5000, hint: 'from new' },
];
const GROUP_ORDER = ['Car', 'Energy', 'Depreciation', 'Running costs'];

// ---------- formatters ----------
const usd = (x) => (x < 0 ? '-$' : '$') + Math.abs(Math.round(x)).toLocaleString('en-US');
const usdK = (x) => (Math.abs(x) >= 1000 ? '$' + (x / 1000).toFixed(Math.abs(x) % 1000 === 0 ? 0 : 1) + 'k' : '$' + Math.round(x));
const cpm = (x) => (x * 100).toFixed(1) + '¢/mi';
const pctTxt = (x) => (x * 100).toFixed(0) + '%';

// ---------- profiles (localStorage) ----------
function loadProfiles() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; } catch (e) { return {}; }
}
function saveProfile(name, veh) {
  const p = loadProfiles();
  p[name] = structuredClone(veh);
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch (e) { alert('Could not save (storage unavailable).'); }
}
function deleteProfile(name) {
  const p = loadProfiles();
  delete p[name];
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch (e) {}
}

// ---------- session autosave/restore (survives closing the app) ----------
function saveSession() {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ v: 1, assumptions: state.assumptions, vehicles: state.vehicles }));
  } catch (e) { /* storage full/unavailable — fail silently */ }
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
}
function loadSession() {
  let s;
  try { s = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
  if (!s || !s.assumptions || !Array.isArray(s.vehicles) || s.vehicles.length < MIN_CARS || s.vehicles.length > MAX_CARS) return null;
  return s;
}
// Overlay saved data onto current defaults so new fields added later still get values.
function hydrateFromSession(s) {
  const a = structuredClone(DEFAULT_ASSUMPTIONS);
  Object.assign(a, s.assumptions);
  const sf = s.assumptions.financing || {};
  a.financing = structuredClone(DEFAULT_ASSUMPTIONS.financing);
  if (typeof sf.enabled === 'boolean') a.financing.enabled = sf.enabled;
  ['new', 'used'].forEach((c) => (a.financing[c] = Object.assign(structuredClone(DEFAULT_ASSUMPTIONS.financing[c]), sf[c] || {})));
  state.assumptions = a;
  const shape = PRESETS[0];
  state.vehicles = s.vehicles.map((v) => Object.assign(structuredClone(shape), v));
}

// ---------- form rendering ----------
function fieldHtml(idx, f, v) {
  const id = `v${idx}_${f.key}`;
  const showIf = f.showIf ? ` data-showif="${f.showIf}"` : '';
  const hint = f.hint ? `<em class="hint">${f.hint}</em>` : '';
  let control;
  if (f.type === 'select') {
    control = `<select id="${id}">${f.options.map((o) => `<option value="${o}"${v[f.key] === o ? ' selected' : ''}>${o.toUpperCase()}</option>`).join('')}</select>`;
  } else if (f.type === 'text') {
    control = `<input id="${id}" type="text" value="${escAttr(v[f.key] ?? '')}">`;
  } else {
    const val = f.auto ? (v[f.key] == null || v[f.key] === '' ? '' : v[f.key]) : v[f.key];
    const ph = f.auto ? ' placeholder="auto"' : '';
    const pre = f.pre ? `<span class="adorn">${f.pre}</span>` : '';
    const suf = f.suf ? `<span class="adorn suf">${f.suf}</span>` : '';
    control = `<span class="input-wrap">${pre}<input id="${id}" type="number" step="${f.step ?? 'any'}" value="${val}"${ph}>${suf}</span>`;
  }
  return `<label class="field"${showIf}><span class="field-label">${f.label} ${hint}</span>${control}</label>`;
}

function loadSelectHtml(idx) {
  const presets = PRESETS.map((p) => `<option value="preset:${p.id}">${escapeHtml(p.name)}</option>`).join('');
  const profiles = loadProfiles();
  const names = Object.keys(profiles);
  const saved = names.map((n) => `<option value="saved:${escAttr(n)}">${escapeHtml(n)}</option>`).join('');
  return `<select class="load-select" id="v${idx}_load" title="Load a preset or saved car">
      <option value="">Load…</option>
      <optgroup label="Presets">${presets}</optgroup>
      ${saved ? `<optgroup label="Saved">${saved}</optgroup>` : ''}
    </select>`;
}

function vehicleCardHtml(idx, v) {
  const col = color(idx);
  const removable = state.vehicles.length > MIN_CARS;
  let html = `<div class="card vcard" id="vcard${idx}" style="border-top:3px solid ${col.c}">
      <div class="veh-head">
        <span class="veh-tag" style="background:${col.soft};color:${col.ink}">Car ${idx + 1}</span>
        <div class="veh-head-actions">
          ${loadSelectHtml(idx)}
          <button class="btn tiny save-btn" data-idx="${idx}" title="Save this car to your browser">💾</button>
          ${removable ? `<button class="btn tiny ghost remove-btn" data-idx="${idx}" title="Remove">✕</button>` : ''}
        </div>
      </div>`;
  const COLLAPSIBLE = new Set(['Depreciation', 'Running costs']);
  for (const group of GROUP_ORDER) {
    const fields = VEHICLE_FIELDS.filter((f) => f.group === group);
    const inner = `<div class="grid">${fields.map((f) => fieldHtml(idx, f, v)).join('')}</div>`;
    if (COLLAPSIBLE.has(group)) {
      html += `<details class="fgroup"><summary><span>${group}</span><span class="chev">›</span></summary>${inner}</details>`;
    } else {
      html += `<fieldset><legend>${group}</legend>${inner}</fieldset>`;
    }
  }
  return html + `</div>`;
}

function assumptionsHtml() {
  const a = state.assumptions;
  const f = a.financing;
  const bracket = (cond, b) => `
      <div class="fin-row">
        <span class="fin-cond">${cond}</span>
        <label class="mini"><span>Down</span><span class="input-wrap"><input id="as_${cond}_down" type="number" step="1" value="${+(b.downPct * 100).toFixed(1)}"><span class="adorn suf">%</span></span></label>
        <label class="mini"><span>APR</span><span class="input-wrap"><input id="as_${cond}_apr" type="number" step="0.1" value="${+(b.apr * 100).toFixed(2)}"><span class="adorn suf">%</span></span></label>
        <label class="mini"><span>Term</span><span class="input-wrap"><input id="as_${cond}_term" type="number" step="1" value="${b.termYears}"><span class="adorn suf">yr</span></span></label>
      </div>`;
  return `
    <div class="assume-grid">
      <label class="field"><span class="field-label">Holding period</span><span class="input-wrap"><input id="as_holdingYears" type="number" step="1" value="${a.holdingYears}"><span class="adorn suf">yr</span></span></label>
      <label class="field"><span class="field-label">Annual miles</span><span class="input-wrap"><input id="as_annualMiles" type="number" step="1000" value="${a.annualMiles}"><span class="adorn suf">mi</span></span></label>
      <label class="field"><span class="field-label">Sales tax</span><span class="input-wrap"><input id="as_salesTaxRate" type="number" step="0.5" value="${+(a.salesTaxRate * 100).toFixed(2)}"><span class="adorn suf">%</span></span></label>
      <label class="field"><span class="field-label">Registration (est)</span><span class="input-wrap"><span class="adorn">$</span><input id="as_registration" type="number" step="25" value="${a.registrationAnnual}"><span class="adorn suf">/yr</span></span></label>
      <label class="field"><span class="field-label">Fuel price</span><span class="input-wrap"><span class="adorn">$</span><input id="as_fuelPricePerGallon" type="number" step="0.05" value="${a.fuelPricePerGallon}"><span class="adorn suf">/gal</span></span></label>
      <label class="field"><span class="field-label">Electricity</span><span class="input-wrap"><span class="adorn">$</span><input id="as_electricityPricePerKWh" type="number" step="0.01" value="${a.electricityPricePerKWh}"><span class="adorn suf">/kWh</span></span></label>
    </div>
    <div class="fin-block">
      <label class="switch"><input id="as_fin_enabled" type="checkbox"${f.enabled ? ' checked' : ''}><span>Finance (interest counts toward TCO)</span></label>
      <div class="fin-brackets fin-only">
        <p class="hint-line">New and used get different terms — each car uses the bracket matching its condition. Down payment is a % of price.</p>
        ${bracket('new', f.new)}
        ${bracket('used', f.used)}
      </div>
    </div>`;
}

// ---------- reading DOM -> state ----------
const num = (id) => parseFloat(document.getElementById(id).value) || 0;
const rawVal = (id) => document.getElementById(id).value;

function syncAssumptions() {
  const a = state.assumptions;
  a.holdingYears = Math.max(1, Math.round(num('as_holdingYears')) || 1);
  a.annualMiles = Math.max(0, num('as_annualMiles'));
  a.salesTaxRate = num('as_salesTaxRate') / 100;
  a.registrationAnnual = num('as_registration');
  a.fuelPricePerGallon = num('as_fuelPricePerGallon');
  a.electricityPricePerKWh = num('as_electricityPricePerKWh');
  a.financing.enabled = document.getElementById('as_fin_enabled').checked;
  for (const cond of ['new', 'used']) {
    a.financing[cond].downPct = num(`as_${cond}_down`) / 100;
    a.financing[cond].apr = num(`as_${cond}_apr`) / 100;
    a.financing[cond].termYears = Math.max(1, Math.round(num(`as_${cond}_term`)) || 1);
  }
}

function syncVehicle(idx) {
  const v = state.vehicles[idx];
  for (const f of VEHICLE_FIELDS) {
    const id = `v${idx}_${f.key}`;
    if (!document.getElementById(id)) continue;
    if (f.type === 'text' || f.type === 'select') v[f.key] = rawVal(id);
    else if (f.auto) { const raw = rawVal(id); v[f.key] = raw === '' ? null : parseFloat(raw) || 0; }
    else v[f.key] = num(id);
  }
}

// ---------- conditional UI ----------
function applyConditional(idx) {
  const isEv = state.vehicles[idx].powertrain === 'ev';
  document.querySelectorAll(`#vcard${idx} [data-showif]`).forEach((el) => {
    const cond = el.getAttribute('data-showif');
    el.style.display = (cond === 'ev' && isEv) || (cond === 'notev' && !isEv) ? '' : 'none';
  });
  const seed = seedResaleValue(state.vehicles[idx], state.assumptions);
  const r = document.getElementById(`v${idx}_resaleValue`);
  if (r) r.placeholder = String(seed);
}

// ---------- recompute ----------
function recompute() {
  syncAssumptions();
  state.vehicles.forEach((_, i) => syncVehicle(i));
  document.querySelectorAll('.fin-only').forEach((el) => (el.style.display = state.assumptions.financing.enabled ? '' : 'none'));
  state.vehicles.forEach((_, i) => applyConditional(i));
  const results = state.vehicles.map((v) => computeTco(v, state.assumptions));
  renderResults(results);
  saveSession(); // persist working state on every change
}

// ---------- results ----------
function renderResults(results) {
  const Y = state.assumptions.holdingYears;
  const items = results.map((r, i) => ({ r, i, name: state.vehicles[i].name, col: color(i) }));
  const sorted = [...items].sort((x, y) => x.r.total - y.r.total);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const delta = worst.r.total - best.r.total;
  const fin = state.assumptions.financing.enabled;
  const rankById = {};
  sorted.forEach((it, idx) => (rankById[it.i] = idx + 1));

  // summary cards (ranked, cheapest highlighted)
  const cards = items
    .map(({ r, name, col, i }) => {
      const isBest = i === best.i;
      const rank = rankById[i];
      return `<div class="result-card${isBest ? ' best' : ''}" style="border-top-color:${col.c}">
        ${isBest ? '<span class="best-flag">🏆 cheapest</span>' : ''}
        <div class="rc-head"><span class="rank" style="background:${col.c}">#${rank}</span><span class="rc-name">${escapeHtml(name)}</span></div>
        <div class="rc-total">${usd(r.total)}</div>
        <div class="rc-subs"><span>${usd(r.perYear)}<small>/yr</small></span><span>${cpm(r.perMile)}</span></div>
        <div class="rc-resale">est. resale ${usd(r.resaleUsed)}${fin ? ` · ${usd(r.downPayment)} down` : ''}</div>
      </div>`;
    })
    .join('');

  const winner = `<div class="winner" style="border-color:${best.col.c}33;background:${best.col.soft}55">
      <div class="trophy">🏆</div>
      <div>
        <div class="win-head">${escapeHtml(best.name)} is cheapest to own — ${usd(best.r.total)} over ${Y} yrs</div>
        <div class="win-delta">${usd(delta)} less <small>(${pctTxt(delta / worst.r.total)})</small> than ${escapeHtml(worst.name)} · ${usd(delta / Y)}/yr</div>
      </div>
    </div>`;

  // category breakdown — one bar per car, per category
  const cats = Object.keys(CATEGORY_LABELS);
  const maxCat = Math.max(1, ...cats.flatMap((c) => results.map((r) => r.byCategory[c] || 0)));
  const rows = cats
    .map((c) => {
      const bars = items
        .map(({ r, col }) => {
          const val = r.byCategory[c] || 0;
          return `<div class="bar"><span class="track"><span class="fill" style="width:${(val / maxCat) * 100}%;background:linear-gradient(90deg, ${col.c}cc, ${col.c})"></span></span><b>${usd(val)}</b></div>`;
        })
        .join('');
      return `<div class="cat-row"><div class="cat-name">${CATEGORY_LABELS[c]}</div><div class="cat-bars">${bars}</div></div>`;
    })
    .join('');
  const legend = items.map(({ name, col }) => `<span class="lg"><span class="dot" style="background:${col.c}"></span>${escapeHtml(name)}</span>`).join('');
  const breakdown = `<div class="panel"><h3>Where the money goes <small>(${Y}-yr totals)</small></h3><div class="legend">${legend}</div><div class="cat-table">${rows}</div></div>`;

  const chart = `<div class="panel"><h3>Cumulative cost over time <small>(starts at purchase price; dips at sale when you recover resale)</small></h3>${cumulativeSvg(items)}<div class="legend">${legend}</div></div>`;

  document.getElementById('results').innerHTML =
    `<div class="summary">${cards}</div>${winner}<div class="panels">${breakdown}${chart}</div>` +
    `<p class="disclaimer">⚠️ Rough illustrative model. Depreciation, incentives, insurance & APR vary — verify live before acting. Methodology: <code>docs/design/tco-model.md</code>.</p>`;
}

// ---------- cumulative line chart (N lines, gradient area fills) ----------
function cumulativeSvg(items) {
  const W = 640, H = 300, padL = 56, padR = 18, padT = 18, padB = 36;
  const Y = items[0].r.cumulative.length - 1;
  const all = items.flatMap((it) => it.r.cumulative);
  const maxV = Math.max(1, ...all);
  const minV = Math.min(0, ...all);
  const x = (k) => padL + (k / Y) * (W - padL - padR);
  const y = (v) => H - padB - ((v - minV) / (maxV - minV)) * (H - padT - padB);
  const baseY = H - padB;
  const linePath = (arr) => arr.map((v, k) => `${k === 0 ? 'M' : 'L'}${x(k).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const areaPath = (arr) => `${linePath(arr)} L${x(Y).toFixed(1)},${baseY} L${x(0).toFixed(1)},${baseY} Z`;

  let defs = '';
  items.forEach(({ col, i }) => {
    defs += `<linearGradient id="grad${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${col.c}" stop-opacity="0.22"/><stop offset="100%" stop-color="${col.c}" stop-opacity="0"/></linearGradient>`;
  });

  let grid = '';
  const steps = 4;
  for (let s = 0; s <= steps; s++) {
    const v = minV + ((maxV - minV) / steps) * s;
    const yy = y(v).toFixed(1);
    grid += `<line class="grid" x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}"/><text class="ax" x="${padL - 8}" y="${+yy + 3}" text-anchor="end">${usdK(v)}</text>`;
  }
  let xAxis = '';
  for (let k = 0; k <= Y; k++) xAxis += `<text class="ax" x="${x(k).toFixed(1)}" y="${H - padB + 17}" text-anchor="middle">${k}</text>`;

  const series = items
    .map(({ r, col, i }) =>
      `<path d="${areaPath(r.cumulative)}" fill="url(#grad${i})" stroke="none"/>` +
      `<path d="${linePath(r.cumulative)}" fill="none" stroke="${col.c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` +
      r.cumulative.map((v, k) => `<circle cx="${x(k).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.2" fill="#fff" stroke="${col.c}" stroke-width="2"/>`).join(''))
    .join('');

  return `<svg viewBox="0 0 ${W} ${H}" class="linechart" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Cumulative cost over time">
      <defs>${defs}</defs>${grid}${xAxis}${series}
      <text class="ax muted" x="${padL}" y="${H - 5}" text-anchor="start">year of ownership →</text>
    </svg>`;
}

// ---------- helpers ----------
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function escAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }

// ---------- structural actions ----------
function renderVehicles() {
  document.getElementById('vehicles').innerHTML = state.vehicles.map((v, i) => vehicleCardHtml(i, v)).join('');
  const add = document.getElementById('addVehicle');
  add.disabled = state.vehicles.length >= MAX_CARS;
  add.textContent = state.vehicles.length >= MAX_CARS ? `Max ${MAX_CARS} cars` : '+ Add car';
}

function loadIntoSlot(idx, vehicle) {
  state.vehicles[idx] = structuredClone(vehicle);
  renderVehicles();
  recompute();
}

function renderAll() {
  document.getElementById('assumptions').innerHTML = assumptionsHtml();
  renderVehicles();
  recompute();
}

// ---------- init / events ----------
function init() {
  document.addEventListener('input', (e) => {
    if (e.target.classList.contains('load-select')) return;
    recompute();
  });
  document.addEventListener('change', (e) => {
    if (e.target.classList.contains('load-select')) {
      const idx = +e.target.id.match(/^v(\d+)_load$/)[1];
      const val = e.target.value;
      if (val.startsWith('preset:')) {
        const p = PRESETS.find((x) => x.id === val.slice(7));
        if (p) loadIntoSlot(idx, p);
      } else if (val.startsWith('saved:')) {
        const prof = loadProfiles()[val.slice(6)];
        if (prof) loadIntoSlot(idx, prof);
      }
      return;
    }
    recompute();
  });
  document.addEventListener('click', (e) => {
    const saveBtn = e.target.closest('.save-btn');
    if (saveBtn) {
      const idx = +saveBtn.dataset.idx;
      syncVehicle(idx);
      const name = (state.vehicles[idx].name || '').trim() || `Saved car ${Date.now()}`;
      state.vehicles[idx].name = name;
      saveProfile(name, state.vehicles[idx]);
      renderVehicles();
      recompute();
      saveBtn.textContent = '✓';
      setTimeout(() => (saveBtn.textContent = '💾'), 1200);
      return;
    }
    const removeBtn = e.target.closest('.remove-btn');
    if (removeBtn && state.vehicles.length > MIN_CARS) {
      state.vehicles.splice(+removeBtn.dataset.idx, 1);
      renderVehicles();
      recompute();
      return;
    }
  });

  document.getElementById('addVehicle').addEventListener('click', () => {
    if (state.vehicles.length >= MAX_CARS) return;
    const next = PRESETS[state.vehicles.length % PRESETS.length];
    state.vehicles.push(structuredClone(next));
    renderVehicles();
    recompute();
  });
  document.getElementById('resetAll').addEventListener('click', () => {
    if (!confirm('Reset all inputs to defaults? This clears your saved session in this browser.')) return;
    clearSession();
    state.assumptions = structuredClone(DEFAULT_ASSUMPTIONS);
    state.vehicles = [
      structuredClone(PRESETS.find((p) => p.id === 'rav4h-new')),
      structuredClone(PRESETS.find((p) => p.id === 'rav4h-used')),
    ];
    renderAll();
  });

  // restore previous session if one exists, else start from defaults
  const sess = loadSession();
  if (sess) hydrateFromSession(sess);
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
