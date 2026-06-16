// Pure TCO calculation engine. No DOM, no I/O. Mirrors docs/design/tco-model.md.
import type { Assumptions, ByCategory, FinancingBracket, TcoResult, Vehicle } from '../types';

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const sum = (a: number[]) => a.reduce((p, c) => p + c, 0);

/** Default resale value from a simple declining-balance curve (rounded to $100). */
export function seedResaleValue(v: Vehicle, a: Assumptions): number {
  const rate = v.annualDepRate != null ? v.annualDepRate : v.condition === 'used' ? 0.12 : 0.16;
  const resale = v.purchasePrice * Math.pow(1 - rate, a.holdingYears);
  return clamp(Math.round(resale / 100) * 100, 0, v.purchasePrice);
}

interface Schedule {
  total: number;
  perYear: number[];
}

/** Interest paid during the holding period (total + per-year). */
function financingSchedule(
  enabled: boolean,
  principalBeforeDown: number,
  downPayment: number,
  apr: number,
  termYears: number,
  holdingYears: number,
): Schedule {
  const empty: Schedule = { total: 0, perYear: new Array(holdingYears).fill(0) };
  if (!enabled) return empty;

  let balance = principalBeforeDown - downPayment;
  if (balance <= 0) return empty;

  const r = apr / 12;
  const n = Math.round(termYears * 12);
  const payment = r === 0 ? balance / n : (balance * r) / (1 - Math.pow(1 + r, -n));
  const monthsOwned = Math.min(n, holdingYears * 12);

  const perYear = new Array(holdingYears).fill(0);
  let total = 0;
  for (let m = 1; m <= monthsOwned; m++) {
    const interest = balance * r;
    balance -= payment - interest;
    total += interest;
    perYear[Math.floor((m - 1) / 12)] += interest;
  }
  return { total, perYear };
}

/** Compute full TCO for one vehicle under shared assumptions. */
export function computeTco(v: Vehicle, a: Assumptions): TcoResult {
  const Y = a.holdingYears;
  const M = a.annualMiles;
  const totalMiles = Y * M;

  const salesTax = v.purchasePrice * a.salesTaxRate;
  const registrationTotal = (a.registrationAnnual || 0) * Y;
  const taxesAndFees = salesTax + registrationTotal;

  const resaleUsed = v.resaleValue == null ? seedResaleValue(v, a) : v.resaleValue;
  const depreciation = Math.max(0, v.purchasePrice - resaleUsed);

  const br: FinancingBracket = a.financing[v.condition] ?? a.financing.new;
  const downPayment = (br.downPct || 0) * v.purchasePrice;
  const fin = financingSchedule(a.financing.enabled, v.purchasePrice + salesTax, downPayment, br.apr, br.termYears, Y);

  const energy =
    v.powertrain === 'ev'
      ? (totalMiles / Math.max(0.1, v.miPerKWh)) * a.electricityPricePerKWh
      : (totalMiles / Math.max(0.1, v.mpg)) * a.fuelPricePerGallon;
  const energyPerYear = energy / Y;

  const repairByYear: number[] = [];
  for (let k = 0; k < Y; k++) {
    const ageThatYear = v.ageAtPurchase + k;
    const milesThatYear = v.odometerAtPurchase + (k + 1) * M;
    const underWarranty = ageThatYear < v.warrantyYears && milesThatYear < v.warrantyMiles;
    repairByYear.push(underWarranty ? 0 : v.repairAnnual);
  }
  const repairs = sum(repairByYear);
  const maintenance = v.maintenanceAnnual * Y;
  const insurance = v.insuranceAnnual * Y;
  const incentives = v.incentives || 0;

  const byCategory: ByCategory = {
    depreciation,
    financingInterest: fin.total,
    energy,
    insurance,
    maintenance,
    repairs,
    taxesAndFees,
  };

  const total =
    depreciation + fin.total + energy + insurance + maintenance + repairs + taxesAndFees - incentives;

  // Cumulative cost: starts at purchase price, recovers resale at sale; endpoint == total.
  const cumulative: number[] = [v.purchasePrice + salesTax - incentives];
  for (let k = 0; k < Y; k++) {
    const yearCost =
      v.insuranceAnnual + energyPerYear + v.maintenanceAnnual + (a.registrationAnnual || 0) + repairByYear[k] + fin.perYear[k];
    cumulative.push(cumulative[k] + yearCost);
  }
  cumulative[Y] -= resaleUsed;

  return { total, perYear: total / Y, perMile: total / totalMiles, byCategory, cumulative, resaleUsed, downPayment };
}
