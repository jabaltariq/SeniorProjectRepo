// ─────────────────────────────────────────────────────────────────
//  STRICT PARLAY RULES (pure, no React/Firestore deps so it can be
//  unit-tested cheaply and reused outside the viewModel)
//
//  Product decision (5.8.2026, see chat):
//    - Max legs per parlay: 10
//    - Allow same-event multi-market (h2h + spread + total on the
//      same game is fine, like a loose SGP).
//    - Block "both sides of the same market" — i.e. two legs that
//      share BOTH marketId AND marketKey but pick different options
//      (Yankees ML + Red Sox ML, Over + Under, etc.).
//    - Exact-duplicate clicks are handled by the caller as a toggle
//      (clicking the same leg again removes it). This helper does NOT
//      treat the exact-duplicate case as a violation, because by the
//      time validation runs the toggle path has already absorbed it.
// ─────────────────────────────────────────────────────────────────

export const MAX_PARLAY_LEGS = 10;

export type ParlayRuleViolation = 'MAX_LEGS' | 'BOTH_SIDES';

// `never` on the success variant lets TS narrow `if (!result.ok)` to the
// failure shape eagerly, so callers can read `result.message` without a cast.
export type ValidationResult =
  | { ok: true; reason?: never; message?: never }
  | { ok: false; reason: ParlayRuleViolation; message: string };

export interface ParlayCandidate {
  marketId: string;
  /** 'h2h' | 'spreads' | 'totals' | 'outrights' — caller is expected to
   *  default falsy values to 'h2h' before calling. */
  marketKey: string;
  optionId: string;
}

/**
 * Decide whether `candidate` can be added to a parlay that already
 * contains `existing`. Order of precedence: MAX_LEGS first, then the
 * both-sides check.
 */
export function validateParlayAdd(
  existing: ParlayCandidate[],
  candidate: ParlayCandidate,
): ValidationResult {
  if (existing.length >= MAX_PARLAY_LEGS) {
    return {
      ok: false,
      reason: 'MAX_LEGS',
      message: `Max ${MAX_PARLAY_LEGS} legs per parlay.`,
    };
  }

  const conflict = existing.some(
    (e) =>
      e.marketId === candidate.marketId &&
      e.marketKey === candidate.marketKey &&
      e.optionId !== candidate.optionId,
  );
  if (conflict) {
    return {
      ok: false,
      reason: 'BOTH_SIDES',
      message: "Can't parlay both sides of the same market.",
    };
  }

  return { ok: true };
}
