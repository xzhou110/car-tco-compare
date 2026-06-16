/*
 * Shared Autotrader scrape + normalize core (FREE direct scrape).
 * Used by server.js (live proxy) and snapshot.js (build the static JSON the
 * deployed app reads). CommonJS so portable node can require it directly.
 * NOTE: violates the site's ToS; personal/experimental, low volume only.
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function deepFindListings(obj, seen) {
  let best = null;
  (function walk(o) {
    if (!o || typeof o !== 'object' || seen.has(o)) return;
    seen.add(o);
    if (Array.isArray(o)) {
      if (o.length && o[0] && typeof o[0] === 'object' && 'vin' in o[0] && 'pricingDetail' in o[0]) {
        if (!best || o.length > best.length) best = o;
      }
      o.forEach(walk);
      return;
    }
    for (const k of Object.keys(o)) walk(o[k]);
  })(obj);
  return best || [];
}

// Autotrader's full SRP results live in __eggsState.inventory (object keyed by id).
function extractListings(data) {
  const inv = data && data.props && data.props.pageProps && data.props.pageProps.__eggsState && data.props.pageProps.__eggsState.inventory;
  let arr = inv && typeof inv === 'object' && !Array.isArray(inv)
    ? Object.values(inv).filter((o) => o && o.vin && o.pricingDetail)
    : [];
  if (!arr.length) arr = deepFindListings(data, new Set());
  const seen = new Set();
  return arr.filter((o) => { if (seen.has(o.vin)) return false; seen.add(o.vin); return true; });
}

function segmentFor(bodyName, subType, price) {
  const b = (bodyName || '').toLowerCase();
  const s = (subType || '').toLowerCase();
  if (b.includes('pickup') || b.includes('truck')) return 'truck';
  if (b.includes('van')) return 'minivan';
  if (b.includes('sport utility') || b.includes('suv') || b.includes('crossover')) {
    if (price > 60000) return 'luxury-suv';
    if (s.includes('full') || s.includes('large')) return 'suv-large';
    if (s.includes('mid')) return 'suv-midsize';
    return 'suv-compact';
  }
  if (b.includes('coupe') || b.includes('convertible')) return 'car-sport';
  if (price > 50000) return 'car-luxury';
  if (s.includes('mid') || s.includes('full') || s.includes('large')) return 'car-midsize';
  return 'car-economy';
}

function powertrainFor(fuel) {
  const f = (fuel || '').toLowerCase();
  if (f.includes('hybrid') || f.includes('plug')) return 'hybrid';
  if (f.includes('electric')) return 'ev';
  return 'gas';
}

function normalize(L) {
  const pd = L.pricingDetail || {};
  const price = pd.salePrice || pd.displayPrice || pd.preFeeDerivedPrice || null;
  const mileage = L.mileage && L.mileage.value ? Number(String(L.mileage.value).replace(/[^\d]/g, '')) : null;
  const body = (L.bodyStyles && L.bodyStyles[0] && L.bodyStyles[0].name) || '';
  const sub = (L.bodyStyleSubType && L.bodyStyleSubType[0] && L.bodyStyleSubType[0].name) || '';
  const fuel = typeof L.fuelType === 'string' ? L.fuelType : (L.fuelType && L.fuelType.name) || '';
  const addr = (L.owner && L.owner.location && L.owner.location.address) || {};
  const mpg = L.mpgCity && L.mpgHighway ? Math.round((L.mpgCity + L.mpgHighway) / 2) : null;
  return {
    source: 'autotrader',
    url: 'https://www.autotrader.com/cars-for-sale/vehicle/' + L.id,
    vin: L.vin || null,
    year: L.year || null,
    make: (L.make && L.make.name) || '',
    model: (L.model && L.model.name) || '',
    trim: (L.trim && L.trim.name) || null,
    price, mileage,
    condition: L.listingType === 'USED' ? 'used' : 'new',
    segment: segmentFor(body, sub, price || 0),
    powertrain: powertrainFor(fuel),
    mpg,
    bodyStyle: [body, sub].filter(Boolean).join(' / '),
    fuelType: fuel,
    dealer: (L.owner && L.owner.name) || null,
    location: [addr.city, addr.state].filter(Boolean).join(', ') || null,
    fetchedAt: new Date().toISOString(),
  };
}

async function searchAutotrader(zip, radius, make, model, startYear) {
  let url = `https://www.autotrader.com/cars-for-sale/all-cars?zip=${encodeURIComponent(zip)}&searchRadius=${encodeURIComponent(radius)}`;
  if (make) url += `&makeCodeList=${encodeURIComponent(String(make).toUpperCase())}`;
  if (model) url += `&modelCodeList=${encodeURIComponent(String(model).toUpperCase())}`;
  if (startYear) url += `&startYear=${encodeURIComponent(startYear)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9' } });
    const html = await res.text();
    if (/datadome|px-captcha|are you a human/i.test(html)) return { error: 'blocked', listings: [] };
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return { error: 'no data island (page shape changed?)', listings: [] };
    const listings = extractListings(JSON.parse(m[1])).map(normalize).filter((x) => x.price);
    return { listings };
  } catch (e) {
    return { error: String(e), listings: [] };
  } finally {
    clearTimeout(t);
  }
}

module.exports = { searchAutotrader, extractListings, normalize, segmentFor, powertrainFor };
