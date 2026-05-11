import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, query, where, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '@/models/constants';
import {
  acceptGameChallenge,
  cancelGameChallenge,
  declineGameChallenge,
  mapGameChallengeDoc,
  type GameChallengeDoc,
  type GameChallengeStatus,
} from '@/services/gameChallenges';

const GC_COL = 'gameChallenges';

/**
 * Realtime game-challenge rows for the Head-to-Head inbox (same buckets as counter-bets).
 */
export function useGameChallengesInboxViewModel(currentUserId: string | null) {
  const [items, setItems] = useState<GameChallengeDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const challDocsRef = useRef<QueryDocumentSnapshot<DocumentData>[]>([]);
  const oppDocsRef = useRef<QueryDocumentSnapshot<DocumentData>[]>([]);

  const flush = useCallback(() => {
    const merged = new Map<string, GameChallengeDoc>();
    for (const d of challDocsRef.current) {
      merged.set(d.id, mapGameChallengeDoc(d.id, d.data()));
    }
    for (const d of oppDocsRef.current) {
      merged.set(d.id, mapGameChallengeDoc(d.id, d.data()));
    }
    const all = [...merged.values()].sort(
      (a, b) => b.createdAt.toMillis() - a.createdAt.toMillis(),
    );
    setItems(all);
    setLoading(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      challDocsRef.current = [];
      oppDocsRef.current = [];
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);

    const qChall = query(collection(db, GC_COL), where('challengerUid', '==', currentUserId));
    const qOpp = query(collection(db, GC_COL), where('opponentUid', '==', currentUserId));

    const unsubChall = onSnapshot(
      qChall,
      (snap) => {
        challDocsRef.current = snap.docs;
        flush();
      },
      (e) => {
        console.error('gameChallenges challenger listener', e);
        setError(e.message);
        setLoading(false);
      },
    );

    const unsubOpp = onSnapshot(
      qOpp,
      (snap) => {
        oppDocsRef.current = snap.docs;
        flush();
      },
      (e) => {
        console.error('gameChallenges opponent listener', e);
        setError(e.message);
        setLoading(false);
      },
    );

    return () => {
      unsubChall();
      unsubOpp();
    };
  }, [currentUserId, flush]);

  const buckets = useMemo(() => {
    const incoming: GameChallengeDoc[] = [];
    const outgoing: GameChallengeDoc[] = [];
    const active: GameChallengeDoc[] = [];
    const history: GameChallengeDoc[] = [];
    const uid = currentUserId;

    items.forEach((gc) => {
      const st: GameChallengeStatus = gc.status;
      if (st === 'PENDING_ACCEPT') {
        if (gc.opponentUid === uid) incoming.push(gc);
        if (gc.challengerUid === uid) outgoing.push(gc);
      } else if (st === 'ACTIVE') {
        active.push(gc);
      } else {
        history.push(gc);
      }
    });
    return { incoming, outgoing, active, history };
  }, [items, currentUserId]);

  const opponentLabel = useCallback(
    (gc: GameChallengeDoc): string => {
      if (!currentUserId) return 'Peer';
      if (gc.challengerUid === currentUserId) {
        return gc.opponentName?.trim() || gc.opponentUid.slice(0, 8);
      }
      return gc.challengerName?.trim() || gc.challengerUid.slice(0, 8);
    },
    [currentUserId],
  );

  const accept = useCallback(
    async (challengeId: string) => {
      if (!currentUserId) return { success: false as const, error: 'USER_NOT_FOUND' };
      return acceptGameChallenge(challengeId, currentUserId);
    },
    [currentUserId],
  );

  const decline = useCallback(
    async (challengeId: string) => {
      if (!currentUserId) return { success: false as const, error: 'USER_NOT_FOUND' };
      return declineGameChallenge(challengeId, currentUserId);
    },
    [currentUserId],
  );

  const cancel = useCallback(
    async (challengeId: string) => {
      if (!currentUserId) return { success: false as const, error: 'USER_NOT_FOUND' };
      return cancelGameChallenge(challengeId, currentUserId);
    },
    [currentUserId],
  );

  return {
    loading,
    error,
    buckets,
    items,
    opponentLabel,
    accept,
    decline,
    cancel,
  };
}
