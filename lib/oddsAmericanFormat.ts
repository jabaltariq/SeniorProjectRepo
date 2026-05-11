/**
 * Display helpers: the app stores and computes payouts using decimal odds
 * (e.g. 1.91). US-style boards show American / moneyline (+120, -110).
 */

export function decimalOddsToAmerican(decimalOdds: number): number {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) return 0;
  if (decimalOdds >= 2) return Math.round((decimalOdds - 1) * 100);
  return Math.round(-100 / (decimalOdds - 1));
}

/** e.g. 1.91 → "-110", 2.5 → "+150" */
export function formatAmericanOddsLine(decimalOdds: number): string {
  const american = decimalOddsToAmerican(decimalOdds);
  if (american === 0) return '—';
  return american > 0 ? `+${american}` : `${american}`;
}

/** American moneyline (e.g. -110, +150) → decimal for stake math. */
export function americanToDecimal(american: number): number {
  if (!Number.isFinite(american)) return 1.91;
  if (american >= 100) return Number((1 + american / 100).toFixed(2));
  if (american <= -100) return Number((1 + 100 / Math.abs(american)).toFixed(2));
  return 1.91;
}
