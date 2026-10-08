// 1234 → "1,234"
export function comma(n) {
  return Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

// 10453 → "10.5K", 1200000 → "1.2M"
export function compact(n) {
  const x = Number(n || 0);
  if (x < 1000) return String(Math.floor(x));
  if (x < 1_000_000) return (x / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  if (x < 1_000_000_000) return (x / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  return (x / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
}

// "NGN 1,234"
export function money(n) {
  return 'NGN ' + comma(n);
}
