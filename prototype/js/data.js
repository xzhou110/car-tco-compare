/*
 * Sample vehicle presets + default shared assumptions (SIMPLIFIED v0.2).
 * Edmunds-style 7-line itemization; rough estimates, no precision.
 * All numbers ILLUSTRATIVE — verify live before relying on a result.
 *
 * Plain (non-module) script. Globals: PRESETS, DEFAULT_ASSUMPTIONS, CATEGORY_LABELS.
 */

const DEFAULT_ASSUMPTIONS = {
  holdingYears: 5,
  annualMiles: 12000,
  salesTaxRate: 0.07,
  fuelPricePerGallon: 3.75,
  electricityPricePerKWh: 0.16,
  registrationAnnual: 200, // rough recurring reg estimate (shared)
  // Financing split by condition — new and used differ a lot in real life.
  financing: {
    enabled: false,
    new: { downPct: 0.10, apr: 0.069, termYears: 5 },
    used: { downPct: 0.15, apr: 0.099, termYears: 5 },
  },
};

// Per-vehicle. resaleValue: null => auto-estimate from depreciation curve.
// maintenanceAnnual is rough and INCLUDES tires. repairAnnual applies once out of warranty.
const PRESETS = [
  { id: 'rav4h-new',  name: 'RAV4 Hybrid (New)',     condition: 'new',  purchasePrice: 38000, powertrain: 'hybrid', mpg: 39, miPerKWh: 0,   ageAtPurchase: 0, odometerAtPurchase: 0,     resaleValue: null, annualDepRate: 0.16, insuranceAnnual: 1600, maintenanceAnnual: 700,  repairAnnual: 500,  warrantyYears: 3, warrantyMiles: 36000, incentives: 0 },
  { id: 'rav4h-used', name: 'RAV4 Hybrid (Used 3yr)', condition: 'used', purchasePrice: 28000, powertrain: 'hybrid', mpg: 39, miPerKWh: 0,   ageAtPurchase: 3, odometerAtPurchase: 36000, resaleValue: null, annualDepRate: 0.12, insuranceAnnual: 1450, maintenanceAnnual: 900,  repairAnnual: 800,  warrantyYears: 3, warrantyMiles: 36000, incentives: 0 },
  { id: 'crv-new',    name: 'CR-V (New, gas)',       condition: 'new',  purchasePrice: 36000, powertrain: 'gas',    mpg: 30, miPerKWh: 0,   ageAtPurchase: 0, odometerAtPurchase: 0,     resaleValue: null, annualDepRate: 0.16, insuranceAnnual: 1550, maintenanceAnnual: 700,  repairAnnual: 500,  warrantyYears: 3, warrantyMiles: 36000, incentives: 0 },
  { id: 'model3-new', name: 'Model 3 (New, EV)',     condition: 'new',  purchasePrice: 42000, powertrain: 'ev',     mpg: 0,  miPerKWh: 3.6, ageAtPurchase: 0, odometerAtPurchase: 0,     resaleValue: null, annualDepRate: 0.18, insuranceAnnual: 2100, maintenanceAnnual: 500,  repairAnnual: 500,  warrantyYears: 4, warrantyMiles: 50000, incentives: 0 },
  { id: 'model3-used',name: 'Model 3 (Used 3yr EV)', condition: 'used', purchasePrice: 27000, powertrain: 'ev',     mpg: 0,  miPerKWh: 3.6, ageAtPurchase: 3, odometerAtPurchase: 36000, resaleValue: null, annualDepRate: 0.13, insuranceAnnual: 1950, maintenanceAnnual: 650,  repairAnnual: 700,  warrantyYears: 4, warrantyMiles: 50000, incentives: 0 },
  { id: 'corolla-new',name: 'Corolla (New, economy)',condition: 'new',  purchasePrice: 24000, powertrain: 'gas',    mpg: 35, miPerKWh: 0,   ageAtPurchase: 0, odometerAtPurchase: 0,     resaleValue: null, annualDepRate: 0.15, insuranceAnnual: 1400, maintenanceAnnual: 550,  repairAnnual: 400,  warrantyYears: 3, warrantyMiles: 36000, incentives: 0 },
  { id: 'bmw330-used',name: 'BMW 330i (Used 3yr)',   condition: 'used', purchasePrice: 30000, powertrain: 'gas',    mpg: 28, miPerKWh: 0,   ageAtPurchase: 3, odometerAtPurchase: 36000, resaleValue: null, annualDepRate: 0.14, insuranceAnnual: 1900, maintenanceAnnual: 1600, repairAnnual: 1200, warrantyYears: 4, warrantyMiles: 50000, incentives: 0 },
];

const CATEGORY_LABELS = {
  depreciation: 'Depreciation',
  financingInterest: 'Financing',
  energy: 'Fuel / energy',
  insurance: 'Insurance',
  maintenance: 'Maintenance',
  repairs: 'Repairs',
  taxesAndFees: 'Taxes & fees',
};
