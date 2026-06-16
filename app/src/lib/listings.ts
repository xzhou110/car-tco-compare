// Set 1 — load the static listings snapshot the deployed app ships with, and
// filter it. loadListingsSnapshot fetches the JSON Vite copied from public/;
// filterListings is pure + unit-tested.
import type { Listing, ListingsSnapshot } from '../types';

export async function loadListingsSnapshot(): Promise<ListingsSnapshot | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/listings.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as ListingsSnapshot;
  } catch {
    return null;
  }
}

export interface ListingFilters {
  q?: string;
  segment?: string;
  condition?: string;
  powertrain?: string;
  maxPrice?: number;
}

export function filterListings(listings: Listing[], f: ListingFilters): Listing[] {
  const q = (f.q || '').toLowerCase().trim();
  return listings.filter((L) => {
    if (q) {
      const hay = `${L.year} ${L.make} ${L.model} ${L.trim || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.segment && L.segment !== f.segment) return false;
    if (f.condition && L.condition !== f.condition) return false;
    if (f.powertrain && L.powertrain !== f.powertrain) return false;
    if (f.maxPrice && (L.price ?? Infinity) > f.maxPrice) return false;
    return true;
  });
}
