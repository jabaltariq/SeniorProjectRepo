// ─────────────────────────────────────────────────────────────────
//  PARLAY ROLL-UP (pure, no Firestore deps so it can be unit-tested)
// ─────────────────────────────────────────────────────────────────

export type ParlayLegResult = 'PENDING' | 'WON' | 'LOST' | 'PUSH' | 'VOID';

export type ParlayRollup =
    | { state: 'PENDING' }
    | { state: 'LOST' }
    | { state: 'PUSH' }                                   // every surviving leg pushed → refund stake
    | { state: 'WON'; payout: number; reduced: boolean }; // reduced=true if any leg was pushed/voided

/**
 * Pure helper: given a parlay's legs and stake, decide whether the bet is
 * still pending or settled, and at what payout.
 *
 * DraftKings/FanDuel-style rules (per product decision 5.8.2026):
 *   - Any leg LOST → the parlay is LOST.
 *   - Any leg PENDING → the parlay is still PENDING (no payout yet).
 *   - Otherwise the surviving (WON) legs determine the payout:
 *       payout = stake × Π(odds of WON legs).
 *     If 0 legs survive (all PUSH/VOID), the parlay PUSHes and the stake is
 *     refunded.
 */
export function computeParlayRollup(
    legs: { result?: ParlayLegResult | string; odds: number }[],
    stake: number,
): ParlayRollup {
    const normalized = legs.map((l) => {
        const raw = (l.result ?? 'PENDING') as string;
        const result = (raw === 'WON' || raw === 'LOST' || raw === 'PUSH' || raw === 'VOID')
            ? raw
            : 'PENDING';
        return { result: result as ParlayLegResult, odds: Number(l.odds) || 0 };
    });

    if (normalized.some((l) => l.result === 'LOST')) {
        return { state: 'LOST' };
    }
    if (normalized.some((l) => l.result === 'PENDING')) {
        return { state: 'PENDING' };
    }
    const survivors = normalized.filter((l) => l.result === 'WON');
    if (survivors.length === 0) {
        return { state: 'PUSH' };
    }
    const combinedOdds = survivors.reduce((acc, l) => acc * l.odds, 1);
    const payout = Number((stake * combinedOdds).toFixed(2));
    const reduced = survivors.length < normalized.length;
    return { state: 'WON', payout, reduced };
}
