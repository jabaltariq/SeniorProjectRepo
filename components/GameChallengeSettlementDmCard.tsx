import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/models/constants.ts';
import { useNavigate } from 'react-router-dom';
import { Skull, Sparkles, Trophy, Swords } from 'lucide-react';
import type { GameChallengeStatus } from '@/services/gameChallenges';

const COL = 'gameChallenges';

interface GameChallengeSettlementDmCardProps {
  challengeId: string;
  currentUserId: string;
  onOpenFull?: () => void;
}

function outcomeForViewer(
  status: GameChallengeStatus,
  uid: string,
  chUid: string,
  opUid: string,
): 'win' | 'loss' | 'push' | 'pending' {
  if (status === 'PUSH') return 'push';
  if (status === 'COMPLETED_CHALLENGER') {
    if (uid === chUid) return 'win';
    if (uid === opUid) return 'loss';
  }
  if (status === 'COMPLETED_OPPONENT') {
    if (uid === opUid) return 'win';
    if (uid === chUid) return 'loss';
  }
  return 'pending';
}

/** DM bubble when a game challenge settles — gold win / red loss; tap header for full-screen recap. */
export const GameChallengeSettlementDmCard: React.FC<GameChallengeSettlementDmCardProps> = ({
  challengeId,
  currentUserId,
  onOpenFull,
}) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<GameChallengeStatus | null>(null);
  const [title, setTitle] = useState('');
  const [chPick, setChPick] = useState('');
  const [opPick, setOpPick] = useState('');
  const [chUid, setChUid] = useState('');
  const [opUid, setOpUid] = useState('');

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
      setChPick(String(d.challengerPickLabel ?? ''));
      setOpPick(String(d.opponentPickLabel ?? ''));
      setChUid(String(d.challengerUid ?? ''));
      setOpUid(String(d.opponentUid ?? ''));
    });
    return () => unsub();
  }, [challengeId]);

  if (status === null) {
    return (
      <div className="rounded-xl border border-slate-700/60 bg-slate-950/50 px-3 py-2 text-xs text-slate-500">
        Loading challenge result…
      </div>
    );
  }

  const viewer = outcomeForViewer(status, currentUserId, chUid, opUid);
  const opponentUid = currentUserId === chUid ? opUid : chUid;
  const yourPick = currentUserId === chUid ? chPick : opPick;

  const shell =
    viewer === 'win'
      ? 'border-amber-400/50 bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-orange-600/15 shadow-[0_0_28px_rgba(251,191,36,0.38)]'
      : viewer === 'loss'
        ? 'border-rose-500/45 bg-gradient-to-br from-rose-950/80 via-orange-950/50 to-slate-950/90 shadow-[0_0_22px_rgba(244,63,94,0.28)]'
        : viewer === 'push'
          ? 'border-slate-500/40 bg-slate-900/80 shadow-[0_0_16px_rgba(148,163,184,0.2)]'
          : 'border-slate-600/50 bg-slate-950/60';

  const headline =
    viewer === 'win' ? 'You ran the table' : viewer === 'loss' ? 'They edged you' : viewer === 'push' ? 'Dead heat' : 'Challenge update';

  const sub =
    viewer === 'win'
      ? 'Your side hit — bragging rights earned.'
      : viewer === 'loss'
        ? 'Their pick was the right one this time.'
        : viewer === 'push'
          ? 'Push — nobody walks away crowned.'
          : 'Still updating…';

  return (
    <div className={`rounded-2xl border px-3.5 py-3.5 text-left ${shell}`}>
      <div
        role={onOpenFull ? 'button' : undefined}
        tabIndex={onOpenFull ? 0 : undefined}
        className={onOpenFull ? 'cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50' : undefined}
        onClick={() => onOpenFull?.()}
        onKeyDown={(e) => {
          if (!onOpenFull) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenFull();
          }
        }}
      >
        <div className="flex items-start gap-2">
          {viewer === 'win' ? (
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-200 ring-1 ring-amber-300/40">
              <Trophy className="h-5 w-5 drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
            </div>
          ) : viewer === 'loss' ? (
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/35">
              <Skull className="h-5 w-5" />
            </div>
          ) : (
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-600/30 text-slate-200">
              <Sparkles className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p
              className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                viewer === 'win' ? 'text-amber-200/90' : viewer === 'loss' ? 'text-rose-200/85' : 'text-slate-400'
              }`}
            >
              Challenge settled
            </p>
            <h4
              className={`mt-1 text-lg font-black tracking-tight ${
                viewer === 'win'
                  ? 'text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-200 to-orange-200 drop-shadow-[0_0_12px_rgba(253,224,71,0.45)]'
                  : viewer === 'loss'
                    ? 'text-transparent bg-clip-text bg-gradient-to-r from-rose-200 via-orange-200 to-amber-900/80'
                    : 'text-slate-100'
              }`}
            >
              {headline}
            </h4>
            <p className="mt-1 text-[12px] leading-snug text-slate-300">{sub}</p>
            <p className="mt-2 text-sm font-bold text-slate-100 line-clamp-2">{title}</p>
            <p className="mt-1 text-[11px] text-slate-400">
              Your side: <span className="text-emerald-300">{yourPick}</span>
            </p>
            {onOpenFull ? (
              <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Tap for full-screen recap</p>
            ) : null}
          </div>
        </div>
      </div>
      {opponentUid && viewer !== 'pending' ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/profile/${opponentUid}`, { state: { openGameChallenge: true } });
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 py-2 text-[11px] font-black uppercase tracking-wide text-amber-100 hover:bg-amber-500/20"
          >
            <Trophy size={14} />
            Challenge
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/profile/${opponentUid}`, { state: { openCounter: true } });
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/10 py-2 text-[11px] font-black uppercase tracking-wide text-red-100 hover:bg-red-500/20"
          >
            <Swords size={14} />
            Counter
          </button>
        </div>
      ) : null}
    </div>
  );
};
