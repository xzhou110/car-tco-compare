// Base URL of the deployed app — used for confirm / unsubscribe links in emails.
export const APP_URL = process.env.APP_URL || 'https://xzhou110.github.io/car-tco-compare/';

// Newest model year any Auto.dev query asks for. Next year's models go on sale in the
// fall (2027s in October 2026), so the bound is the calendar year + 1, never a fixed year.
export const MAX_MODEL_YEAR = new Date().getFullYear() + 1;

// Watchlists + settings. Edit here to change criteria.
export const SETTINGS = {
  zip: '94030',
  radius: '200',
  sender: 'Car Deal Alerts <alerts@send.xuspark.com>', // verified Resend domain (delivers to anyone)
  recipient: 'pastnoefuture@gmail.com',           // default preview recipient (any address now works)
  emailMode: 'all',  // 'all' = show every current match (NEW badged) | 'new-only'
  maxPages: 25,
};

export const LISTS = [
  {
    id: 'list1',
    name: 'List 1 — RAV4 Hybrid (Any Trim)',
    query: {
      'vehicle.make': 'Toyota',
      'vehicle.model': 'RAV4 Hybrid', // also satisfies the "hybrid/fuel" requirement
      'vehicle.year': `2020-${MAX_MODEL_YEAR}`, // year ≥ 2020
      miles: '0-60000',               // ≤ 60K mi
      'retailListing.price': '0-30000', // ≤ $30K
    },
    xlePlusOnly: false,
  },
  {
    id: 'list2',
    name: 'List 2 — RAV4 Hybrid (XLE and above)',
    query: {
      'vehicle.make': 'Toyota',
      'vehicle.model': 'RAV4 Hybrid',
      'vehicle.year': `2022-${MAX_MODEL_YEAR}`, // year ≥ 2022
      miles: '0-60000',
      'retailListing.price': '0-35000', // ≤ $35K
    },
    xlePlusOnly: true,  // trim XLE and above (client-side)
  },
];
