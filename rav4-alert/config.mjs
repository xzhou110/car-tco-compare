// Base URL of the deployed app — used for confirm / unsubscribe links in emails.
export const APP_URL = process.env.APP_URL || 'https://xzhou110.github.io/car-tco-compare/';

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
      'vehicle.year': '2020-2026',    // year ≥ 2020
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
      'vehicle.year': '2022-2026',    // year ≥ 2022
      miles: '0-60000',
      'retailListing.price': '0-35000', // ≤ $35K
    },
    xlePlusOnly: true,  // trim XLE and above (client-side)
  },
];
