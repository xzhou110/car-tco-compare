import { describe, it, expect } from 'vitest';
import { resolveVehicle, regionAssumptions, type ResolveInput } from './resolveVehicle';
import { DEFAULT_ASSUMPTIONS } from '../data/presets';

const rav4Used: ResolveInput = {
  name: '2021 Toyota RAV4 XLE',
  segment: 'suv-compact',
  powertrain: 'gas',
  condition: 'used',
  purchasePrice: 28000,
  year: 2021,
  mileage: 36000,
  mpg: 30,
};

describe('resolveVehicle', () => {
  it('fills a vehicle from the listing + segment table', () => {
    const v = resolveVehicle(rav4Used, 'national');
    expect(v.purchasePrice).toBe(28000);
    expect(v.odometerAtPurchase).toBe(36000);
    expect(v.resaleValue).toBeNull(); // engine seeds it later
    expect(v.mpg).toBe(30); // listing mpg wins over the segment default (28)
    expect(v.insuranceAnnual).toBe(1550); // suv-compact base × national 1.0
    expect(v.maintenanceAnnual).toBeGreaterThan(0);
    expect(v.annualDepRate).toBeCloseTo(0.12); // used rate for suv-compact
  });

  it('applies the region insurance multiplier', () => {
    const nat = resolveVehicle(rav4Used, 'national').insuranceAnnual;
    const ca = resolveVehicle(rav4Used, 'CA').insuranceAnnual;
    expect(ca).toBe(Math.round(nat * 1.15));
  });

  it('EV path: mi/kWh + incentive, mpg zeroed', () => {
    const ev = resolveVehicle({ ...rav4Used, powertrain: 'ev', condition: 'new' }, 'national');
    expect(ev.mpg).toBe(0);
    expect(ev.miPerKWh).toBeGreaterThan(0);
    expect(ev.incentives).toBe(7500);
    expect(ev.annualDepRate).toBeCloseTo(0.18); // EV new rate for suv-compact
  });

  it('derives age from the model year', () => {
    const v = resolveVehicle({ ...rav4Used, year: new Date().getFullYear() - 3 }, 'national');
    expect(v.ageAtPurchase).toBe(3);
  });

  it('falls back to the segment default mpg when the listing omits it', () => {
    const v = resolveVehicle({ ...rav4Used, mpg: null }, 'national');
    expect(v.mpg).toBe(28); // suv-compact gas default
  });
});

describe('regionAssumptions', () => {
  it('overlays regional inputs and keeps the rest', () => {
    const a = regionAssumptions('CA', DEFAULT_ASSUMPTIONS);
    expect(a.salesTaxRate).toBeCloseTo(0.0725);
    expect(a.fuelPricePerGallon).toBe(4.8);
    expect(a.holdingYears).toBe(DEFAULT_ASSUMPTIONS.holdingYears); // unchanged
    expect(a.financing).toEqual(DEFAULT_ASSUMPTIONS.financing); // unchanged
  });
});
