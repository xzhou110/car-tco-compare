// Set 2 — resolveVehicle(): turn a listing/segment pick + region into a full Vehicle.
// PURE, no DOM. Mirrors docs/design/segment-model.md §6. Unit-tested.
import type { Assumptions, Condition, Powertrain, SegmentKey, Vehicle } from '../types';
import { REFERENCE, type PowertrainOverride, type RateRow } from '../data/reference';
import { newId } from '../data/presets';

export interface ResolveInput {
  name: string;
  segment: SegmentKey;
  powertrain: Powertrain;
  condition: Condition;
  purchasePrice: number;
  year: number;
  mileage: number;
  mpg?: number | null;
}

function ratesFor(segment: SegmentKey, powertrain: Powertrain): RateRow & PowertrainOverride {
  const base = REFERENCE.rates[segment] ?? REFERENCE.rates['car-midsize'];
  const over: PowertrainOverride = base.byPowertrain?.[powertrain] ?? {};
  return { ...base, ...over };
}

/** Overlay a region's location-varying inputs onto the shared Assumptions. */
export function regionAssumptions(regionKey: string, base: Assumptions): Assumptions {
  const r = REFERENCE.regions[regionKey] ?? REFERENCE.regions.national;
  return {
    ...base,
    fuelPricePerGallon: r.fuelPricePerGallon,
    electricityPricePerKWh: r.electricityPricePerKWh,
    salesTaxRate: r.salesTaxRate,
    registrationAnnual: r.registrationAnnual,
  };
}

export function resolveVehicle(src: ResolveInput, regionKey: string): Vehicle {
  const rate = ratesFor(src.segment, src.powertrain);
  const region = REFERENCE.regions[regionKey] ?? REFERENCE.regions.national;
  const currentYear = new Date().getFullYear();
  const isEv = src.powertrain === 'ev';
  const depRate = src.condition === 'used' ? rate.depRateUsed : rate.depRateNew;
  const insurance = Math.round(rate.insurance * region.insuranceMultiplier);
  const incentive = REFERENCE.incentives[src.powertrain]?.[src.condition] ?? 0;

  return {
    id: newId(),
    name: src.name || rate.label,
    condition: src.condition,
    purchasePrice: Number(src.purchasePrice) || 0,
    powertrain: src.powertrain,
    mpg: isEv ? 0 : src.mpg || rate.mpg,
    miPerKWh: isEv ? rate.miPerKWh ?? 3.5 : 0,
    modelYear: Number(src.year) || currentYear, // engine derives age "now" from this
    odometerAtPurchase: Number(src.mileage) || 0,
    resaleValue: null, // engine's seedResaleValue computes it
    annualDepRate: depRate,
    insuranceAnnual: insurance,
    maintenanceAnnual: rate.maintenance,
    repairAnnual: rate.repair,
    warrantyYears: rate.warrantyYears,
    warrantyMiles: rate.warrantyMiles,
    incentives: incentive,
  };
}
