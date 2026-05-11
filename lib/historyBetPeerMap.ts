import type { Bet } from '@/models';

export type HistoryBetPeerKind = 'counter' | 'challenge';

/** Links a settled/open ticket to the other participant (counter-bet or game challenge). */
export interface HistoryBetPeerInfo {
  kind: HistoryBetPeerKind;
  opponentUid: string;
  sourceId: string;
}

export type HeadToHeadDocRow = { id: string; data: Record<string, unknown> };
export type GameChallengeDocRow = { id: string; data: Record<string, unknown> };

const H2H_EXCLUDED = new Set(['DECLINED', 'CANCELLED']);
const GC_EXCLUDED = new Set(['DECLINED', 'CANCELLED', 'EXPIRED']);

/** Prefer explicit event id; fall back to mock NFL market id (`mock-*`). */
export function eventKeyForBet(bet: Bet): string | null {
  if (bet.eventId && String(bet.eventId).trim()) return String(bet.eventId).trim();
  if (bet.marketId?.startsWith('mock-')) return bet.marketId;
  return null;
}

function pickMatchesChallenge(
  uid: string,
  d: Record<string, unknown>,
  optionLabel: string,
): boolean {
  const ch = String(d.challengerUid ?? '');
  const op = String(d.opponentUid ?? '');
  const label = optionLabel.trim();
  if (uid === ch && label === String(d.challengerPickLabel ?? '').trim()) return true;
  if (uid === op && label === String(d.opponentPickLabel ?? '').trim()) return true;
  return false;
}

function betTouchesChallenge(bet: Bet, uid: string, d: Record<string, unknown>): boolean {
  const eventId = String(d.eventId ?? '');
  const ek = eventKeyForBet(bet);
  if (!ek || ek !== eventId) return false;
  const ch = String(d.challengerUid ?? '');
  const op = String(d.opponentUid ?? '');
  if (uid !== ch && uid !== op) return false;

  if (bet.betType === 'parlay' && bet.parlayLegs?.length) {
    return bet.parlayLegs.some(
      (leg) => leg.marketId === eventId && pickMatchesChallenge(uid, d, leg.optionLabel),
    );
  }
  return pickMatchesChallenge(uid, d, bet.optionLabel);
}

function gcCreatedMs(d: Record<string, unknown>): number {
  const c = d.createdAt as { toMillis?: () => number } | undefined;
  return typeof c?.toMillis === 'function' ? c.toMillis() : 0;
}

/**
 * Build betId → peer info. Counter-bet (same ticket) wins over a game-challenge match
 * when both could apply.
 */
export function compileHistoryBetPeers(
  uid: string,
  h2hRows: HeadToHeadDocRow[],
  gcRows: GameChallengeDocRow[],
  bets: Bet[],
): Record<string, HistoryBetPeerInfo> {
  const out: Record<string, HistoryBetPeerInfo> = {};

  for (const row of h2hRows) {
    const d = row.data;
    const status = String(d.status ?? '');
    if (H2H_EXCLUDED.has(status)) continue;
    const bid = String(d.originalBetId ?? '');
    if (!bid) continue;
    const orig = String(d.originalUserId ?? '');
    const chall = String(d.challengerUserId ?? '');
    const opponent = uid === orig ? chall : orig;
    if (!opponent) continue;
    out[bid] = { kind: 'counter', opponentUid: opponent, sourceId: row.id };
  }

  const sortedGc = [...gcRows].sort((a, b) => gcCreatedMs(b.data) - gcCreatedMs(a.data));

  for (const bet of bets) {
    if (out[bet.id]?.kind === 'counter') continue;
    const betUid = String(bet.userID ?? uid);
    if (betUid !== uid) continue;

    for (const row of sortedGc) {
      const d = row.data;
      const st = String(d.status ?? '');
      if (GC_EXCLUDED.has(st)) continue;
      if (!betTouchesChallenge(bet, uid, d)) continue;
      const ch = String(d.challengerUid ?? '');
      const op = String(d.opponentUid ?? '');
      const opponent = uid === ch ? op : ch;
      out[bet.id] = { kind: 'challenge', opponentUid: opponent, sourceId: row.id };
      break;
    }
  }

  return out;
}
