/**
 * Realtime head-to-head + game-challenge rows merged into SocialActivity for the community feed.
 */

import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type QuerySnapshot,
} from 'firebase/firestore';
import { db } from '@/models/constants.ts';
import type { Friend } from '@/models';
import type { SocialActivity, SocialActivityKind } from '@/models';
import { getUserProfileSummary } from '@/services/dbOps';

const H2H = 'headToHead';
const GC = 'gameChallenges';
const PEER_FEED_LIMIT = 28;

function formatActivityTimestamp(d: Date): string {
  const ms = Date.now() - d.getTime();
  if (!Number.isFinite(ms) || ms < 60_000) return 'JUST NOW';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}M AGO`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}H AGO`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}D AGO`;
  return d.toLocaleDateString();
}

function tsMs(data: Record<string, unknown>, key: string): number {
  const t = data[key] as { toMillis?: () => number } | undefined;
  return typeof t?.toMillis === 'function' ? t.toMillis() : 0;
}

function labelTime(data: Record<string, unknown>): string {
  const settled = data.settledAt as { toDate?: () => Date } | undefined;
  const accepted = data.acceptedAt as { toDate?: () => Date } | undefined;
  const created = data.createdAt as { toDate?: () => Date } | undefined;
  const d =
    typeof settled?.toDate === 'function'
      ? settled.toDate()
      : typeof accepted?.toDate === 'function'
        ? accepted.toDate()
        : typeof created?.toDate === 'function'
          ? created.toDate()
          : new Date(0);
  return formatActivityTimestamp(d);
}

async function friendFor(uid: string, cache: Map<string, Friend | null>): Promise<Friend | null> {
  if (cache.has(uid)) return cache.get(uid)!;
  const f = await getUserProfileSummary(uid);
  cache.set(uid, f);
  return f;
}

async function buildPeerRowsFromSnapshots(
  h2hSnap: QuerySnapshot,
  gcSnap: QuerySnapshot,
): Promise<SocialActivity[]> {
  const fCache = new Map<string, Friend | null>();
  const out: SocialActivity[] = [];

  for (const docSnap of h2hSnap.docs) {
    const d = docSnap.data() as Record<string, unknown>;
    const st = String(d.status ?? '');
    if (st === 'DECLINED' || st === 'CANCELLED') continue;

    const challengerUid = String(d.challengerUserId ?? '');
    const originalUid = String(d.originalUserId ?? '');
    if (!challengerUid || !originalUid) continue;

    const chF = await friendFor(challengerUid, fCache);
    const orF = await friendFor(originalUid, fCache);
    const chName = chF?.name ?? 'Player';
    const orName = orF?.name ?? 'Player';

    const mt = String(d.marketTitle ?? 'Matchup');
    const sortKey =
      Math.max(tsMs(d, 'createdAt'), tsMs(d, 'acceptedAt'), tsMs(d, 'settledAt')) || Date.now();

    let action = 'counter-bet update ·';
    let target = mt;
    let primaryUid = challengerUid;
    let primaryName = chName;
    let primaryF = chF;
    let peerUid = originalUid;
    let peerName = orName;
    let peerF = orF;

    if (st === 'PENDING_ACCEPT') {
      action = 'challenged';
      target = `${orName}'s pick · ${mt}`;
    } else if (st === 'ACCEPTED') {
      action = 'counter-bet live vs';
      target = `${orName} · ${mt}`;
    } else if (st === 'WON_BY_ORIGINAL') {
      action = 'counter settled · pick held vs';
      target = `${chName} · ${mt}`;
      primaryUid = originalUid;
      primaryName = orName;
      primaryF = orF;
      peerUid = challengerUid;
      peerName = chName;
      peerF = chF;
    } else if (st === 'WON_BY_CHALLENGER') {
      action = 'counter settled · fader won vs';
      target = `${orName} · ${mt}`;
      primaryUid = challengerUid;
      primaryName = chName;
      primaryF = chF;
      peerUid = originalUid;
      peerName = orName;
      peerF = orF;
    } else if (st === 'PUSH') {
      action = 'counter-bet pushed ·';
      target = `${chName} vs ${orName} · ${mt}`;
    }

    out.push({
      id: `peer-h2h-${docSnap.id}`,
      userId: primaryUid,
      userName: primaryName,
      userAvatar: primaryName.slice(0, 2).toUpperCase(),
      userAvatarUrl: primaryF?.avatarUrl,
      userProfileBackgroundUrl: primaryF?.profileBackgroundUrl,
      action,
      target,
      timestamp: labelTime(d),
      sortKey,
      activityKind: 'peer_counter' as SocialActivityKind,
      peerUserId: peerUid,
      peerUserName: peerName,
      peerUserAvatar: peerName.slice(0, 2).toUpperCase(),
      peerUserAvatarUrl: peerF?.avatarUrl,
      peerH2hId: docSnap.id,
    });
  }

  for (const docSnap of gcSnap.docs) {
    const d = docSnap.data() as Record<string, unknown>;
    const st = String(d.status ?? '');
    if (st === 'DECLINED' || st === 'CANCELLED' || st === 'EXPIRED') continue;

    const challengerUid = String(d.challengerUid ?? '');
    const opponentUid = String(d.opponentUid ?? '');
    if (!challengerUid || !opponentUid) continue;

    const chF = await friendFor(challengerUid, fCache);
    const opF = await friendFor(opponentUid, fCache);
    const chName = chF?.name ?? 'Player';
    const opName = opF?.name ?? 'Player';

    const mt = String(d.marketTitle ?? 'Game');
    const sortKey =
      Math.max(tsMs(d, 'createdAt'), tsMs(d, 'acceptedAt'), tsMs(d, 'settledAt')) || Date.now();

    let action = 'game challenge ·';
    let target = mt;
    let primaryUid = challengerUid;
    let primaryName = chName;
    let primaryF = chF;
    let peerUid = opponentUid;
    let peerName = opName;
    let peerF = opF;

    if (st === 'PENDING_ACCEPT') {
      action = 'sent a game challenge to';
      target = `${opName} · ${mt}`;
    } else if (st === 'ACTIVE') {
      action = 'game challenge live vs';
      target = `${opName} · ${mt}`;
    } else if (st === 'COMPLETED_CHALLENGER') {
      action = 'won a game challenge vs';
      target = `${opName} · ${mt}`;
      primaryUid = challengerUid;
      primaryName = chName;
      primaryF = chF;
      peerUid = opponentUid;
      peerName = opName;
      peerF = opF;
    } else if (st === 'COMPLETED_OPPONENT') {
      action = 'won a game challenge vs';
      target = `${chName} · ${mt}`;
      primaryUid = opponentUid;
      primaryName = opName;
      primaryF = opF;
      peerUid = challengerUid;
      peerName = chName;
      peerF = chF;
    } else if (st === 'PUSH') {
      action = 'game challenge pushed ·';
      target = `${chName} vs ${opName} · ${mt}`;
    }

    out.push({
      id: `peer-gc-${docSnap.id}`,
      userId: primaryUid,
      userName: primaryName,
      userAvatar: primaryName.slice(0, 2).toUpperCase(),
      userAvatarUrl: primaryF?.avatarUrl,
      userProfileBackgroundUrl: primaryF?.profileBackgroundUrl,
      action,
      target,
      timestamp: labelTime(d),
      sortKey,
      activityKind: 'peer_challenge' as SocialActivityKind,
      peerUserId: peerUid,
      peerUserName: peerName,
      peerUserAvatar: peerName.slice(0, 2).toUpperCase(),
      peerUserAvatarUrl: peerF?.avatarUrl,
      peerChallengeId: docSnap.id,
    });
  }

  out.sort((a, b) => (b.sortKey ?? 0) - (a.sortKey ?? 0));
  return out;
}

/**
 * Streams recent counter-bets and game challenges into SocialActivity-shaped rows.
 */
export function subscribeToPeerActivityFeed(
  onUpdate: (rows: SocialActivity[]) => void,
  onError?: (err: Error) => void,
): () => void {
  let cancelled = false;
  let h2hSnap: QuerySnapshot | null = null;
  let gcSnap: QuerySnapshot | null = null;

  const emit = () => {
    if (cancelled || !h2hSnap || !gcSnap) return;
    void buildPeerRowsFromSnapshots(h2hSnap, gcSnap)
      .then((rows) => {
        if (!cancelled) onUpdate(rows);
      })
      .catch((err) => {
        if (!cancelled && onError) onError(err as Error);
        else if (!cancelled) console.error('buildPeerRowsFromSnapshots', err);
      });
  };

  const qh = query(collection(db, H2H), orderBy('createdAt', 'desc'), limit(PEER_FEED_LIMIT));
  const qg = query(collection(db, GC), orderBy('createdAt', 'desc'), limit(PEER_FEED_LIMIT));

  const uh = onSnapshot(
    qh,
    (snap) => {
      h2hSnap = snap;
      emit();
    },
    (err) => {
      if (!cancelled && onError) onError(err);
      else console.error('peerActivityFeed h2h', err);
    },
  );

  const ug = onSnapshot(
    qg,
    (snap) => {
      gcSnap = snap;
      emit();
    },
    (err) => {
      if (!cancelled && onError) onError(err);
      else console.error('peerActivityFeed gc', err);
    },
  );

  return () => {
    cancelled = true;
    uh();
    ug();
  };
}
