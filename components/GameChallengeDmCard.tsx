import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/models/constants.ts';
import {
  acceptGameChallenge,
  cancelGameChallenge,
  declineGameChallenge,
  type GameChallengeStatus,
} from '@/services/gameChallenges';

const COL = 'gameChallenges';

interface GameChallengeDmCardProps {
  challengeId: string;
  currentUserId: string;
}

const STATUS_LABEL: Record<GameChallengeStatus, string> = {
  PENDING_ACCEPT: 'Awaiting their accept',
  ACTIVE: 'Accepted — locks when the game ends',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
  COMPLETED_CHALLENGER: 'Challenger won',
  COMPLETED_OPPONENT: 'Opponent won',
  PUSH: 'Push — no winner',
};

export const GameChallengeDmCard: React.FC<GameChallengeDmCardProps> = ({ challengeId, currentUserId }) => {
  const [status, setStatus] = useState<GameChallengeStatus | null>(null);
  const [title, setTitle] = useState('');
  const [challengerName, setChallengerName] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [challengerPick, setChallengerPick] = useState('');
  const [opponentPick, setOpponentPick] = useState('');
  const [challengerUid, setChallengerUid] = useState('');
  const [opponentUid, setOpponentUid] = useState('');
  const [acting, setActing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const r = doc(db, COL, challengeId);
    const unsub = onSnapshot(r, (snap) => {
      if (!snap.exists()) {
        setStatus(null);
        return;
      }
      const d = snap.data();
      setStatus((d.status as GameChallengeStatus) ?? 'PENDING_ACCEPT');
      setTitle(String(d.marketTitle ?? ''));
      setChallengerName(String(d.challengerName ?? ''));
      setOpponentName(String(d.opponentName ?? ''));
      setChallengerPick(String(d.challengerPickLabel ?? ''));
      setOpponentPick(String(d.opponentPickLabel ?? ''));
      setChallengerUid(String(d.challengerUid ?? ''));
      setOpponentUid(String(d.opponentUid ?? ''));
    });
    return () => unsub();
  }, [challengeId]);

  const isChallenger = currentUserId === challengerUid;
  const isOpponent = currentUserId === opponentUid;

  const run = async (fn: () => Promise<{ success: boolean; error?: string }>) => {
    setActing(true);
    setErr(null);
    const res = await fn();
    setActing(false);
    if (!res.success) setErr(res.error ?? 'Failed');
  };

  if (status === null) {
    return (
      <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 px-3 py-2 text-xs text-slate-500">
        Loading challenge…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/35 bg-amber-500/[0.07] px-3 py-3 text-left">
      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90">Game challenge</p>
      <p className="mt-1 text-sm font-bold text-slate-100 line-clamp-2">{title}</p>
      <div className="mt-2 space-y-1 text-[11px] text-slate-300">
        <p>
          <span className="text-slate-500">{challengerName}:</span> {challengerPick}
        </p>
        <p>
          <span className="text-slate-500">{opponentName} (if accepted):</span> {opponentPick}
        </p>
      </div>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{STATUS_LABEL[status]}</p>

      {err && <p className="mt-2 text-[11px] text-red-300">{err}</p>}

      {status === 'PENDING_ACCEPT' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {isOpponent && (
            <>
              <button
                type="button"
                disabled={acting}
                onClick={() => void run(() => acceptGameChallenge(challengeId, currentUserId))}
                className="rounded-lg bg-emerald-600/90 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Accept
              </button>
              <button
                type="button"
                disabled={acting}
                onClick={() => void run(() => declineGameChallenge(challengeId, currentUserId))}
                className="rounded-lg border border-slate-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                Decline
              </button>
            </>
          )}
          {isChallenger && (
            <button
              type="button"
              disabled={acting}
              onClick={() => void run(() => cancelGameChallenge(challengeId, currentUserId))}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              Cancel invite
            </button>
          )}
        </div>
      )}
    </div>
  );
};
