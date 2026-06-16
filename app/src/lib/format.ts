// Display formatters.

export const usd = (x: number): string =>
  (x < 0 ? '-$' : '$') + Math.abs(Math.round(x)).toLocaleString('en-US');

export const usdK = (x: number): string =>
  Math.abs(x) >= 1000 ? '$' + (x / 1000).toFixed(Math.abs(x) % 1000 === 0 ? 0 : 1) + 'k' : '$' + Math.round(x);

export const cpm = (x: number): string => (x * 100).toFixed(1) + '¢/mi';

export const pct = (x: number): string => (x * 100).toFixed(0) + '%';
