import React, { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/models/constants.ts';
import { useNavigate } from 'react-router-dom';
import { Swords, Trophy, ChevronDown, ChevronUp, Sparkles, Skull } from 'lucide-react';
import type { Bet, HeadToHeadStatus, ParlayLeg } from '@/models';

const H2H = 'headToHead';

interface CounterBetSettlementDmCardProps {
  h2hId: string;
  currentUserId: string;
  /** Opens full-screen win/loss recap (from parent / chat host). */
  onOpenFull?: () => void;
}

function outcomeForViewer(
  status: HeadToHeadStatus,
  currentUserId: string,
  originalUid: string,
  challengerUid: string,
): 'win' | 'loss' | 'push' | 'pending' {
  if (status === 'PUSH') return 'push';
  if (status === 'WON_BY_ORIGINAL') {
    if (currentUserId === originalUid) return 'win';
    if (currentUserId === challengerUid) return 'loss';
  }
  if (status === 'WON_BY_CHALLENGER') {
    if (currentUserId === challengerUid) return 'win';
    if (currentUserId === originalUid) return 'loss';
  }
  return 'pending';
}

/**
 * Rich DM bubble after a counter-bet settles — gold for your win, bronze/red for a loss, actions to run it back.
 */
export const CounterBetSettlementDmCard: React.FC<CounterBetSettlementDmCardProps> = ({
  h2hId,
  currentUserId,
  onOpenFull,
}) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<HeadToHeadStatus | null>(null);
  const [marketTitle, setMarketTitle] = useState('');
  const [originalSide, setOriginalSide] = useState('');
  const [originalStake, setOriginalStake] = useState(0);
  const [challengerStake, setChallengerStake] = useState(0);
  const [originalUid, setOriginalUid] = useState('');
  const [challengerUid, setChallengerUid] = useState('');
  const [originalBetId, setOriginalBetId] = useState('');
  const [linkedBet, setLinkedBet] = useState<Bet | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const r = doc(db, H2H, h2hId);
    const unsub = onSnapshot(r, (snap) => {
      if (!snap.exists()) {
        setStatus(null);
        return;
      }
      const d = snap.data();
      setStatus((d.status as HeadToHeadStatus) ?? 'PENDING_ACCEPT');
      setMarketTitle(String(d.marketTitle ?? ''));
      setOriginalSide(String(d.originalSide ?? ''));
      setOriginalStake(Number(d.originalStake) || 0);
      setChallengerStake(Number(d.challengerStake) || 0);
      setOriginalUid(String(d.originalUserId ?? ''));
      setChallengerUid(String(d.challengerUserId ?? ''));
      setOriginalBetId(String(d.originalBetId ?? ''));
    });
    return () => unsub();
  }, [h2hId]);

  useEffect(() => {
    if (!originalBetId) return;
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
      const b: Bet = {
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
      };
      setLinkedBet(b);
    });
    return () => {
      cancelled = true;
    };
  }, [originalBetId]);

  if (status === null) {
    return (
      <div className="rounded-xl border border-slate-700/60 bg-slate-950/50 px-3 py-2 text-xs text-slate-500">
        Loading counter result…
      </div>
    );
  }

  const viewer = outcomeForViewer(status, currentUserId, originalUid, challengerUid);
  const opponentUid = currentUserId === originalUid ? challengerUid : originalUid;
  const totalEscrow = originalStake + challengerStake;

  const shell =
    viewer === 'win'
      ? 'border-amber-400/50 bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-orange-600/15 shadow-[0_0_28px_rgba(251,191,36,0.35)]'
      : viewer === 'loss'
        ? 'border-rose-500/45 bg-gradient-to-br from-rose-950/80 via-orange-950/50 to-slate-950/90 shadow-[0_0_22px_rgba(244,63,94,0.28)]'
        : viewer === 'push'
          ? 'border-slate-500/40 bg-slate-900/80 shadow-[0_0_16px_rgba(148,163,184,0.2)]'
          : 'border-slate-600/50 bg-slate-950/60';

  const headline =
    viewer === 'win'
      ? 'You took the bag'
      : viewer === 'loss'
        ? 'Not your night'
        : viewer === 'push'
          ? 'Split the difference'
          : 'Counter-bet update';

  const sub =
    viewer === 'win'
      ? status === 'WON_BY_ORIGINAL'
        ? 'Your pick held — full escrow is yours.'
        : 'The fade hit — you cleared the counter.'
      : viewer === 'loss'
        ? status === 'WON_BY_ORIGINAL'
          ? 'Their pick stood — they walk with the counter pot.'
          : 'Your side didn’t cash — they earned the fade.'
        : viewer === 'push'
          ? 'Push — both escrows returned to wallets.'
          : 'Still settling…';

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
            Counter settled
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
          <p className="mt-2 text-sm font-bold text-slate-100 line-clamp-2">{marketTitle}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Faded side: <span className="text-sky-300">{originalSide}</span>
          </p>
          <p className="mt-1 text-[11px] font-semibold text-slate-400">
            Escrow pot <span className="text-slate-200">${totalEscrow.toFixed(2)}</span>
          </p>
          {onOpenFull ? (
            <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Tap for full-screen recap</p>
          ) : null}
        </div>
      </div>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowDetails((v) => !v);
        }}
        className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-slate-600/60 bg-slate-950/40 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-300 hover:bg-slate-800/60"
      >
        {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {showDetails ? 'Hide ticket' : 'View full bet'}
      </button>

      {showDetails && linkedBet && (
        <div className="mt-2 rounded-xl border border-slate-700/70 bg-slate-950/70 p-3 text-[11px] text-slate-300">
          <p className="font-semibold text-slate-200">{linkedBet.optionLabel}</p>
          <p className="mt-1 text-slate-500">{linkedBet.marketTitle}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <span className="text-slate-500">Stake</span>
              <p className="font-mono text-slate-200">${linkedBet.stake.toFixed(2)}</p>
            </div>
            <div>
              <span className="text-slate-500">Odds</span>
              <p className="font-mono text-slate-200">{linkedBet.odds.toFixed(2)}</p>
            </div>
            <div>
              <span className="text-slate-500">Result</span>
              <p className="font-mono text-slate-200">{linkedBet.status}</p>
            </div>
          </div>
        </div>
      )}
      {showDetails && !linkedBet && originalBetId ? (
        <p className="mt-2 text-center text-[11px] text-slate-500">Loading ticket…</p>
      ) : null}

      {opponentUid && viewer !== 'pending' ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/profile/${opponentUid}`, {
                state: { openGameChallenge: true },
              });
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
              navigate(`/profile/${opponentUid}`, {
                state: { openCounter: true },
              });
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
