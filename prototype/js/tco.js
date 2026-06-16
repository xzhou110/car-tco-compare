/*
 * TCO calculation engine (SIMPLIFIED v0.2) — PURE functions, no DOM.
 * Mirrors docs/design/tco-model.md. Plain global script.
 * Globals: computeTco, seedResaleValue.
 */

/** Default resale value from a simple declining-balance curve (rough). */
function seedResaleValue(v, a) {
  const rate = v.annualDepRate != null ? v.annualDepRate : v.condition === 'used' ? 0.12 : 0.16;
  const resale = v.purchasePrice * Math.pow(1 - rate, a.holdingYears);
  return clamp(Math.round(resale / 100) * 100, 0, v.purchasePrice);
}

/** Interest paid during the holding period (total + per-year). Financing split by condition. */
function financingSchedule(enabled, principalBeforeDown, downPayment, apr, termYears, holdingYears) {
  const empty = { total: 0, perYear: new Array(holdingYears).fill(0) };
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

/**
 * Compute TCO for one vehicle under shared assumptions.
 * @returns { total, perYear, perMile, byCategory, cumulative, resaleUsed, downPayment }
 */
function computeTco(v, a) {
  const Y = a.holdingYears;
  const M = a.annualMiles;
  const totalMiles = Y * M;

  // taxes & fees (simplified: sales tax + rough annual registration; no doc/title)
  const salesTax = v.purchasePrice * a.salesTaxRate;
  const registrationTotal = (a.registrationAnnual || 0) * Y;
  const taxesAndFees = salesTax + registrationTotal;

  // depreciation
  const resaleUsed =
    v.resaleValue == null || v.resaleValue === '' ? seedResaleValue(v, a) : Number(v.resaleValue);
  const depreciation = Math.max(0, v.purchasePrice - resaleUsed);

  // financing — bracket chosen by condition (new vs used), down payment is a % of price
  const br = a.financing[v.condition] || a.financing.new;
  const downPayment = (br.downPct || 0) * v.purchasePrice;
  const fin = financingSchedule(a.financing.enabled, v.purchasePrice + salesTax, downPayment, br.apr, br.termYears, Y);

  // energy
  const energy =
    v.powertrain === 'ev'
      ? (totalMiles / Math.max(0.1, v.miPerKWh)) * a.electricityPricePerKWh
      : (totalMiles / Math.max(0.1, v.mpg)) * a.fuelPricePerGallon;
  const energyPerYear = energy / Y;

  // repairs — zero while under warranty (age AND miles), then flat rough annual
  const repairByYear = [];
  for (let k = 0; k < Y; k++) {
    const ageThatYear = v.ageAtPurchase + k;
    const milesThatYear = v.odometerAtPurchase + (k + 1) * M;
    const underWarranty = ageThatYear < v.warrantyYears && milesThatYear < v.warrantyMiles;
    repairByYear.push(underWarranty ? 0 : v.repairAnnual);
  }
  const repairs = sum(repairByYear);

  const maintenance = v.maintenanceAnnual * Y; // flat rough (includes tires)
  const insurance = v.insuranceAnnual * Y;
  const incentives = v.incentives || 0;

  const byCategory = {
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

  // cumulative cost over time — START AT PURCHASE PRICE, recover resale at sale.
  // index 0 = at purchase; running costs added each year; endpoint == total TCO.
  const cumulative = [v.purchasePrice + salesTax - incentives];
  for (let k = 0; k < Y; k++) {
    const yearCost =
      v.insuranceAnnual + energyPerYear + v.maintenanceAnnual + (a.registrationAnnual || 0) + repairByYear[k] + fin.perYear[k];
    cumulative.push(cumulative[k] + yearCost);
  }
  cumulative[Y] -= resaleUsed; // sell the car, recover its value

  return { total, perYear: total / Y, perMile: total / totalMiles, byCategory, cumulative, resaleUsed, downPayment };
}

// --- helpers ---
function sum(arr) { return arr.reduce((a, b) => a + b, 0); }
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
