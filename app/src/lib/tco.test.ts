import { describe, it, expect } from 'vitest';
import { computeTco, seedResaleValue } from './tco';
import { DEFAULT_ASSUMPTIONS, PRESETS } from '../data/presets';
import type { Assumptions, Vehicle } from '../types';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const A = (): Assumptions => clone(DEFAULT_ASSUMPTIONS);
const preset = (id: string): Vehicle => clone(PRESETS.find((p) => p.id === id)!);

describe('computeTco', () => {
  it('itemizes exactly the 7 categories', () => {
    const r = computeTco(preset('rav4h-new'), A());
    expect(Object.keys(r.byCategory).sort()).toEqual(
      ['depreciation', 'energy', 'financingInterest', 'insurance', 'maintenance', 'repairs', 'taxesAndFees'].sort(),
    );
  });

  it('depreciation = price - resale', () => {
    const v = preset('rav4h-new');
    const r = computeTco(v, A());
    expect(r.byCategory.depreciation).toBeCloseTo(v.purchasePrice - r.resaleUsed, 6);
  });

  it('cumulative starts at price + sales tax and ends at total TCO', () => {
    const v = preset('rav4h-new');
    const a = A();
    const r = computeTco(v, a);
    expect(r.cumulative[0]).toBeCloseTo(v.purchasePrice + v.purchasePrice * a.salesTaxRate, 6);
    expect(r.cumulative[r.cumulative.length - 1]).toBeCloseTo(r.total, 6);
    expect(r.cumulative.length).toBe(a.holdingYears + 1);
  });

  it('warranty zeroes repairs while covered (age AND miles)', () => {
    const a = A();
    const base = preset('rav4h-new'); // 3yr / 36k warranty, repairAnnual 500, 5yr hold from new
    expect(computeTco({ ...base, warrantyYears: 0, warrantyMiles: 0 }, a).byCategory.repairs).toBeCloseTo(base.repairAnnual * a.holdingYears, 6);
    expect(computeTco({ ...base, warrantyYears: 10, warrantyMiles: 120000 }, a).byCategory.repairs).toBe(0);
    expect(computeTco(base, a).byCategory.repairs).toBe(base.repairAnnual * 3); // covered yrs 0–1, pays 2–4
  });

  it('financing: down payment is % of price; interest > 0 when enabled', () => {
    const v = preset('rav4h-new');
    const a = A();
    a.financing.enabled = true;
    const r = computeTco(v, a);
    expect(r.downPayment).toBeCloseTo(a.financing.new.downPct * v.purchasePrice, 6);
    expect(r.byCategory.financingInterest).toBeGreaterThan(0);
  });

  it('uses the financing bracket matching the vehicle condition', () => {
    const a = A();
    a.financing.enabled = true;
    a.financing.new.apr = 0.05;
    a.financing.used.apr = 0.15;
    const newCar = computeTco(preset('rav4h-new'), a).byCategory.financingInterest;
    const usedCar = computeTco({ ...preset('rav4h-new'), condition: 'used' }, a).byCategory.financingInterest;
    expect(usedCar).toBeGreaterThan(newCar);
  });

  it('cash purchase has zero financing interest', () => {
    const a = A();
    a.financing.enabled = false;
    expect(computeTco(preset('rav4h-new'), a).byCategory.financingInterest).toBe(0);
  });

  it('EV uses electricity price and efficiency', () => {
    const a = A();
    const ev = computeTco(preset('model3-new'), a).byCategory.energy;
    const expected = ((a.holdingYears * a.annualMiles) / 3.6) * a.electricityPricePerKWh;
    expect(ev).toBeCloseTo(expected, 6);
  });

  it('used RAV4 is cheaper to own than new in the default scenario', () => {
    const a = A();
    expect(computeTco(preset('rav4h-used'), a).total).toBeLessThan(computeTco(preset('rav4h-new'), a).total);
  });

  it('more annual miles => more energy (monotonic)', () => {
    const v = preset('crv-new');
    const less = computeTco(v, A()).byCategory.energy;
    const more = computeTco(v, { ...A(), annualMiles: 24000 }).byCategory.energy;
    expect(more).toBeGreaterThan(less);
  });

  it('0% APR yields finite interest = 0', () => {
    const a = A();
    a.financing.enabled = true;
    a.financing.new.apr = 0;
    const r = computeTco(preset('rav4h-new'), a);
    expect(Number.isFinite(r.byCategory.financingInterest)).toBe(true);
    expect(r.byCategory.financingInterest).toBe(0);
  });
});

describe('seedResaleValue', () => {
  it('stays within [0, price] and falls as depreciation rate rises', () => {
    const v = preset('rav4h-new');
    const a = A();
    const s = seedResaleValue(v, a);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(v.purchasePrice);
    expect(seedResaleValue({ ...v, annualDepRate: 0.3 }, a)).toBeLessThan(s);
  });
});
