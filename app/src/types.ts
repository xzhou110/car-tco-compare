// Domain types — single source of truth for the calculation engine and UI.

export type Condition = 'new' | 'used';
export type Powertrain = 'gas' | 'hybrid' | 'ev';

export interface FinancingBracket {
  downPct: number; // fraction of price (0.10 = 10%)
  apr: number; // annual, fraction (0.069 = 6.9%)
  termYears: number;
}

export interface Financing {
  enabled: boolean;
  new: FinancingBracket;
  used: FinancingBracket;
}

export interface Assumptions {
  holdingYears: number;
  annualMiles: number;
  salesTaxRate: number; // fraction
  registrationAnnual: number;
  fuelPricePerGallon: number;
  electricityPricePerKWh: number;
  financing: Financing;
}

export interface Vehicle {
  id: string;
  name: string;
  condition: Condition;
  purchasePrice: number;
  powertrain: Powertrain;
  mpg: number; // gas/hybrid
  miPerKWh: number; // ev
  ageAtPurchase: number;
  odometerAtPurchase: number;
  resaleValue: number | null; // null => auto-estimate
  annualDepRate: number; // used to seed the resale estimate
  insuranceAnnual: number;
  maintenanceAnnual: number; // rough, includes tires
  repairAnnual: number; // applies once out of warranty
  warrantyYears: number; // from new
  warrantyMiles: number; // from new
  incentives: number;
}

export type CategoryKey =
  | 'depreciation'
  | 'financingInterest'
  | 'energy'
  | 'insurance'
  | 'maintenance'
  | 'repairs'
  | 'taxesAndFees';

export type ByCategory = Record<CategoryKey, number>;

export interface TcoResult {
  total: number;
  perYear: number;
  perMile: number;
  byCategory: ByCategory;
  cumulative: number[]; // length holdingYears + 1
  resaleUsed: number;
  downPayment: number;
}

export interface ComparisonState {
  assumptions: Assumptions;
  vehicles: Vehicle[];
}
