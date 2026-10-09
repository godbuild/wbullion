export function baseForDay(n) {
  return 150 + (n - 1) * 50;
}

export function weekIndexOf(n) {
  return Math.floor((n - 1) / 7);
}

export function dayInWeek(n) {
  return ((n - 1) % 7) + 1;
}

export function isDoubleDay(n) {
  return n % 7 === 0;
}

export function rewardForDay(n) {
  const base = baseForDay(n);
  if (!isDoubleDay(n)) return base;
  // Cumulative of this week's days
  const w = weekIndexOf(n);
  let cumulative = 0;
  for (let i = 1; i <= 7; i++) {
    cumulative += baseForDay(w * 7 + i);
  }
  return cumulative * 2;
}

// Sum of bases across all 7 days of the week containing day n
export function weekCumulative(n) {
  const w = weekIndexOf(n);
  let sum = 0;
  for (let i = 1; i <= 7; i++) sum += baseForDay(w * 7 + i);
  return sum;
}
