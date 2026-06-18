// Filtering (trim only) and rendering (summary HTML + detail workbook/CSV).
import ExcelJS from 'exceljs';

// "XLE and above" = anything except base LE / "LE Plus Fleet".
export const isXlePlus = (t) => (t ? !t.toLowerCase().startsWith('le') : false);

// Trim is the only client-side filter. Accident/usage are DISPLAYED but NOT used to
// filter — Auto.dev history coverage is too low (~0.4% of 2020+ cars) to filter on.
export function filterList(cars, list) {
  const kept = [];
  const dropped = { trim: 0 };
  for (const c of cars) {
    if (list.xlePlusOnly && !isXlePlus(c.trim)) { dropped.trim++; continue; }
    kept.push(c);
  }
  kept.sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9));
  return { kept, dropped };
}

// ---------- formatting helpers ----------
const money = (n) => (typeof n === 'number' ? '$' + n.toLocaleString('en-US') : '—');
const num = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : '—');
const dateOnly = (s) => (s ? String(s).slice(0, 10) : '—');
const daysListed = (s) => { const t = Date.parse(s); return Number.isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / 86400000)) : ''; };
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const accidentText = (c) => (!c.historyKnown ? 'unverified'
  : c.accidents === true ? `⚠️ ${c.accidentCount ?? '?'}` : 'None');
const usageText = (c) => (c.historyKnown ? (c.usageType ?? '—') : 'unverified');

// ---------- summary HTML (email body) ----------  Price is shown before Miles.
export function summarySection(list, kept, newVins, topVins) {
  const th = (t, align = 'left') => `<th style="text-align:${align};padding:9px 12px;border-bottom:2px solid #e2e8f0;font:600 11px system-ui;letter-spacing:.03em;text-transform:uppercase;color:#64748b;white-space:nowrap">${t}</th>`;
  const td = (t, extra = '') => `<td style="padding:10px 12px;border-bottom:1px solid #eef2f6;font:13px system-ui;color:#1e293b;vertical-align:top;${extra}">${t}</td>`;
  const tdNum = (t, extra = '') => td(t, 'text-align:right;white-space:nowrap;' + extra);

  if (!kept.length) {
    return `<h2 style="font:600 16px system-ui;margin:30px 0 8px;color:#0f172a">${esc(list.name)}</h2>
      <p style="font:13px system-ui;color:#94a3b8;margin:0">No current matches.</p>`;
  }

  const rows = kept.map((c, i) => {
    const zebra = i % 2 ? 'background:#fafbfc;' : '';
    const isNew = newVins.has(c.vin);
    const badge = isNew ? `<span style="background:#16a34a;color:#ffffff;border-radius:4px;padding:2px 6px;font:600 9px system-ui;letter-spacing:.04em;margin-left:6px;vertical-align:middle">NEW</span>` : '';
    const name = esc([c.year, c.make, c.model, c.trim].filter(Boolean).join(' '));
    const carfax = c.carfaxUrl ? `<br><a href="${esc(c.carfaxUrl)}" style="font:11px system-ui;color:#94a3b8;text-decoration:none">carfax ↗</a>` : '';
    return `<tr style="${zebra}">
      ${td(`<span style="color:#64748b">${dateOnly(c.createdAt)}</span>`)}
      ${tdNum(`<span style="color:#64748b">${daysListed(c.createdAt)}</span>`)}
      ${td(`<a href="${esc(c.vdp)}" style="font-weight:600;color:#0f172a;text-decoration:underline;text-decoration-color:#cbd5e1">${name}</a>` + badge + carfax)}
      ${td(`<span style="color:#475569">${esc(String(c.fuel ?? ''))}</span>`)}
      ${tdNum(`<b style="color:#0f172a">${money(c.price)}</b>`)}
      ${tdNum(c.tco ? `<b style="${!topVins || topVins.has(c.vin) ? 'color:#0b6f66' : 'color:#1e293b'}">${money(Math.round(c.tco.total))}</b>` : '<span style="color:#cbd5e1">—</span>')}
      ${tdNum(`<span style="color:#475569">${num(c.miles)}</span>`)}
      ${td(`<span style="color:#475569">${esc(c.location)}</span>`)}
      ${td(`<span style="color:#94a3b8">${esc(c.dealer)}</span>`)}
    </tr>`;
  }).join('');

  const numeric = new Set(['Days on mkt', 'Year', 'Price', '5-yr TCO', 'Miles']);
  return `<h2 style="font:600 16px system-ui;margin:30px 0 0;color:#0f172a">${esc(list.name)} <span style="color:#94a3b8;font-weight:400;font-size:14px">— ${kept.length} match${kept.length === 1 ? '' : 'es'}</span></h2>
    <div style="overflow-x:auto;margin-top:10px;border:1px solid #e8edf2;border-radius:10px">
    <table style="border-collapse:collapse;width:100%;background:#ffffff">
      <thead><tr style="background:#f8fafc">${['Listed', 'Days on mkt', 'Vehicle', 'Fuel', 'Price', '5-yr TCO', 'Miles', 'Location', 'Dealer'].map((t) => th(t, numeric.has(t) ? 'right' : 'left')).join('')}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
    </div>`;
}

// Set of the lowest-TCO VINs across all matches (to highlight just the winners).
export function rankTopVins(cars, n = 10) {
  const seen = new Set();
  return new Set(cars
    .filter((c) => c.tco && c.vin && !seen.has(c.vin) && seen.add(c.vin))
    .sort((a, b) => a.tco.total - b.tco.total)
    .slice(0, n)
    .map((c) => c.vin));
}

// ---------- Top-N by lowest 5-yr TCO (email lead) ----------
export function topTcoSection(cars, n = 10) {
  const seen = new Set();
  const ranked = cars
    .filter((c) => c.tco && c.vin && !seen.has(c.vin) && seen.add(c.vin))
    .sort((a, b) => a.tco.total - b.tco.total)
    .slice(0, n);
  if (!ranked.length) return '';
  const th = (t, align = 'left') => `<th style="text-align:${align};padding:9px 12px;border-bottom:2px solid #cdeee9;font:600 11px system-ui;letter-spacing:.03em;text-transform:uppercase;color:#0b6f66;white-space:nowrap">${t}</th>`;
  const td = (t, extra = '') => `<td style="padding:11px 12px;border-bottom:1px solid #eef2f6;font:13px system-ui;color:#1e293b;${extra}">${t}</td>`;
  const tdNum = (t, extra = '') => td(t, 'text-align:right;white-space:nowrap;' + extra);
  const rows = ranked.map((c, i) => {
    const zebra = i % 2 ? 'background:#fafbfc;' : '';
    const rank = `<span style="display:inline-block;min-width:22px;height:22px;line-height:22px;text-align:center;border-radius:11px;background:#e6f6f3;color:#0b6f66;font:700 12px system-ui">${i + 1}</span>`;
    return `<tr style="${zebra}">
      ${td(rank)}
      ${td(`<a href="${esc(c.vdp)}" style="font-weight:600;color:#0f172a;text-decoration:underline;text-decoration-color:#cbd5e1">${esc([c.year, c.make, c.model, c.trim].filter(Boolean).join(' '))}</a>`)}
      ${tdNum(`<span style="color:#1e293b">${money(c.price)}</span>`)}
      ${tdNum(`<b style="color:#0b6f66">${money(Math.round(c.tco.total))}</b>`)}
      ${tdNum(`<span style="color:#475569">${num(c.miles)}</span>`)}
      ${tdNum(`<span style="color:#64748b">${daysListed(c.createdAt)}</span>`)}
      ${td(`<span style="color:#475569">${esc(c.location)}</span>`)}
    </tr>`;
  }).join('');
  const numeric = new Set(['Price', '5-yr TCO', 'Miles', 'Days on mkt']);
  return `<h2 style="font:700 18px system-ui;margin:0 0 4px;color:#0f172a">🏆 Top ${ranked.length} — lowest 5-yr cost to own</h2>
    <p style="font:12px system-ui;color:#94a3b8;margin:0 0 10px;line-height:1.5">Ranked across your preferences. 5-yr TCO = depreciation + fuel + insurance + maintenance + repairs + taxes (CA, 12k mi/yr, no financing).</p>
    <div style="overflow-x:auto;border:1px solid #d7ede9;border-radius:10px">
    <table style="border-collapse:collapse;width:100%;background:#ffffff">
      <thead><tr style="background:#f0faf8">${['#', 'Vehicle', 'Price', '5-yr TCO', 'Miles', 'Days on mkt', 'Location'].map((t) => th(t, numeric.has(t) ? 'right' : 'left')).join('')}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
    </div>`;
}

export function buildHtml(sections, opts = {}) {
  const intro = opts.intro || `<p style="font:13px system-ui;color:#475569;margin:0">Your car deal alert · ${new Date().toLocaleString('en-US')}</p>`;
  const unsub = opts.unsubscribeUrl
    ? ` · <a href="${esc(opts.unsubscribeUrl)}" style="color:#94a3b8;text-decoration:underline">Unsubscribe</a>` : '';
  const header = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
        <tr><td style="background:#0f9b8e;background-image:linear-gradient(135deg,#0f9b8e,#0b6f66);padding:22px 28px;border-radius:14px 14px 0 0">
          <span style="font:700 20px system-ui;color:#ffffff;letter-spacing:-.01em">🚗 Car Deal Alerts</span>
          <div style="font:13px system-ui;color:#d6f1ee;margin-top:3px">Lowest 5-year cost-to-own picks, fresh from the market</div>
        </td></tr>
      </table>`;
  return `<div style="background:#f1f5f9;margin:0;padding:24px 12px">
    <table role="presentation" width="700" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:collapse;max-width:700px;width:100%;margin:0 auto">
      <tr><td>
        ${header}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
          <tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 14px 14px;padding:24px 28px 28px">
            <div style="margin-bottom:6px">${intro}</div>
            ${sections.join('')}
            <hr style="border:none;border-top:1px solid #eef2f6;margin:28px 0 14px">
            <p style="font:11px system-ui;color:#94a3b8;margin:0;line-height:1.6">History shown when available; "unverified" means we had no record — open the Carfax link to confirm. Full detail (every match, all columns) is in the attached spreadsheet, one tab per preference.${unsub}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </div>`;
}

// ---------- detail columns (workbook tabs + CSV) ----------
// [stableKey, valueFn, columnWidth, 'Title Case Header']. The stableKey keeps the
// row/cell wiring intact; the header is the display label. VIN sits to the LEFT of
// all URL columns.
const DETAIL_COLS = [
  ['createdAt', (c) => c.createdAt, 16, 'Listed Date'],
  ['daysOnMarket', (c) => daysListed(c.createdAt), 15, 'Days On Market'],
  ['year', (c) => c.year, 7, 'Year'],
  ['vehicle', (c) => [c.make, c.model, c.trim].filter(Boolean).join(' '), 30, 'Vehicle'],
  ['fuel', (c) => c.fuel, 9, 'Fuel'],
  ['miles', (c) => c.miles, 10, 'Miles'],
  ['price', (c) => c.price, 11, 'Price'],
  ['tco5Yr', (c) => (c.tco ? Math.round(c.tco.total) : ''), 11, '5-Yr TCO'],
  ['tcoPerYear', (c) => (c.tco ? Math.round(c.tco.perYear) : ''), 13, 'TCO Per Year'],
  ['estBaseMsrp', (c) => c.baseMsrp, 15, 'Est. Base MSRP'],
  ['estBaseInvoice', (c) => c.baseInvoice, 18, 'Est. Base Invoice'],
  ['location', (c) => c.location, 20, 'Location'],
  ['dealer', (c) => c.dealer, 28, 'Dealer'],
  ['accident', (c) => (!c.historyKnown ? 'unknown' : c.accidents ? 'Yes' : 'None'), 10, 'Accident'],
  ['accidentCount', (c) => (c.historyKnown ? c.accidentCount : ''), 15, 'Accident Count'],
  ['ownerCount', (c) => (c.historyKnown ? c.ownerCount : ''), 12, 'Owner Count'],
  ['usageType', (c) => (c.historyKnown ? c.usageType : 'unknown'), 13, 'Usage Type'],
  ['series', (c) => c.series, 32, 'Series'],
  ['drivetrain', (c) => c.drivetrain, 12, 'Drivetrain'],
  ['exteriorColor', (c) => c.exteriorColor, 16, 'Exterior Color'],
  ['interiorColor', (c) => c.interiorColor, 16, 'Interior Color'],
  ['cpo', (c) => c.cpo, 7, 'CPO'],
  ['vin', (c) => c.vin, 19, 'VIN'],
  ['carfaxUrl', (c) => c.carfaxUrl, 46, 'Carfax URL'],
];

const csvEsc = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export function buildCsv(kept) {
  const header = DETAIL_COLS.map(([, , , h]) => csvEsc(h)).join(',');
  const rows = kept.map((c) => DETAIL_COLS.map(([, f]) => csvEsc(f(c))).join(','));
  return [header, ...rows].join('\n');
}

// Single .xlsx workbook, one worksheet (tab) per list.
export async function buildWorkbook(perList) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'rav4-alert';
  // Excel caps tab names at 31 chars and requires them unique — truncate on a word
  // boundary (not mid-word) and de-duplicate.
  const usedTabs = new Set();
  const tabName = (raw) => {
    let s = String(raw).replace(/[\\/?*[\]:]/g, '').trim();
    if (s.length > 31) { s = s.slice(0, 31); const sp = s.lastIndexOf(' '); if (sp > 12) s = s.slice(0, sp).trim(); }
    s = s || 'Sheet';
    let name = s, i = 2;
    while (usedTabs.has(name.toLowerCase())) name = `${s.slice(0, 26)} (${i++})`;
    usedTabs.add(name.toLowerCase());
    return name;
  };
  for (const { tab, cars } of perList) {
    const ws = wb.addWorksheet(tabName(tab));
    ws.columns = DETAIL_COLS.map(([n, , w, h]) => ({ header: h, key: n, width: w ?? 14 }));
    for (const c of cars) {
      const obj = Object.fromEntries(DETAIL_COLS.map(([n, f]) => [n, f(c)]));
      // Vehicle name → clickable listing link (replaces the standalone URL column).
      if (typeof c.vdp === 'string' && /^https?:/i.test(c.vdp)) obj.vehicle = { text: String(obj.vehicle ?? ''), hyperlink: c.vdp };
      if (typeof obj.carfaxUrl === 'string' && /^https?:/i.test(obj.carfaxUrl)) obj.carfaxUrl = { text: obj.carfaxUrl, hyperlink: obj.carfaxUrl };
      const row = ws.addRow(obj);
      for (const k of ['vehicle', 'carfaxUrl']) {
        const cell = row.getCell(k);
        if (cell.value && cell.value.hyperlink) cell.font = { color: { argb: 'FF2563EB' }, underline: true };
      }
    }
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: DETAIL_COLS.length } };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
