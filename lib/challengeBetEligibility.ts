import type { Bet, BetStatus } from '@/models';

export type ChallengeBetEligibility =
  | { kind: 'enabled' }
  | { kind: 'disabled'; reason: string };

/** Whether another user can propose a head-to-head fade on this bet. */
export function challengeBetEligibility(bet: Bet): ChallengeBetEligibility {
  const status = (bet.status ?? 'PENDING') as BetStatus;
  if (status !== 'PENDING') {
    return { kind: 'disabled', reason: `This bet is already ${status.toLowerCase()}.` };
  }
  if (bet.betType === 'parlay') {
    return { kind: 'disabled', reason: "Parlays can't be faded yet." };
  }
  if (!bet.eventId || !bet.sportKey) {
    return { kind: 'disabled', reason: 'This bet is missing event info — too old to auto-settle a fade.' };
  }
  if (bet.odds <= 1) {
    return { kind: 'disabled', reason: "Invalid odds — can't compute a fair fade." };
  }
  if (bet.eventStartsAt && bet.eventStartsAt.getTime() <= Date.now()) {
    return { kind: 'disabled', reason: 'Game has already started — too late to fade.' };
  }
  return { kind: 'enabled' };
}
