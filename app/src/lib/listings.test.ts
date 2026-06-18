import { describe, it, expect } from 'vitest';
import { filterListings } from './listings';
import type { Listing } from '../types';

let n = 0;
const mk = (o: Partial<Listing>): Listing => ({
  source: 'autotrader', url: '', vin: 'v' + n++,
  year: 2022, make: 'Toyota', model: 'RAV4', trim: 'XLE',
  price: 30000, mileage: 20000, condition: 'used',
  segment: 'suv-compact', powertrain: 'gas', mpg: 30,
  bodyStyle: '', fuelType: '', dealer: null, location: null, fetchedAt: '',
  ...o,
});

describe('filterListings', () => {
  const list = [
    mk({}),
    mk({ make: 'Honda', model: 'CR-V' }),
    mk({ model: 'Highlander', segment: 'suv-midsize', powertrain: 'hybrid', price: 45000 }),
  ];

  it('make filter', () => expect(filterListings(list, { make: 'Honda' })).toHaveLength(1));
  it('model filter', () => expect(filterListings(list, { model: 'Highlander' })).toHaveLength(1));
  it('segment filter', () => expect(filterListings(list, { segment: 'suv-midsize' })).toHaveLength(1));
  it('powertrain filter', () => expect(filterListings(list, { powertrain: 'hybrid' })).toHaveLength(1));
  it('maxPrice filter', () => expect(filterListings(list, { maxPrice: 35000 })).toHaveLength(2));
  it('empty filters return all', () => expect(filterListings(list, {})).toHaveLength(3));
});
