import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HeadToHead, HeadToHeadStatus } from '../models';
import {
  acceptHeadToHead,
  cancelHeadToHead,
  declineHeadToHead,
  getIncomingHeadToHead,
  getOutgoingHeadToHead,
  getUserName,
  mapHeadToHead,
  proposeHeadToHead,
  type AcceptHeadToHeadResult,
  type DeclineOrCancelResult,
  type ProposeHeadToHeadResult,
} from '../services/dbOps';
import { collection, onSnapshot, query, where, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '@/models/constants';

const H2H_COLLECTION = 'headToHead';

/**
 * Manages the current user's Head-to-Head challenges.
 *
 * Buckets the H2Hs into four UI-friendly lists:
 *   - incoming:  someone challenged a pending bet of mine, awaiting my accept
 *   - outgoing:  I challenged someone else's bet, awaiting their accept
 *   - active:    challenge accepted, awaiting underlying event result
 *   - history:   resolved (DECLINED / CANCELLED / WON_BY_* / PUSH)
 *
 * Display names for opponents are looked up via getUserName() and cached so
 * we don't re-fetch on every render.
 *
 * @author Cursor (head-to-head feature)
 */
export type HeadToHeadBucket = 'incoming' | 'outgoing' | 'active' | 'history';

export function useHeadToHeadViewModel(currentUserId: string | null) {
  const [items, setItems] = useState<HeadToHead[]>([]);
  const [nameByUid, setNameByUid] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const origDocsRef = useRef<QueryDocumentSnapshot<DocumentData>[]>([]);
  const challDocsRef = useRef<QueryDocumentSnapshot<DocumentData>[]>([]);

  const mergeAndSetItems = useCallback(() => {
    const merged = new Map<string, HeadToHead>();
    for (const d of origDocsRef.current) {
      merged.set(d.id, mapHeadToHead(d.id, d.data()));
    }
    for (const d of challDocsRef.current) {
      merged.set(d.id, mapHeadToHead(d.id, d.data()));
    }
    const all = [...merged.values()].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    setItems(all);
    setLoading(false);
    setError(null);

    if (!currentUserId || all.length === 0) return;

    const opponentUids = new Set<string>();
    all.forEach((h2h) => {
      if (h2h.challengerUserId !== currentUserId) opponentUids.add(h2h.challengerUserId);
      if (h2h.originalUserId !== currentUserId) opponentUids.add(h2h.originalUserId);
    });

    setNameByUid((prev) => {
      const missing = [...opponentUids].filter((uid) => !prev[uid]);
      if (missing.length === 0) return prev;
      void Promise.all(
        missing.map(async (uid) => [uid, await getUserName(uid).catch(() => uid)] as const),
      ).then((fetched) => {
        setNameByUid((p) => {
          const next = { ...p };
          fetched.forEach(([uid, name]) => {
            next[uid] = name;
          });
          return next;
        });
      });
      return prev;
    });
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      origDocsRef.current = [];
      challDocsRef.current = [];
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);

    const qOrig = query(collection(db, H2H_COLLECTION), where('originalUserId', '==', currentUserId));
    const qChall = query(collection(db, H2H_COLLECTION), where('challengerUserId', '==', currentUserId));

    const unsubOrig = onSnapshot(
      qOrig,
      (snap) => {
        origDocsRef.current = snap.docs;
        mergeAndSetItems();
      },
      (e) => {
        console.error('headToHead originalUserId listener', e);
        setError(e.message);
        setLoading(false);
      },
    );

    const unsubChall = onSnapshot(
      qChall,
      (snap) => {
        challDocsRef.current = snap.docs;
        mergeAndSetItems();
      },
      (e) => {
        console.error('headToHead challengerUserId listener', e);
        setError(e.message);
        setLoading(false);
      },
    );

    return () => {
      unsubOrig();
      unsubChall();
    };
  }, [currentUserId, mergeAndSetItems]);

  // ── Bucketing ──────────────────────────────────────────────────
  const buckets = useMemo(() => {
    const incoming: HeadToHead[] = [];
    const outgoing: HeadToHead[] = [];
    const active: HeadToHead[] = [];
    const history: HeadToHead[] = [];
    items.forEach((h2h) => {
      const isOriginal = h2h.originalUserId === currentUserId;
      const isChallenger = h2h.challengerUserId === currentUserId;
      const status: HeadToHeadStatus = h2h.status;

      if (status === 'PENDING_ACCEPT') {
        if (isOriginal) incoming.push(h2h);
        if (isChallenger) outgoing.push(h2h);
      } else if (status === 'ACCEPTED') {
        active.push(h2h);
      } else {
        history.push(h2h);
      }
    });
    return { incoming, outgoing, active, history };
  }, [items, currentUserId]);

  const refresh = useCallback(async () => {
    if (!currentUserId) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [incoming, outgoing] = await Promise.all([
        getIncomingHeadToHead(currentUserId),
        getOutgoingHeadToHead(currentUserId),
      ]);
      const merged = new Map<string, HeadToHead>();
      [...incoming, ...outgoing].forEach((h2h) => merged.set(h2h.id, h2h));
      const all = [...merged.values()].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
      setItems(all);

      const opponentUids = new Set<string>();
      all.forEach((h2h) => {
        if (h2h.challengerUserId !== currentUserId) opponentUids.add(h2h.challengerUserId);
        if (h2h.originalUserId !== currentUserId) opponentUids.add(h2h.originalUserId);
      });
      setNameByUid((prev) => {
        const missing = [...opponentUids].filter((uid) => !prev[uid]);
        if (missing.length === 0) return prev;
        void Promise.all(
          missing.map(async (uid) => [uid, await getUserName(uid).catch(() => uid)] as const),
        ).then((fetched) => {
          setNameByUid((p) => {
            const next = { ...p };
            fetched.forEach(([uid, name]) => {
              next[uid] = name;
            });
            return next;
          });
        });
        return prev;
      });
    } catch (e) {
      console.error('Failed to load head-to-head challenges', e);
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  const propose = useCallback(
    async (originalBetId: string): Promise<ProposeHeadToHeadResult> => {
      if (!currentUserId) {
        return { success: false, error: 'USER_NOT_FOUND' };
      }
      const result = await proposeHeadToHead(originalBetId, currentUserId);
      if (result.success) await refresh();
      return result;
    },
    [currentUserId, refresh],
  );

  const accept = useCallback(
    async (h2hId: string): Promise<AcceptHeadToHeadResult> => {
      if (!currentUserId) {
        return { success: false, error: 'USER_NOT_FOUND' };
      }
      const result = await acceptHeadToHead(h2hId, currentUserId);
      if (result.success) await refresh();
      return result;
    },
    [currentUserId, refresh],
  );

  const decline = useCallback(
    async (h2hId: string): Promise<DeclineOrCancelResult> => {
      if (!currentUserId) {
        return { success: false, error: 'WRONG_USER' };
      }
      const result = await declineHeadToHead(h2hId, currentUserId);
      if (result.success) await refresh();
      return result;
    },
    [currentUserId, refresh],
  );

  const cancel = useCallback(
    async (h2hId: string): Promise<DeclineOrCancelResult> => {
      if (!currentUserId) {
        return { success: false, error: 'WRONG_USER' };
      }
      const result = await cancelHeadToHead(h2hId, currentUserId);
      if (result.success) await refresh();
      return result;
    },
    [currentUserId, refresh],
  );

  /** "OG" or "ME" depending on which side the current user is on. */
  const opponentNameFor = useCallback(
    (h2h: HeadToHead): string => {
      const opponentUid =
        h2h.challengerUserId === currentUserId ? h2h.originalUserId : h2h.challengerUserId;
      return nameByUid[opponentUid] ?? opponentUid.slice(0, 6);
    },
    [currentUserId, nameByUid],
  );

  return {
    loading,
    error,
    buckets,
    items,
    refresh,
    propose,
    accept,
    decline,
    cancel,
    opponentNameFor,
  };
}
