// Distance / radius filtering. Auto.dev returns each listing's lat/lng; we geocode
// the user's ZIP to a centroid and keep listings within R miles (Haversine).
//
// IMPORTANT: until the production cache-refresh stores lat/lng, listings_cache rows
// have null coords, so withinRadius() is a safe no-op (returns all) — and the seeded
// tile is already the 94030 / 200mi area, so no per-row distance math is needed yet.
//
// ZIP_CENTROIDS is a stub. For production, load a full US ZIP→lat/lng table (free:
// US Census ZCTA gazetteer, or SimpleMaps "US Zips" basic) and look up here.
export const ZIP_CENTROIDS = {
  '94030': { lat: 37.5985, lng: -122.4014 }, // Millbrae, CA
};

const EARTH_MI = 3958.8;
const toRad = (d) => (d * Math.PI) / 180;

export function haversineMiles(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_MI * Math.asin(Math.sqrt(s));
}

// Keep cache rows within `radiusMi` of `zip`. No-op when the zip is unknown, no
// radius is given, or a row lacks coordinates (so we never drop rows we can't place).
export function withinRadius(rows, zip, radiusMi) {
  const center = ZIP_CENTROIDS[String(zip || '').trim()];
  if (!center || !radiusMi) return rows;
  return rows.filter((r) => {
    if (typeof r.lat !== 'number' || typeof r.lng !== 'number') return true;
    return haversineMiles(center, { lat: r.lat, lng: r.lng }) <= radiusMi;
  });
}
