/**
 * Client-driven settlement for Odds API singles and parlays using the /scores endpoint.
 * Mock NFL markets (`mock-*`) are excluded; they use `settleUserMockNflGameBets`.
 */

import { gradeOddsApiSelection } from './apiOddsGrading';
import { fetchOddsApiScores } from './oddsApiScores';
import { getBets, recordParlayLegResult, settleBet } from './dbOps';
import type { Bet } from '@/models';

function isMockMarketId(id: string): boolean {
  return id.startsWith('mock-');
}

function collectSportKeysFromPending(pending: Bet[]): Set<string> {
  const sportKeys = new Set<string>();
  for (const bet of pending) {
    if (bet.betType === 'parlay') {
      for (const leg of bet.parlayLegs ?? []) {
        if (!leg.sportKey || isMockMarketId(leg.marketId)) continue;
        sportKeys.add(leg.sportKey);
      }
    } else {
      if (!bet.sportKey || isMockMarketId(bet.marketId)) continue;
      sportKeys.add(bet.sportKey);
    }
  }
  return sportKeys;
}

/**
 * Fetches recent final scores per involved sport and settles any pending API bets.
 * Safe to call on an interval; leg + bet updates are idempotent server-side.
 */
export async function settlePendingApiOddsBetsForUser(uid: string): Promise<void> {
  if (!uid) return;

  const bets = await getBets(uid);
  const pending = bets.filter((b) => (b.status ?? 'PENDING') === 'PENDING');
  if (pending.length === 0) return;

  const sportKeys = collectSportKeysFromPending(pending);
  if (sportKeys.size === 0) return;

  const scoresByEventId = new Map<string, import('./oddsApiScores').OddsApiScoreEvent>();
  for (const sk of sportKeys) {
    try {
      const events = await fetchOddsApiScores(sk, 3);
      for (const e of events) {
        if (e.completed && Array.isArray(e.scores) && e.scores.length >= 2) {
          scoresByEventId.set(e.id, e);
        }
      }
    } catch {
      /* quota / network */
    }
  }
  if (scoresByEventId.size === 0) return;

  for (const bet of pending) {
    try {
      if (bet.betType === 'parlay') {
        const legs = bet.parlayLegs ?? [];
        for (let idx = 0; idx < legs.length; idx++) {
          const leg = legs[idx];
          if (!leg.sportKey || isMockMarketId(leg.marketId)) continue;
          if (leg.result && leg.result !== 'PENDING') continue;
          const event = scoresByEventId.get(leg.marketId);
          if (!event) continue;
          const result = gradeOddsApiSelection(
            { label: leg.optionLabel, marketKey: leg.marketKey },
            event,
          );
          if (result !== null) {
            await recordParlayLegResult(bet.id, idx, result);
          }
        }
      } else {
        if (!bet.sportKey || isMockMarketId(bet.marketId)) continue;
        const event = scoresByEventId.get(bet.marketId);
        if (!event) continue;
        const result = gradeOddsApiSelection(
          { label: bet.optionLabel, marketKey: bet.pickedMarketKey },
          event,
        );
        if (result !== null) {
          await settleBet(bet, result);
        }
      }
    } catch {
      /* continue */
    }
  }
}
