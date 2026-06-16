// Sample vehicles, default assumptions, and UI constants.
// All numbers ILLUSTRATIVE — verify live before relying on a result.
import type { Assumptions, CategoryKey, Vehicle } from '../types';

export const MIN_CARS = 2;
export const MAX_CARS = 6;

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  holdingYears: 5,
  annualMiles: 12000,
  salesTaxRate: 0.07,
  registrationAnnual: 200,
  fuelPricePerGallon: 3.75,
  electricityPricePerKWh: 0.16,
  financing: {
    enabled: false,
    new: { downPct: 0.1, apr: 0.069, termYears: 5 },
    used: { downPct: 0.15, apr: 0.099, termYears: 5 },
  },
};

// Kept intentionally short (2) — the classic new-vs-used pair. Users edit freely
// and save their own cars (which appear, and are deletable, in each card's Load… menu).
export const PRESETS: Vehicle[] = [
  { id: 'rav4h-new', name: 'RAV4 Hybrid (New)', condition: 'new', purchasePrice: 38000, powertrain: 'hybrid', mpg: 39, miPerKWh: 0, ageAtPurchase: 0, odometerAtPurchase: 0, resaleValue: null, annualDepRate: 0.16, insuranceAnnual: 1600, maintenanceAnnual: 700, repairAnnual: 500, warrantyYears: 3, warrantyMiles: 36000, incentives: 0 },
  { id: 'rav4h-used', name: 'RAV4 Hybrid (Used 3yr)', condition: 'used', purchasePrice: 28000, powertrain: 'hybrid', mpg: 39, miPerKWh: 0, ageAtPurchase: 3, odometerAtPurchase: 36000, resaleValue: null, annualDepRate: 0.12, insuranceAnnual: 1450, maintenanceAnnual: 900, repairAnnual: 800, warrantyYears: 3, warrantyMiles: 36000, incentives: 0 },
];

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  depreciation: 'Depreciation',
  financingInterest: 'Financing',
  energy: 'Fuel / energy',
  insurance: 'Insurance',
  maintenance: 'Maintenance',
  repairs: 'Repairs',
  taxesAndFees: 'Taxes & fees',
};

export const CATEGORY_ORDER: CategoryKey[] = [
  'depreciation',
  'financingInterest',
  'energy',
  'insurance',
  'maintenance',
  'repairs',
  'taxesAndFees',
];

// One color per cost component — used for the stacked breakdown segments.
// Same order/colors across every car's bar. Mid-tone, works on light + dark.
export const CATEGORY_COLORS: Record<CategoryKey, string> = {
  depreciation: '#4f6bed',
  financingInterest: '#e0851e',
  energy: '#16a34a',
  insurance: '#d6457f',
  maintenance: '#0f9b8e',
  repairs: '#8b5cf6',
  taxesAndFees: '#64748b',
};

export interface SlotColor {
  c: string;
  soft: string;
  ink: string;
}

export const SLOT_COLORS: SlotColor[] = [
  { c: '#0f9b8e', soft: '#d6f1ee', ink: '#0b6f66' },
  { c: '#e08a1e', soft: '#fbe9cd', ink: '#a8650f' },
  { c: '#5b6ee0', soft: '#e1e6fb', ink: '#3a49aa' },
  { c: '#d6457f', soft: '#fbdbe8', ink: '#a82a5e' },
  { c: '#3f9a4e', soft: '#d8efdb', ink: '#2c7038' },
  { c: '#8b5cf6', soft: '#ece7fc', ink: '#6d28d9' },
];

export const slotColor = (i: number): SlotColor => SLOT_COLORS[i % SLOT_COLORS.length];

export const newId = (): string => 'v' + Math.random().toString(36).slice(2, 9);
