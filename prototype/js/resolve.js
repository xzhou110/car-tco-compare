/*
 * SET 2 — resolveVehicle(): turn a listing/segment pick + region into a full Vehicle.
 * PURE function, no DOM. Mirrors docs/design/ARCHITECTURE.md §6.
 * Globals: resolveVehicle, regionAssumptions, bodyClassToSegment, PROVENANCE.
 *
 * The returned vehicle tags each field's provenance in a parallel PROVENANCE map
 * (filled by resolveVehicle) so the UI can show where every number came from.
 */

// NHTSA vPIC bodyClass → our segment (used by the Set 1 listing path; here for completeness).
function bodyClassToSegment(bodyClass, priceHint) {
  const b = (bodyClass || '').toLowerCase();
  if (b.includes('pickup')) return 'truck';
  if (b.includes('minivan') || b.includes('van')) return 'minivan';
  if (b.includes('sport utility') || b.includes('suv') || b.includes('crossover')) {
    if (priceHint != null && priceHint > 60000) return 'luxury-suv';
    if (priceHint != null && priceHint > 45000) return 'suv-large';
    return 'suv-compact';
  }
  if (priceHint != null && priceHint > 50000) return 'car-luxury';
  return 'car-midsize';
}

/** Merge a segment's base rate row with its powertrain override. */
function ratesFor(segment, powertrain) {
  const base = REFERENCE.rates[segment] || REFERENCE.rates['car-midsize'];
  const over = (base.byPowertrain && base.byPowertrain[powertrain]) || {};
  return Object.assign({}, base, over);
}

/** Region defaults overlaid onto the shared Assumptions (fuel/elec/tax/registration). */
function regionAssumptions(regionKey, baseAssumptions) {
  const r = REFERENCE.regions[regionKey] || REFERENCE.regions.national;
  return Object.assign({}, baseAssumptions, {
    fuelPricePerGallon: r.fuelPricePerGallon,
    electricityPricePerKWh: r.electricityPricePerKWh,
    salesTaxRate: r.salesTaxRate,
    registrationAnnual: r.registrationAnnual,
  });
}

// Provenance of the last resolve, keyed by Vehicle field → 'listing' | 'segment' | 'region' | 'derived'.
let PROVENANCE = {};

/**
 * @param pick { name, segment, powertrain, condition, purchasePrice, year, mileage }
 *             (purchasePrice/year/mileage are what a scraped Listing supplies)
 * @param regionKey  key into REFERENCE.regions
 * @returns Vehicle (shape matching prototype/js/tco.js)
 */
function resolveVehicle(pick, regionKey) {
  const rate = ratesFor(pick.segment, pick.powertrain);
  const region = REFERENCE.regions[regionKey] || REFERENCE.regions.national;
  const currentYear = new Date().getFullYear();
  const prov = {};

  const isEv = pick.powertrain === 'ev';
  const depRate = pick.condition === 'used' ? rate.depRateUsed : rate.depRateNew;
  const insurance = Math.round(rate.insurance * region.insuranceMultiplier);
  const incentive = (REFERENCE.incentives[pick.powertrain] || {})[pick.condition] || 0;

  const v = {
    id: 'resolved-' + Math.random().toString(36).slice(2, 8),
    name: pick.name || rate.label,
    condition: pick.condition,
    purchasePrice: Number(pick.purchasePrice) || 0,
    powertrain: pick.powertrain,
    mpg: isEv ? 0 : rate.mpg,
    miPerKWh: isEv ? rate.miPerKWh : 0,
    ageAtPurchase: Math.max(0, currentYear - (Number(pick.year) || currentYear)),
    odometerAtPurchase: Number(pick.mileage) || 0,
    resaleValue: null, // engine's seedResaleValue computes it
    annualDepRate: depRate,
    insuranceAnnual: insurance,
    maintenanceAnnual: rate.maintenance,
    repairAnnual: rate.repair,
    warrantyYears: rate.warrantyYears,
    warrantyMiles: rate.warrantyMiles,
    incentives: incentive,
  };

  prov.name = pick.name ? 'listing' : 'segment';
  prov.purchasePrice = 'listing';
  prov.odometerAtPurchase = 'listing';
  prov.ageAtPurchase = 'listing';
  prov.condition = 'listing';
  prov.powertrain = 'listing';
  prov.mpg = isEv ? 'derived' : 'segment';
  prov.miPerKWh = isEv ? 'segment' : 'derived';
  prov.annualDepRate = 'segment';
  prov.insuranceAnnual = 'region'; // segment base × region multiplier
  prov.maintenanceAnnual = 'segment';
  prov.repairAnnual = 'segment';
  prov.warrantyYears = 'segment';
  prov.warrantyMiles = 'segment';
  prov.incentives = 'region';
  prov.resaleValue = 'derived';

  PROVENANCE = prov;
  return v;
}
