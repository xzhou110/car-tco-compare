// Vehicle value-retention curve — the depreciation model behind the resale auto-estimate.
// PURE, no DOM. Mirrors docs/design/tco-model.md §1. Unit-tested.
//
// The curve is the *shape* of how a car's value falls with AGE (steep early, then
// leveling) — anchored to the published Toyota RAV4 depreciation curve, a strong-
// value-retention benchmark. Values are the fraction of the ORIGINAL (age-0) price
// retained at each whole-year age.
//
// Why a curve (not a flat annual rate): a flat declining-balance rate misses the
// front-loaded "drive-it-off-the-lot" cliff and the later flattening. With a curve,
// resale depends on the car's age *now* (from its model year) and the age at sale
// (age now + holding period) — exactly the factors a buyer cares about.

// Fraction of original value retained at ages 0..10 (Toyota RAV4 curve).
export const RETENTION_BY_AGE: number[] = [
  1.0, // 0
  0.86, // 1
  0.83, // 2
  0.8, // 3
  0.77, // 4
  0.72, // 5
  0.69, // 6
  0.57, // 7
  0.53, // 8
  0.52, // 9
  0.49, // 10
];

// The segment/powertrain whose depRate equals this is treated as the RAV4 benchmark
// (depFactor = 1.0 → the curve is used as-is). Faster-depreciating classes have a
// higher depRate and therefore a depFactor > 1 (the loss is scaled up).
export const BASELINE_DEP_RATE = 0.16;

const TAIL_SLOPE = -0.025; // gentle continued decline per year beyond the table
const TAIL_FLOOR = 0.12; // raw-curve salvage floor (very old cars still worth ~scrap+)
const SALVAGE_FLOOR = 0.1; // floor after depFactor scaling

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Raw retention (fraction of age-0 value) at a possibly-fractional age. */
export function retentionAt(age: number): number {
  if (age <= 0) return 1;
  const last = RETENTION_BY_AGE.length - 1;
  if (age >= last) return Math.max(TAIL_FLOOR, RETENTION_BY_AGE[last] + (age - last) * Math.abs(TAIL_SLOPE) * -1);
  const lo = Math.floor(age);
  return lerp(RETENTION_BY_AGE[lo], RETENTION_BY_AGE[lo + 1], age - lo);
}

/** depFactor: how a vehicle's depreciation depth compares to the RAV4 benchmark. */
export function depFactorFromRate(annualDepRate: number): number {
  return (annualDepRate || 0) / BASELINE_DEP_RATE;
}

/** Retention with the per-vehicle depFactor scaling the LOSS (1 − retention). */
export function scaledRetention(age: number, depFactor: number): number {
  return Math.max(SALVAGE_FLOOR, 1 - depFactor * (1 - retentionAt(age)));
}

/**
 * Resale value at sale from the retention curve.
 * resale = price · scaledRetention(ageNow + holdingYears) / scaledRetention(ageNow)
 * The division makes the price you paid the reference point: a used car's price
 * already reflects the value it lost before you bought it, so we only count the
 * value lost from *now* until you sell. Unrounded; clamped to [0, price].
 */
export function estimateResale(price: number, ageNow: number, holdingYears: number, depFactor = 1): number {
  const ageNowC = Math.max(0, ageNow);
  const saleAge = ageNowC + Math.max(0, holdingYears);
  const now = scaledRetention(ageNowC, depFactor);
  const sale = scaledRetention(saleAge, depFactor);
  const resale = now > 0 ? price * (sale / now) : 0;
  return clamp(resale, 0, price);
}
