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
  modelYear: number; // age "now" is derived from this (currentYear − modelYear)
  odometerAtPurchase: number;
  resaleValue: number | null; // null => auto-estimate from the retention curve
  annualDepRate: number; // scales the retention curve's loss (0.16 = RAV4 benchmark)
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

export type SegmentKey =
  | 'car-economy'
  | 'car-midsize'
  | 'car-luxury'
  | 'car-sport'
  | 'suv-compact'
  | 'suv-midsize'
  | 'suv-large'
  | 'luxury-suv'
  | 'truck'
  | 'minivan';

/** A scraped car-for-sale listing (Set 1), normalized in proxy/scrape.js. */
export interface Listing {
  source: string;
  url: string;
  vin: string | null;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  price: number | null;
  mileage: number | null;
  condition: Condition;
  segment: SegmentKey;
  powertrain: Powertrain;
  mpg: number | null;
  bodyStyle: string;
  fuelType: string;
  dealer: string | null;
  location: string | null;
  fetchedAt: string;
  firstSeen?: string; // first snapshot this VIN appeared in (→ days on market)
  lastSeen?: string; // most recent snapshot this VIN appeared in (basis for sold-car expiry)
}

export interface ListingsSnapshot {
  generatedAt: string;
  source: string;
  note?: string;
  count: number;
  listings: Listing[];
}
