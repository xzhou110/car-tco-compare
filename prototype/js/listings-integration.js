/*
 * Prototype: "Load a real car" modal over the EXISTING compare app.
 * Entry point = a button; the browse UI lives in a <dialog> (progressive disclosure).
 * Snapshot is lazy-loaded on first open. Reuses app.js globals (state, MAX_CARS,
 * renderVehicles, recompute, assumptionsHtml) + resolve.js + reference.js.
 */
(function () {
  let LISTINGS = [];
  let META = {};
  let loaded = false;
  let added = 0;
  let region = 'national';
  const F = { q: '', segment: '', condition: '', powertrain: '', maxPrice: '' };

  const usdL = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const byId = (id) => document.getElementById(id);

  async function ensureLoaded() {
    if (loaded) return;
    try {
      const res = await fetch('data/listings.json', { cache: 'no-store' });
      const data = await res.json();
      LISTINGS = data.listings || [];
      META = data;
      loaded = true;
    } catch (e) {
      byId('browse-note').textContent = 'Could not load listings snapshot (' + e + ').';
      return;
    }
    const when = META.generatedAt ? new Date(META.generatedAt).toLocaleDateString() : 'unknown';
    byId('browse-note').innerHTML =
      `<strong>${LISTINGS.length}</strong> real Autotrader listings · snapshot ${esc(when)}. Pick one — its price, mileage & year fill a card; every field stays editable.`;
    renderList();
  }

  function matches(L) {
    if (F.q) { const s = (L.year + ' ' + L.make + ' ' + L.model + ' ' + (L.trim || '')).toLowerCase(); if (!s.includes(F.q.toLowerCase())) return false; }
    if (F.segment && L.segment !== F.segment) return false;
    if (F.condition && L.condition !== F.condition) return false;
    if (F.powertrain && L.powertrain !== F.powertrain) return false;
    if (F.maxPrice && L.price > +F.maxPrice) return false;
    return true;
  }

  function listingCard(L, i) {
    const badges = `<span class="lbadge">${esc(L.segment)}</span><span class="lbadge pt-${L.powertrain}">${L.powertrain}</span><span class="lbadge">${L.condition}</span>`;
    const meta = [L.mileage ? L.mileage.toLocaleString() + ' mi' : null, L.location, L.mpg ? L.mpg + ' mpg' : null].filter(Boolean).join(' · ');
    return `<div class="lcard">
      <div class="lcard-title">${esc(L.year + ' ' + L.make + ' ' + L.model)}${L.trim ? ' <small>' + esc(L.trim) + '</small>' : ''}</div>
      <div class="lcard-price">${usdL(L.price)}</div>
      <div class="lcard-meta">${esc(meta || '')}</div>
      <div class="lcard-badges">${badges}</div>
      <button class="btn tiny lc-add" data-i="${i}">+ Add to compare</button>
    </div>`;
  }

  function renderList() {
    const all = LISTINGS.filter(matches);
    const shown = all.slice(0, 60);
    byId('browse-count').textContent =
      `${all.length} match${all.length === 1 ? '' : 'es'}${all.length > 60 ? ' (showing first 60)' : ''}`;
    byId('browse-results').innerHTML =
      shown.map((L) => listingCard(L, LISTINGS.indexOf(L))).join('') || '<p class="hint-line">No listings match these filters.</p>';
  }

  // Overlay the region's fuel/elec/tax/registration onto the shared assumptions.
  function applyRegion() {
    const a = regionAssumptions(region, state.assumptions);
    state.assumptions.fuelPricePerGallon = a.fuelPricePerGallon;
    state.assumptions.electricityPricePerKWh = a.electricityPricePerKWh;
    state.assumptions.salesTaxRate = a.salesTaxRate;
    state.assumptions.registrationAnnual = a.registrationAnnual;
    byId('assumptions').innerHTML = assumptionsHtml();
    recompute();
  }

  function addListing(L) {
    const name = (L.year + ' ' + L.make + ' ' + L.model + (L.trim ? ' ' + L.trim : '')).trim();
    const v = resolveVehicle({ name, segment: L.segment, powertrain: L.powertrain, condition: L.condition, purchasePrice: L.price, year: L.year, mileage: L.mileage }, region);
    if (L.mpg && L.powertrain !== 'ev') v.mpg = L.mpg;
    if (state.vehicles.length >= MAX_CARS) {
      state.vehicles[state.vehicles.length - 1] = v;
      toast('At max cars — replaced the last slot with ' + name);
    } else {
      state.vehicles.push(v);
      toast('Added ' + name);
    }
    renderVehicles();
    recompute();
    added++;
    byId('browse-added').textContent = `✓ added ${added} ${added === 1 ? 'car' : 'cars'} to your comparison`;
  }

  let toastT;
  function toast(msg) {
    let t = byId('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 2400);
  }

  function open() {
    added = 0;
    byId('browse-added').textContent = '';
    byId('browse-dialog').showModal();
    ensureLoaded();
  }
  function close() { byId('browse-dialog').close(); }

  function init() {
    byId('lf-segment').innerHTML = '<option value="">Any segment</option>' + SEGMENT_LIST.map((s) => `<option value="${s.key}">${esc(s.label)}</option>`).join('');
    byId('lf-region').innerHTML = REGION_LIST.map((r) => `<option value="${r.key}"${r.key === region ? ' selected' : ''}>${esc(r.label)}</option>`).join('');
    byId('lf-q').addEventListener('input', (e) => { F.q = e.target.value; renderList(); });
    byId('lf-segment').addEventListener('change', (e) => { F.segment = e.target.value; renderList(); });
    byId('lf-condition').addEventListener('change', (e) => { F.condition = e.target.value; renderList(); });
    byId('lf-powertrain').addEventListener('change', (e) => { F.powertrain = e.target.value; renderList(); });
    byId('lf-maxprice').addEventListener('input', (e) => { F.maxPrice = e.target.value; renderList(); });
    byId('lf-region').addEventListener('change', (e) => { region = e.target.value; applyRegion(); });
    byId('browse-results').addEventListener('click', (e) => {
      const b = e.target.closest('.lc-add');
      if (b) addListing(LISTINGS[+b.dataset.i]);
    });
    byId('openBrowse').addEventListener('click', open);
    byId('browse-close').addEventListener('click', close);
    byId('browse-done').addEventListener('click', close);
    const dlg = byId('browse-dialog');
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); }); // backdrop click
  }

  document.addEventListener('DOMContentLoaded', init);
})();
