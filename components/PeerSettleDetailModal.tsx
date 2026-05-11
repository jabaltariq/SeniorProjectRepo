import React, { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/models/constants.ts';
import { X, Skull, Sparkles, Trophy } from 'lucide-react';
import type { Bet, HeadToHeadStatus, ParlayLeg } from '@/models';
import type { GameChallengeStatus } from '@/services/gameChallenges';
import { getGameChallenge } from '@/services/gameChallenges';

const H2H = 'headToHead';

export type PeerSettleKind = 'h2h' | 'gc';

export interface PeerSettleDetailModalProps {
  open: boolean;
  kind: PeerSettleKind | null;
  docId: string | null;
  currentUserId: string;
  onClose: () => void;
}

function h2hViewerOutcome(
  status: HeadToHeadStatus,
  uid: string,
  orig: string,
  chall: string,
): 'win' | 'loss' | 'push' | 'pending' {
  if (status === 'PUSH') return 'push';
  if (status === 'WON_BY_ORIGINAL') {
    if (uid === orig) return 'win';
    if (uid === chall) return 'loss';
  }
  if (status === 'WON_BY_CHALLENGER') {
    if (uid === chall) return 'win';
    if (uid === orig) return 'loss';
  }
  return 'pending';
}

function gcViewerOutcome(
  status: GameChallengeStatus,
  uid: string,
  ch: string,
  op: string,
): 'win' | 'loss' | 'push' | 'pending' {
  if (status === 'PUSH') return 'push';
  if (status === 'COMPLETED_CHALLENGER') {
    if (uid === ch) return 'win';
    if (uid === op) return 'loss';
  }
  if (status === 'COMPLETED_OPPONENT') {
    if (uid === op) return 'win';
    if (uid === ch) return 'loss';
  }
  return 'pending';
}

/**
 * Full-screen win / loss / push recap for a settled counter-bet or game challenge (opened from DM).
 */
export const PeerSettleDetailModal: React.FC<PeerSettleDetailModalProps> = ({
  open,
  kind,
  docId,
  currentUserId,
  onClose,
}) => {
  const [h2hStatus, setH2hStatus] = useState<HeadToHeadStatus | null>(null);
  const [marketTitle, setMarketTitle] = useState('');
  const [originalSide, setOriginalSide] = useState('');
  const [originalStake, setOriginalStake] = useState(0);
  const [challengerStake, setChallengerStake] = useState(0);
  const [originalUid, setOriginalUid] = useState('');
  const [challengerUid, setChallengerUid] = useState('');
  const [originalBetId, setOriginalBetId] = useState('');
  const [linkedBet, setLinkedBet] = useState<Bet | null>(null);

  const [gcStatus, setGcStatus] = useState<GameChallengeStatus | null>(null);
  const [gcTitle, setGcTitle] = useState('');
  const [gcChPick, setGcChPick] = useState('');
  const [gcOpPick, setGcOpPick] = useState('');
  const [gcChUid, setGcChUid] = useState('');
  const [gcOpUid, setGcOpUid] = useState('');

  useEffect(() => {
    if (!open || kind !== 'h2h' || !docId) return;
    const r = doc(db, H2H, docId);
    const unsub = onSnapshot(r, (snap) => {
      if (!snap.exists()) {
        setH2hStatus(null);
        return;
      }
      const d = snap.data();
      setH2hStatus((d.status as HeadToHeadStatus) ?? 'PENDING_ACCEPT');
      setMarketTitle(String(d.marketTitle ?? ''));
      setOriginalSide(String(d.originalSide ?? ''));
      setOriginalStake(Number(d.originalStake) || 0);
      setChallengerStake(Number(d.challengerStake) || 0);
      setOriginalUid(String(d.originalUserId ?? ''));
      setChallengerUid(String(d.challengerUserId ?? ''));
      setOriginalBetId(String(d.originalBetId ?? ''));
    });
    return () => unsub();
  }, [open, kind, docId]);

  useEffect(() => {
    if (!open || kind !== 'h2h' || !originalBetId) return;
    let cancelled = false;
    void getDoc(doc(db, 'bets', originalBetId)).then((snap) => {
      if (cancelled || !snap.exists()) return;
      const data = snap.data();
      const legs: ParlayLeg[] = Array.isArray(data.parlayLegs)
        ? data.parlayLegs.map((leg: Record<string, unknown>): ParlayLeg => ({
            marketId: String(leg.marketId ?? ''),
            marketTitle: String(leg.marketTitle ?? ''),
            sportKey: String(leg.sportKey ?? ''),
            optionId: String(leg.optionId ?? ''),
            optionLabel: String(leg.optionLabel ?? ''),
            odds: Number(leg.odds) || 0,
            marketKey: (leg.marketKey as ParlayLeg['marketKey']) ?? 'h2h',
            result: (leg.result as ParlayLeg['result']) ?? 'PENDING',
          }))
        : [];
      setLinkedBet({
        id: snap.id,
        userID: String(data.userID ?? ''),
        marketId: String(data.marketId ?? ''),
        marketTitle: String(data.marketTitle ?? ''),
        optionLabel: String(data.optionLabel ?? ''),
        betType: data.betType === 'parlay' ? 'parlay' : 'single',
        stake: Number(data.stake) || 0,
        odds: Number(data.odds) || 0,
        potentialPayout: Number(data.potentialPayout) || 0,
        placedAt: data.placedAt?.toDate?.() ?? new Date(),
        legCount: Number(data.legCount) ?? 1,
        parlayLegs: legs,
        status: (data.status ?? 'PENDING') as Bet['status'],
        settledAt: data.settledAt?.toDate?.(),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [open, kind, originalBetId]);

  useEffect(() => {
    if (!open || kind !== 'gc' || !docId) return;
    let cancelled = false;
    void getGameChallenge(docId).then((gc) => {
      if (cancelled || !gc) return;
      setGcStatus(gc.status);
      setGcTitle(gc.marketTitle);
      setGcChPick(gc.challengerPickLabel);
      setGcOpPick(gc.opponentPickLabel);
      setGcChUid(gc.challengerUid);
      setGcOpUid(gc.opponentUid);
    });
    const r = doc(db, 'gameChallenges', docId);
    const unsub = onSnapshot(r, (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      setGcStatus((d.status as GameChallengeStatus) ?? 'PENDING_ACCEPT');
      setGcTitle(String(d.marketTitle ?? ''));
      setGcChPick(String(d.challengerPickLabel ?? ''));
      setGcOpPick(String(d.opponentPickLabel ?? ''));
      setGcChUid(String(d.challengerUid ?? ''));
      setGcOpUid(String(d.opponentUid ?? ''));
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [open, kind, docId]);

  if (!open || !kind || !docId) return null;

  const shellWin =
    'border-amber-400/50 bg-gradient-to-br from-amber-500/25 via-yellow-500/15 to-orange-600/20 shadow-[0_0_60px_rgba(251,191,36,0.45)]';
  const shellLoss =
    'border-rose-500/50 bg-gradient-to-br from-rose-950/90 via-orange-950/60 to-slate-950/95 shadow-[0_0_48px_rgba(244,63,94,0.35)]';
  const shellPush = 'border-slate-500/40 bg-slate-900/90 shadow-[0_0_28px_rgba(148,163,184,0.25)]';

  if (kind === 'h2h' && h2hStatus) {
    const v = h2hViewerOutcome(h2hStatus, currentUserId, originalUid, challengerUid);
    const shell = v === 'win' ? shellWin : v === 'loss' ? shellLoss : v === 'push' ? shellPush : 'border-slate-600 bg-slate-950/90';
    const title =
      v === 'win' ? 'You won the counter' : v === 'loss' ? 'You lost the counter' : v === 'push' ? 'Counter pushed' : 'Counter-bet';
    const sub =
      v === 'win'
        ? h2hStatus === 'WON_BY_ORIGINAL'
          ? 'Your pick held — you took the escrow.'
          : 'The fade hit — you cleared the pot.'
        : v === 'loss'
          ? h2hStatus === 'WON_BY_ORIGINAL'
            ? 'Their pick stood — they took the escrow.'
            : 'Their fade cashed against your pick.'
          : v === 'push'
            ? 'Both escrows were returned.'
            : '';

    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/75 backdrop-blur-md px-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        <div
          className={`relative w-full max-w-lg rounded-2xl border p-6 ${shell}`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full border border-slate-600 bg-slate-950/60 p-1.5 text-slate-300 hover:text-white"
            aria-label="Close"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-2">
            {v === 'win' ? (
              <Trophy className="h-8 w-8 text-amber-200 drop-shadow-[0_0_12px_rgba(253,224,71,0.8)]" />
            ) : v === 'loss' ? (
              <Skull className="h-8 w-8 text-rose-200" />
            ) : (
              <Sparkles className="h-7 w-7 text-slate-300" />
            )}
            <h2
              className={`text-2xl font-black tracking-tight ${
                v === 'win'
                  ? 'text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-200 to-orange-200'
                  : v === 'loss'
                    ? 'text-transparent bg-clip-text bg-gradient-to-r from-rose-200 to-orange-200'
                    : 'text-slate-100'
              }`}
            >
              {title}
            </h2>
          </div>
          <p className="mt-2 text-sm text-slate-300">{sub}</p>
          <p className="mt-4 text-base font-bold text-slate-50">{marketTitle}</p>
          <p className="mt-1 text-sm text-slate-400">
            Contested pick: <span className="text-sky-300">{originalSide}</span>
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Escrow pot <span className="font-mono text-slate-100">${(originalStake + challengerStake).toFixed(2)}</span>
          </p>
          {linkedBet ? (
            <div className="mt-5 rounded-xl border border-slate-700/80 bg-slate-950/60 p-4 text-sm">
              <p className="text-[10px] font-bold uppercase text-slate-500">Original ticket</p>
              <p className="mt-1 font-semibold text-slate-100">{linkedBet.optionLabel}</p>
              <p className="text-xs text-slate-500">{linkedBet.marketTitle}</p>
              <p className="mt-2 text-xs text-slate-400">
                Stake ${linkedBet.stake.toFixed(2)} · Odds {linkedBet.odds.toFixed(2)} · {linkedBet.status}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (kind === 'gc' && gcStatus) {
    const v = gcViewerOutcome(gcStatus, currentUserId, gcChUid, gcOpUid);
    const shell = v === 'win' ? shellWin : v === 'loss' ? shellLoss : v === 'push' ? shellPush : 'border-slate-600 bg-slate-950/90';
    const title =
      v === 'win' ? 'You won the challenge' : v === 'loss' ? 'You lost the challenge' : v === 'push' ? 'Challenge pushed' : 'Game challenge';
    const yourPick = currentUserId === gcChUid ? gcChPick : gcOpPick;
    const theirPick = currentUserId === gcChUid ? gcOpPick : gcChPick;

    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/75 backdrop-blur-md px-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        <div
          className={`relative w-full max-w-lg rounded-2xl border p-6 ${shell}`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full border border-slate-600 bg-slate-950/60 p-1.5 text-slate-300 hover:text-white"
            aria-label="Close"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-2">
            {v === 'win' ? (
              <Trophy className="h-8 w-8 text-amber-200 drop-shadow-[0_0_12px_rgba(253,224,71,0.8)]" />
            ) : v === 'loss' ? (
              <Skull className="h-8 w-8 text-rose-200" />
            ) : (
              <Sparkles className="h-7 w-7 text-slate-300" />
            )}
            <h2
              className={`text-2xl font-black tracking-tight ${
                v === 'win'
                  ? 'text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-200 to-orange-200'
                  : v === 'loss'
                    ? 'text-transparent bg-clip-text bg-gradient-to-r from-rose-200 to-orange-200'
                    : 'text-slate-100'
              }`}
            >
              {title}
            </h2>
          </div>
          <p className="mt-4 text-base font-bold text-slate-50">{gcTitle}</p>
          <div className="mt-4 grid gap-2 rounded-xl border border-slate-700/70 bg-slate-950/50 p-4 text-sm">
            <p>
              <span className="text-slate-500">Your side:</span>{' '}
              <span className="font-semibold text-emerald-300">{yourPick}</span>
            </p>
            <p>
              <span className="text-slate-500">Their side:</span>{' '}
              <span className="font-semibold text-sky-300">{theirPick}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 px-4" onClick={onClose}>
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-400" onClick={(e) => e.stopPropagation()}>
        Loading…
      </div>
    </div>
  );
};
