/**
 * Peer "game challenges": both users pick opposite sides on an upcoming h2h market.
 * Created from profile → DM thread; opponent accepts; settled from Odds API scores.
 * Winners get `challengeWins` on userInfo (leaderboard column).
 */

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  runTransaction,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/models/constants.ts';
import type { Market, MarketOption } from '@/models';
import { gradeOddsApiSelection } from '@/services/apiOddsGrading';
import { fetchOddsApiScores } from '@/services/oddsApiScores';
import type { OddsApiScoreEvent } from '@/services/oddsApiScores';
import { sendDirectMessage } from '@/services/dbOps';

const COL = 'gameChallenges';
const DM_PREFIX = 'GAME_CHALLENGE:';

export type GameChallengeStatus =
  | 'PENDING_ACCEPT'
  | 'ACTIVE'
  | 'DECLINED'
  | 'CANCELLED'
  | 'COMPLETED_CHALLENGER'
  | 'COMPLETED_OPPONENT'
  | 'PUSH';

export interface GameChallengeDoc {
  id: string;
  challengerUid: string;
  opponentUid: string;
  challengerName: string;
  opponentName: string;
  sportKey: string;
  eventId: string;
  marketTitle: string;
  challengerPickLabel: string;
  challengerPickMarketKey: MarketOption['marketKey'];
  opponentPickLabel: string;
  opponentPickMarketKey: MarketOption['marketKey'];
  status: GameChallengeStatus;
  createdAt: Timestamp;
  acceptedAt?: Timestamp;
  settledAt?: Timestamp;
}

function dmThreadId(a: string, b: string): string {
  const [x, y] = [a, b].sort((u, v) => u.localeCompare(v));
  return `dm:${x}:${y}`;
}

function pickH2hPair(market: Market): { a: MarketOption; b: MarketOption } | null {
  const h2h = market.options.filter((o) => (o.marketKey ?? 'h2h') === 'h2h');
  if (h2h.length !== 2) return null;
  return { a: h2h[0], b: h2h[1] };
}

export function isGameChallengeMessageText(text: string): boolean {
  return text.trimStart().startsWith(DM_PREFIX);
}

export function parseGameChallengeIdFromMessage(text: string): string | null {
  const t = text.trim();
  if (!t.startsWith(DM_PREFIX)) return null;
  const id = t.slice(DM_PREFIX.length).trim();
  return id.length > 0 ? id : null;
}

export async function getGameChallenge(id: string): Promise<GameChallengeDoc | null> {
  const snap = await getDoc(doc(db, COL, id));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    id: snap.id,
    challengerUid: String(d.challengerUid ?? ''),
    opponentUid: String(d.opponentUid ?? ''),
    challengerName: String(d.challengerName ?? ''),
    opponentName: String(d.opponentName ?? ''),
    sportKey: String(d.sportKey ?? ''),
    eventId: String(d.eventId ?? ''),
    marketTitle: String(d.marketTitle ?? ''),
    challengerPickLabel: String(d.challengerPickLabel ?? ''),
    challengerPickMarketKey: (d.challengerPickMarketKey as MarketOption['marketKey']) ?? 'h2h',
    opponentPickLabel: String(d.opponentPickLabel ?? ''),
    opponentPickMarketKey: (d.opponentPickMarketKey as MarketOption['marketKey']) ?? 'h2h',
    status: (d.status as GameChallengeStatus) ?? 'PENDING_ACCEPT',
    createdAt: (d.createdAt as Timestamp) ?? Timestamp.now(),
    acceptedAt: d.acceptedAt as Timestamp | undefined,
    settledAt: d.settledAt as Timestamp | undefined,
  };
}

export type CreateGameChallengeResult =
  | { success: true; challengeId: string }
  | { success: false; error: string };

/**
 * Creates a pending game challenge and posts a machine-readable line into the DM thread.
 * Only two-option h2h moneylines are supported.
 */
export async function createGameChallengeAndNotify(input: {
  challengerUid: string;
  opponentUid: string;
  challengerName: string;
  opponentName: string;
  market: Market;
  chosenOption: MarketOption;
}): Promise<CreateGameChallengeResult> {
  const { challengerUid, opponentUid, challengerName, opponentName, market, chosenOption } = input;
  if (!challengerUid || !opponentUid || challengerUid === opponentUid) {
    return { success: false, error: 'Invalid users' };
  }
  const pair = pickH2hPair(market);
  if (!pair) {
    return { success: false, error: 'Pick a two-team moneyline (h2h) market only.' };
  }
  const { a, b } = pair;
  const other = a.id === chosenOption.id ? b : b.id === chosenOption.id ? a : null;
  if (!other) {
    return { success: false, error: 'Pick one side of that matchup.' };
  }
  if (market.status === 'CLOSED') {
    return { success: false, error: 'That market is closed.' };
  }

  try {
    const ref = await addDoc(collection(db, COL), {
      challengerUid,
      opponentUid,
      challengerName,
      opponentName,
      sportKey: market.sport_key,
      eventId: market.id,
      marketTitle: market.title,
      challengerPickLabel: chosenOption.label,
      challengerPickMarketKey: chosenOption.marketKey ?? 'h2h',
      opponentPickLabel: other.label,
      opponentPickMarketKey: other.marketKey ?? 'h2h',
      status: 'PENDING_ACCEPT' as GameChallengeStatus,
      createdAt: Timestamp.now(),
    });

    const threadId = dmThreadId(challengerUid, opponentUid);
    const messageId = `gc_${ref.id}_${Date.now()}`;
    const dm = await sendDirectMessage({
      threadId,
      messageId,
      fromUserId: challengerUid,
      toUserId: opponentUid,
      text: `${DM_PREFIX}${ref.id}`,
      createdAtMs: Date.now(),
    });
    if (!dm.success) {
      return { success: false, error: 'Could not send DM' };
    }
    return { success: true, challengeId: ref.id };
  } catch (e) {
    console.error('createGameChallengeAndNotify', e);
    return { success: false, error: 'Could not create challenge' };
  }
}

export type MutateGameChallengeResult = { success: true } | { success: false; error: string };

export async function acceptGameChallenge(
  challengeId: string,
  actingUid: string,
): Promise<MutateGameChallengeResult> {
  try {
    await runTransaction(db, async (tx) => {
      const r = doc(db, COL, challengeId);
      const snap = await tx.get(r);
      if (!snap.exists()) throw new Error('NOT_FOUND');
      const d = snap.data();
      if (String(d.opponentUid) !== actingUid) throw new Error('WRONG_USER');
      if (d.status !== 'PENDING_ACCEPT') throw new Error('BAD_STATUS');
      tx.update(r, { status: 'ACTIVE', acceptedAt: Timestamp.now() });
    });
    return { success: true };
  } catch (e) {
    const m = e instanceof Error ? e.message : '';
    if (m === 'NOT_FOUND') return { success: false, error: 'Challenge not found' };
    if (m === 'WRONG_USER') return { success: false, error: 'Only they can accept' };
    if (m === 'BAD_STATUS') return { success: false, error: 'Already handled' };
    return { success: false, error: 'Accept failed' };
  }
}

export async function declineGameChallenge(
  challengeId: string,
  actingUid: string,
): Promise<MutateGameChallengeResult> {
  try {
    await runTransaction(db, async (tx) => {
      const r = doc(db, COL, challengeId);
      const snap = await tx.get(r);
      if (!snap.exists()) throw new Error('NOT_FOUND');
      const d = snap.data();
      if (String(d.opponentUid) !== actingUid) throw new Error('WRONG_USER');
      if (d.status !== 'PENDING_ACCEPT') throw new Error('BAD_STATUS');
      tx.update(r, { status: 'DECLINED' });
    });
    return { success: true };
  } catch {
    return { success: false, error: 'Decline failed' };
  }
}

export async function cancelGameChallenge(
  challengeId: string,
  actingUid: string,
): Promise<MutateGameChallengeResult> {
  try {
    await runTransaction(db, async (tx) => {
      const r = doc(db, COL, challengeId);
      const snap = await tx.get(r);
      if (!snap.exists()) throw new Error('NOT_FOUND');
      const d = snap.data();
      if (String(d.challengerUid) !== actingUid) throw new Error('WRONG_USER');
      if (d.status !== 'PENDING_ACCEPT') throw new Error('BAD_STATUS');
      tx.update(r, { status: 'CANCELLED' });
    });
    return { success: true };
  } catch {
    return { success: false, error: 'Cancel failed' };
  }
}

/** Poll-friendly: settle all ACTIVE challenges when scores are final (idempotent). */
export async function settleActiveGameChallengesGlobal(): Promise<void> {
  try {
    const q = query(collection(db, COL), where('status', '==', 'ACTIVE'), limit(80));
    const snap = await getDocs(q);
    if (snap.empty) return;

    const sportKeys = new Set<string>();
    const rows: GameChallengeDoc[] = [];
    for (const d of snap.docs) {
      const gc = await getGameChallenge(d.id);
      if (gc?.status === 'ACTIVE') {
        rows.push(gc);
        sportKeys.add(gc.sportKey);
      }
    }
    if (rows.length === 0) return;

    const scoresByEventId = new Map<string, OddsApiScoreEvent>();
    for (const sk of sportKeys) {
      try {
        const events = await fetchOddsApiScores(sk, 3);
        for (const e of events) {
          if (e.completed && Array.isArray(e.scores) && e.scores.length >= 2) {
            scoresByEventId.set(e.id, e);
          }
        }
      } catch {
        /* quota */
      }
    }
    if (scoresByEventId.size === 0) return;

    for (const gc of rows) {
      const event = scoresByEventId.get(gc.eventId);
      if (!event) continue;

      const gCh = gradeOddsApiSelection(
        { label: gc.challengerPickLabel, marketKey: gc.challengerPickMarketKey },
        event,
      );
      const gOp = gradeOddsApiSelection(
        { label: gc.opponentPickLabel, marketKey: gc.opponentPickMarketKey },
        event,
      );
      if (gCh === null || gOp === null) continue;

      let next: GameChallengeStatus = 'PUSH';
      let winnerUid: string | null = null;
      if (gCh === 'WON' && gOp === 'LOST') {
        next = 'COMPLETED_CHALLENGER';
        winnerUid = gc.challengerUid;
      } else if (gCh === 'LOST' && gOp === 'WON') {
        next = 'COMPLETED_OPPONENT';
        winnerUid = gc.opponentUid;
      } else if (gCh === 'PUSH' || gOp === 'PUSH') {
        next = 'PUSH';
      } else {
        continue;
      }

      try {
        await runTransaction(db, async (tx) => {
          const r = doc(db, COL, gc.id);
          const s = await tx.get(r);
          if (!s.exists()) return;
          if (s.data().status !== 'ACTIVE') return;
          tx.update(r, { status: next, settledAt: Timestamp.now() });
          if (winnerUid) {
            const uref = doc(db, 'userInfo', winnerUid);
            tx.update(uref, { challengeWins: increment(1) });
          }
        });
      } catch {
        /* concurrent settle */
      }
    }
  } catch (e) {
    console.error('settleActiveGameChallengesGlobal', e);
  }
}
