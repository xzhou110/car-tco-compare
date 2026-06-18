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
  make?: string;
  model?: string;
  segment?: string;
  condition?: string;
  powertrain?: string;
  maxPrice?: number;
  minYear?: number;
}

export function filterListings(listings: Listing[], f: ListingFilters): Listing[] {
  return listings.filter((L) => {
    if (f.make && L.make !== f.make) return false;
    if (f.model && L.model !== f.model) return false;
    if (f.segment && L.segment !== f.segment) return false;
    if (f.condition && L.condition !== f.condition) return false;
    if (f.powertrain && L.powertrain !== f.powertrain) return false;
    if (f.maxPrice && (L.price ?? Infinity) > f.maxPrice) return false;
    if (f.minYear && (L.year ?? 0) < f.minYear) return false;
    return true;
  });
}
