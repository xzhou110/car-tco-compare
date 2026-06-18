// Ported TCO engine — faithful JS mirror of the app's tco.ts + resolveVehicle.ts +
// reference.ts + presets DEFAULT_ASSUMPTIONS, so the email's TCO matches the app.
// Region defaults to CA (zip 94030). Listings are treated as 'used'.

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const sum = (a) => a.reduce((p, c) => p + c, 0);

export const DEFAULT_ASSUMPTIONS = {
  holdingYears: 5, annualMiles: 12000, salesTaxRate: 0.07, registrationAnnual: 200,
  fuelPricePerGallon: 3.75, electricityPricePerKWh: 0.16,
  financing: { enabled: false, new: { downPct: 0.1, apr: 0.069, termYears: 5 }, used: { downPct: 0.15, apr: 0.099, termYears: 5 } },
};

const REFERENCE = {
  rates: {
    'car-economy': { mpg: 35, depRateNew: 0.15, depRateUsed: 0.11, insurance: 1400, maintenance: 550, repair: 400, warrantyYears: 3, warrantyMiles: 36000, byPowertrain: { hybrid: { mpg: 50, insurance: 1450 } } },
    'car-midsize': { mpg: 30, depRateNew: 0.16, depRateUsed: 0.12, insurance: 1500, maintenance: 650, repair: 500, warrantyYears: 3, warrantyMiles: 36000, byPowertrain: { hybrid: { mpg: 44, insurance: 1550 } } },
    'suv-compact': { mpg: 28, depRateNew: 0.16, depRateUsed: 0.12, insurance: 1550, maintenance: 700, repair: 500, warrantyYears: 3, warrantyMiles: 36000, byPowertrain: { hybrid: { mpg: 39, insurance: 1600 } } },
    'suv-midsize': { mpg: 25, depRateNew: 0.16, depRateUsed: 0.12, insurance: 1650, maintenance: 800, repair: 600, warrantyYears: 3, warrantyMiles: 36000, byPowertrain: { hybrid: { mpg: 35, insurance: 1700 } } },
    'suv-large': { mpg: 20, depRateNew: 0.17, depRateUsed: 0.13, insurance: 1750, maintenance: 900, repair: 700, warrantyYears: 3, warrantyMiles: 36000 },
  },
  regions: {
    national: { fuelPricePerGallon: 3.5, electricityPricePerKWh: 0.16, salesTaxRate: 0.06, registrationAnnual: 150, insuranceMultiplier: 1.0 },
    CA: { fuelPricePerGallon: 4.8, electricityPricePerKWh: 0.3, salesTaxRate: 0.0725, registrationAnnual: 250, insuranceMultiplier: 1.15 },
  },
  incentives: { gas: { new: 0, used: 0 }, hybrid: { new: 0, used: 0 }, ev: { new: 7500, used: 4000 } },
};

function seedResaleValue(v, a) {
  const rate = v.annualDepRate != null ? v.annualDepRate : v.condition === 'used' ? 0.12 : 0.16;
  const resale = v.purchasePrice * Math.pow(1 - rate, a.holdingYears);
  return clamp(Math.round(resale / 100) * 100, 0, v.purchasePrice);
}

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

export function computeTco(v, a) {
  const Y = a.holdingYears, M = a.annualMiles, totalMiles = Y * M;
  const salesTax = v.purchasePrice * a.salesTaxRate;
  const taxesAndFees = salesTax + (a.registrationAnnual || 0) * Y;
  const resaleUsed = v.resaleValue == null ? seedResaleValue(v, a) : v.resaleValue;
  const depreciation = Math.max(0, v.purchasePrice - resaleUsed);
  const br = a.financing[v.condition] ?? a.financing.new;
  const downPayment = (br.downPct || 0) * v.purchasePrice;
  const fin = financingSchedule(a.financing.enabled, v.purchasePrice + salesTax, downPayment, br.apr, br.termYears, Y);
  const energy = (totalMiles / Math.max(0.1, v.mpg)) * a.fuelPricePerGallon;
  const repairByYear = [];
  for (let k = 0; k < Y; k++) {
    const ageThatYear = v.ageAtPurchase + k;
    const milesThatYear = v.odometerAtPurchase + (k + 1) * M;
    const underWarranty = ageThatYear < v.warrantyYears && milesThatYear < v.warrantyMiles;
    repairByYear.push(underWarranty ? 0 : v.repairAnnual);
  }
  const repairs = sum(repairByYear);
  const maintenance = v.maintenanceAnnual * Y;
  const insurance = v.insuranceAnnual * Y;
  const total = depreciation + fin.total + energy + insurance + maintenance + repairs + taxesAndFees - (v.incentives || 0);
  return { total, perYear: total / Y, perMile: total / totalMiles, resaleUsed };
}

function ratesFor(segment, powertrain) {
  const base = REFERENCE.rates[segment] ?? REFERENCE.rates['car-midsize'];
  return { ...base, ...(base.byPowertrain?.[powertrain] ?? {}) };
}

function regionAssumptions(regionKey, base) {
  const r = REFERENCE.regions[regionKey] ?? REFERENCE.regions.national;
  return { ...base, fuelPricePerGallon: r.fuelPricePerGallon, electricityPricePerKWh: r.electricityPricePerKWh, salesTaxRate: r.salesTaxRate, registrationAnnual: r.registrationAnnual };
}

function resolveVehicle(src, regionKey) {
  const rate = ratesFor(src.segment, src.powertrain);
  const region = REFERENCE.regions[regionKey] ?? REFERENCE.regions.national;
  const currentYear = new Date().getFullYear();
  return {
    condition: src.condition,
    purchasePrice: Number(src.purchasePrice) || 0,
    powertrain: src.powertrain,
    mpg: src.mpg || rate.mpg,
    ageAtPurchase: Math.max(0, currentYear - (Number(src.year) || currentYear)),
    odometerAtPurchase: Number(src.mileage) || 0,
    resaleValue: null,
    annualDepRate: src.condition === 'used' ? rate.depRateUsed : rate.depRateNew,
    insuranceAnnual: Math.round(rate.insurance * region.insuranceMultiplier),
    maintenanceAnnual: rate.maintenance,
    repairAnnual: rate.repair,
    warrantyYears: rate.warrantyYears,
    warrantyMiles: rate.warrantyMiles,
    incentives: REFERENCE.incentives[src.powertrain]?.[src.condition] ?? 0,
  };
}

const SEGMENT_BY_MODEL = [
  [/highlander/i, 'suv-midsize'],
  [/rav4|cr-?v/i, 'suv-compact'],
];
const segmentFor = (model) => (SEGMENT_BY_MODEL.find(([re]) => re.test(model || ''))?.[1]) ?? 'suv-compact';

// Compute TCO for one normalized alert car. Returns { total, perYear, perMile, resaleUsed } or null.
export function tcoForCar(car, regionKey = 'CA') {
  if (typeof car.price !== 'number') return null;
  const powertrain = /hybrid/i.test(car.model || '') ? 'hybrid' : 'gas';
  const v = resolveVehicle({
    segment: segmentFor(car.model), powertrain, condition: 'used',
    purchasePrice: car.price, year: car.year, mileage: car.miles ?? 0, mpg: null,
  }, regionKey);
  return computeTco(v, regionAssumptions(regionKey, DEFAULT_ASSUMPTIONS));
}
