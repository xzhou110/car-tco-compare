/*
 * SET 2 — Reference assumption tables (segment-based). Prototype data.
 * Mirrors docs/design/ARCHITECTURE.md §6. Plain global script.
 * Globals: REFERENCE, SEGMENT_LIST, REGION_LIST.
 *
 * ALL NUMBERS ILLUSTRATIVE PLACEHOLDERS — to be sourced from Edmunds True Cost
 * to Own + AAA "Your Driving Costs". `efficiency` (mpg / miPerKWh) is a stand-in
 * for what the free EPA fueleconomy.gov decode will supply per real trim.
 */

const REFERENCE = {
  asOf: '2026-06-01',
  source: 'Illustrative placeholders (Edmunds TCO + AAA pending)',

  // Cost rates keyed by segment, with per-powertrain overrides merged on top.
  // Base row assumes a gas powertrain.
  rates: {
    'car-economy':  { label: 'Economy car',         mpg: 35, depRateNew: 0.15, depRateUsed: 0.11, insurance: 1400, maintenance: 550,  repair: 400,  warrantyYears: 3, warrantyMiles: 36000,
      byPowertrain: { hybrid: { mpg: 50, insurance: 1450 }, ev: { miPerKWh: 4.0, depRateNew: 0.17, insurance: 1600, maintenance: 450, warrantyYears: 8, warrantyMiles: 100000 } } },
    'car-midsize':  { label: 'Midsize car',         mpg: 30, depRateNew: 0.16, depRateUsed: 0.12, insurance: 1500, maintenance: 650,  repair: 500,  warrantyYears: 3, warrantyMiles: 36000,
      byPowertrain: { hybrid: { mpg: 44, insurance: 1550 }, ev: { miPerKWh: 3.6, depRateNew: 0.18, insurance: 1900, maintenance: 500, warrantyYears: 8, warrantyMiles: 100000 } } },
    'car-luxury':   { label: 'Luxury / sport sedan', mpg: 27, depRateNew: 0.14, depRateUsed: 0.11, insurance: 1900, maintenance: 1200, repair: 1100, warrantyYears: 4, warrantyMiles: 50000,
      byPowertrain: { hybrid: { mpg: 34, insurance: 1950 }, ev: { miPerKWh: 3.3, depRateNew: 0.19, insurance: 2300, maintenance: 700, warrantyYears: 8, warrantyMiles: 100000 } } },
    'car-sport':    { label: 'Sports / performance', mpg: 24, depRateNew: 0.15, depRateUsed: 0.12, insurance: 2000, maintenance: 1100, repair: 1000, warrantyYears: 3, warrantyMiles: 36000,
      byPowertrain: { ev: { miPerKWh: 3.0, depRateNew: 0.20, insurance: 2400, maintenance: 700, warrantyYears: 8, warrantyMiles: 100000 } } },
    'suv-compact':  { label: 'Compact SUV',         mpg: 28, depRateNew: 0.16, depRateUsed: 0.12, insurance: 1550, maintenance: 700,  repair: 500,  warrantyYears: 3, warrantyMiles: 36000,
      byPowertrain: { hybrid: { mpg: 39, insurance: 1600 }, ev: { miPerKWh: 3.4, depRateNew: 0.18, insurance: 2000, maintenance: 550, warrantyYears: 8, warrantyMiles: 100000 } } },
    'suv-midsize':  { label: 'Midsize SUV',         mpg: 25, depRateNew: 0.16, depRateUsed: 0.12, insurance: 1650, maintenance: 800,  repair: 600,  warrantyYears: 3, warrantyMiles: 36000,
      byPowertrain: { hybrid: { mpg: 35, insurance: 1700 }, ev: { miPerKWh: 2.8, depRateNew: 0.19, insurance: 2100, maintenance: 600, warrantyYears: 8, warrantyMiles: 100000 } } },
    'suv-large':    { label: 'Large SUV',           mpg: 20, depRateNew: 0.17, depRateUsed: 0.13, insurance: 1750, maintenance: 900,  repair: 700,  warrantyYears: 3, warrantyMiles: 36000,
      byPowertrain: { ev: { miPerKWh: 2.2, depRateNew: 0.20, insurance: 2200, maintenance: 650, warrantyYears: 8, warrantyMiles: 100000 } } },
    'luxury-suv':   { label: 'Luxury SUV',          mpg: 22, depRateNew: 0.15, depRateUsed: 0.12, insurance: 2100, maintenance: 1500, repair: 1300, warrantyYears: 4, warrantyMiles: 50000,
      byPowertrain: { hybrid: { mpg: 28, insurance: 2150 }, ev: { miPerKWh: 2.6, depRateNew: 0.20, insurance: 2600, maintenance: 800, warrantyYears: 8, warrantyMiles: 100000 } } },
    'truck':        { label: 'Pickup truck',        mpg: 21, depRateNew: 0.15, depRateUsed: 0.12, insurance: 1700, maintenance: 800,  repair: 650,  warrantyYears: 3, warrantyMiles: 36000,
      byPowertrain: { ev: { miPerKWh: 2.0, depRateNew: 0.20, insurance: 2200, maintenance: 600, warrantyYears: 8, warrantyMiles: 100000 } } },
    'minivan':      { label: 'Minivan',             mpg: 24, depRateNew: 0.16, depRateUsed: 0.12, insurance: 1500, maintenance: 750,  repair: 600,  warrantyYears: 3, warrantyMiles: 36000,
      byPowertrain: { hybrid: { mpg: 35, insurance: 1550 } } },
  },

  // Location-varying inputs (overlay onto Assumptions). insuranceMultiplier scales segment insurance.
  regions: {
    national: { label: 'US national avg', fuelPricePerGallon: 3.50, electricityPricePerKWh: 0.16, salesTaxRate: 0.060, registrationAnnual: 150, insuranceMultiplier: 1.00 },
    CA:       { label: 'California',       fuelPricePerGallon: 4.80, electricityPricePerKWh: 0.30, salesTaxRate: 0.0725, registrationAnnual: 250, insuranceMultiplier: 1.15 },
    TX:       { label: 'Texas',            fuelPricePerGallon: 3.10, electricityPricePerKWh: 0.14, salesTaxRate: 0.0625, registrationAnnual: 90,  insuranceMultiplier: 1.05 },
    NY:       { label: 'New York',         fuelPricePerGallon: 3.60, electricityPricePerKWh: 0.22, salesTaxRate: 0.080,  registrationAnnual: 140, insuranceMultiplier: 1.20 },
    FL:       { label: 'Florida',          fuelPricePerGallon: 3.40, electricityPricePerKWh: 0.14, salesTaxRate: 0.060,  registrationAnnual: 225, insuranceMultiplier: 1.25 },
  },

  // Incentives by powertrain + condition (flat placeholder; real table keys by model+region+date).
  incentives: {
    ev:     { new: 7500, used: 4000 },
    hybrid: { new: 0,    used: 0 },
    gas:    { new: 0,    used: 0 },
  },
};

const SEGMENT_LIST = Object.keys(REFERENCE.rates).map((k) => ({ key: k, label: REFERENCE.rates[k].label }));
const REGION_LIST = Object.keys(REFERENCE.regions).map((k) => ({ key: k, label: REFERENCE.regions[k].label }));
