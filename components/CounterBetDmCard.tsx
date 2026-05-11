import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/models/constants.ts';
import { useNavigate } from 'react-router-dom';
import type { HeadToHeadStatus } from '@/models';

const H2H = 'headToHead';

interface CounterBetDmCardProps {
  h2hId: string;
  currentUserId: string;
}

const STATUS: Record<HeadToHeadStatus, string> = {
  PENDING_ACCEPT: 'Pending',
  ACCEPTED: 'Accepted',
  DECLINED: 'They declined',
  CANCELLED: 'Withdrawn',
  WON_BY_ORIGINAL: 'Settled (they kept the pick)',
  WON_BY_CHALLENGER: 'Settled (you won the fade)',
  PUSH: 'Push',
};

export const CounterBetDmCard: React.FC<CounterBetDmCardProps> = ({ h2hId, currentUserId }) => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [side, setSide] = useState('');
  const [stake, setStake] = useState(0);
  const [cStake, setCStake] = useState(0);
  const [status, setStatus] = useState<HeadToHeadStatus | null>(null);
  const [originalUid, setOriginalUid] = useState('');
  const [challengerUid, setChallengerUid] = useState('');

  useEffect(() => {
    const r = doc(db, H2H, h2hId);
    const unsub = onSnapshot(r, (snap) => {
      if (!snap.exists()) {
        setStatus(null);
        return;
      }
      const d = snap.data();
      setTitle(String(d.marketTitle ?? ''));
      setSide(String(d.originalSide ?? ''));
      setStake(Number(d.originalStake) || 0);
      setCStake(Number(d.challengerStake) || 0);
      setStatus((d.status as HeadToHeadStatus) ?? 'PENDING_ACCEPT');
      setOriginalUid(String(d.originalUserId ?? ''));
      setChallengerUid(String(d.challengerUserId ?? ''));
    });
    return () => unsub();
  }, [h2hId]);

  if (status === null) {
    return (
      <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 px-3 py-2 text-xs text-slate-500">
        Loading counter-bet…
      </div>
    );
  }

  const perspective =
    currentUserId === originalUid ? 'original' : currentUserId === challengerUid ? 'challenger' : 'spectator';

  return (
    <div className="rounded-xl border border-red-500/35 bg-red-500/[0.07] px-3 py-3 text-left">
      <p className="text-[10px] font-bold uppercase tracking-wider text-red-300/90">Counter-bet</p>
      <p className="mt-1 text-sm font-bold text-slate-100 line-clamp-2">{title}</p>
      <p className="mt-1 text-[11px] text-slate-300">
        Their pick: <span className="text-blue-300">{side}</span>
      </p>
      <p className="mt-1 text-[11px] text-slate-500">
        Stakes (escrow): ${stake.toFixed(2)} vs ${cStake.toFixed(2)}
      </p>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {STATUS[status]}
        {perspective === 'spectator' ? ' · Open Head-to-Head if this is your thread.' : ''}
      </p>
      <button
        type="button"
        onClick={() => navigate('/head-to-head')}
        className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950/40 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-200 hover:bg-slate-800/80"
      >
        Open head-to-head
      </button>
    </div>
  );
};
