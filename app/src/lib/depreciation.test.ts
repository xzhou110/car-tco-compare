import { describe, it, expect } from 'vitest';
import { RETENTION_BY_AGE, retentionAt, scaledRetention, depFactorFromRate, estimateResale } from './depreciation';

describe('retentionAt', () => {
  it('is 1.0 at (or before) age 0 and matches the table at whole years', () => {
    expect(retentionAt(0)).toBe(1);
    expect(retentionAt(-5)).toBe(1);
    expect(retentionAt(5)).toBeCloseTo(0.72, 6);
    expect(retentionAt(10)).toBeCloseTo(0.49, 6);
  });

  it('is monotonically non-increasing across the table', () => {
    for (let i = 1; i < RETENTION_BY_AGE.length; i++) {
      expect(RETENTION_BY_AGE[i]).toBeLessThanOrEqual(RETENTION_BY_AGE[i - 1]);
    }
  });

  it('interpolates linearly between whole years', () => {
    expect(retentionAt(2.5)).toBeCloseTo((0.83 + 0.8) / 2, 6);
  });

  it('keeps declining past the table but never below the salvage floor', () => {
    expect(retentionAt(15)).toBeLessThan(retentionAt(10));
    expect(retentionAt(40)).toBeGreaterThanOrEqual(0.12);
  });
});

describe('depFactorFromRate', () => {
  it('is 1.0 at the RAV4 benchmark rate (0.16) and scales linearly', () => {
    expect(depFactorFromRate(0.16)).toBeCloseTo(1, 6);
    expect(depFactorFromRate(0.12)).toBeCloseTo(0.75, 6);
    expect(depFactorFromRate(0.2)).toBeCloseTo(1.25, 6);
  });
});

describe('scaledRetention', () => {
  it('with depFactor 1.0 equals the raw curve', () => {
    expect(scaledRetention(5, 1)).toBeCloseTo(retentionAt(5), 6);
  });
  it('a higher depFactor retains less; floors at the salvage value', () => {
    expect(scaledRetention(5, 1.5)).toBeLessThan(scaledRetention(5, 1));
    expect(scaledRetention(30, 3)).toBeGreaterThanOrEqual(0.1);
  });
});

describe('estimateResale', () => {
  it('new car (age 0, depFactor 1) held 5yr ≈ price × 0.72', () => {
    expect(estimateResale(38000, 0, 5, 1)).toBeCloseTo(38000 * 0.72, 0);
  });

  it('prices off the purchase point: a used car loses only value from now to sale', () => {
    // Bought at age 3 (depFactor 1): resale = price × ret(8)/ret(3) = price × 0.53/0.80
    expect(estimateResale(28000, 3, 5, 1)).toBeCloseTo(28000 * (0.53 / 0.8), 0);
  });

  it('never exceeds the price and never goes negative', () => {
    expect(estimateResale(20000, 0, 0, 1)).toBeLessThanOrEqual(20000);
    expect(estimateResale(20000, 12, 10, 2)).toBeGreaterThanOrEqual(0);
  });

  it('longer holding ⇒ lower resale (monotonic in holding period)', () => {
    expect(estimateResale(30000, 0, 8, 1)).toBeLessThan(estimateResale(30000, 0, 3, 1));
  });
});
