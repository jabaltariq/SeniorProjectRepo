import React, { useState } from 'react';
import { X, Sparkles, Trophy, Flame } from 'lucide-react';
import type { Bet } from '../models';
import { computeParlayRollup } from '@/services/parlayRollup';

export type WinCelebrationPayload =
  | { kind: 'bet'; bet: Bet }
  | {
      kind: 'h2h_win';
      opponentUid: string;
      marketTitle: string;
      pickLabel: string;
      totalEscrow: number;
      /** Original ticket (optional; used for “your side” copy). */
      originalBetId?: string;
    }
  | {
      kind: 'gc_win';
      opponentUid: string;
      marketTitle: string;
      yourPick: string;
    };

export interface WinCelebrationModalProps {
  payload: WinCelebrationPayload | null;
  open: boolean;
  /** Called with optional banter for H2H / game-challenge wins (sent to DM thread). */
  onClose: (opts?: { banter?: string }) => void;
}

const isReducedParlay = (bet: Bet) => {
  if (bet.betType !== 'parlay' || !bet.parlayLegs?.length) return false;
  const rollup = computeParlayRollup(bet.parlayLegs, bet.stake);
  return rollup.state === 'WON' && rollup.reduced;
};

const resolvedPayout = (bet: Bet) => {
  if (bet.betType === 'parlay' && bet.parlayLegs?.length) {
    const rollup = computeParlayRollup(bet.parlayLegs, bet.stake);
    if (rollup.state === 'WON') return rollup.payout;
  }
  return bet.potentialPayout;
};

export const WinCelebrationModal: React.FC<WinCelebrationModalProps> = ({ payload, open, onClose }) => {
  const [banter, setBanter] = useState('');

  if (!open || !payload) return null;

  const showBanter = payload.kind === 'h2h_win' || payload.kind === 'gc_win';

  const handleClose = () => {
    const trimmed = banter.trim();
    setBanter('');
    if (showBanter && trimmed) onClose({ banter: trimmed });
    else onClose();
  };

  const shell =
    payload.kind === 'bet'
      ? 'border-violet-300/35 bg-[#120d24]/95 shadow-[0_0_80px_rgba(249,115,22,0.35)]'
      : 'border-amber-400/45 bg-[#1a1208]/95 shadow-[0_0_72px_rgba(251,191,36,0.38)]';

  const title =
    payload.kind === 'bet'
      ? 'You won!'
      : payload.kind === 'h2h_win'
        ? 'Counter cashed for you'
        : 'Challenge crushed';

  const subtitle =
    payload.kind === 'bet'
      ? 'Your bet has settled as a winner.'
      : payload.kind === 'h2h_win'
        ? 'You cleared the head-to-head counter — the escrow is yours.'
        : 'Your game challenge pick hit — flex if you want.';

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm px-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Win celebration"
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className={`h-[26rem] w-[26rem] rounded-full blur-3xl animate-pulse ${
            payload.kind === 'bet'
              ? 'bg-[radial-gradient(circle,_rgba(139,92,246,0.45)_0%,_rgba(16,185,129,0.35)_45%,_rgba(251,146,60,0.3)_75%,_rgba(2,6,23,0)_100%)]'
              : 'bg-[radial-gradient(circle,_rgba(251,191,36,0.5)_0%,_rgba(245,158,11,0.35)_40%,_rgba(234,88,12,0.25)_70%,_rgba(2,6,23,0)_100%)]'
          }`}
        />
      </div>

      <div
        className={`relative z-10 w-full max-w-md rounded-2xl border p-5 backdrop-blur-md animate-in fade-in zoom-in-95 duration-300 ${shell}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-3 top-3 rounded-full border border-slate-700/80 bg-slate-900/70 p-1.5 text-slate-300 transition-colors hover:text-white"
          aria-label="Close win message"
        >
          <X size={15} />
        </button>

        <div
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
            payload.kind === 'bet'
              ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-200'
              : 'border-amber-300/50 bg-amber-400/20 text-amber-100'
          }`}
        >
          {payload.kind === 'bet' ? (
            <>
              <Trophy size={12} />
              Winning ticket
            </>
          ) : payload.kind === 'h2h_win' ? (
            <>
              <Flame size={12} />
              Counter-bet win
            </>
          ) : (
            <>
              <Trophy size={12} />
              Challenge win
            </>
          )}
        </div>

        <h3
          className={`mt-3 text-3xl font-black tracking-tight ${
            payload.kind === 'bet'
              ? 'text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-emerald-300 to-orange-300'
              : 'text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-200 to-orange-200 drop-shadow-[0_0_14px_rgba(253,224,71,0.45)]'
          }`}
        >
          {title}
        </h3>
        <p className="mt-1 text-sm text-slate-300">{subtitle}</p>

        {payload.kind === 'bet' ? (
          <BetWinBody bet={payload.bet} />
        ) : payload.kind === 'h2h_win' ? (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-slate-950/60 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-200/80">Counter-bet</p>
            <p className="mt-2 text-sm font-semibold text-slate-100 line-clamp-2">{payload.marketTitle}</p>
            <p className="mt-1 text-xs text-slate-400">
              Ticket side: <span className="text-sky-300">{payload.pickLabel}</span>
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Escrow you collected</p>
            <p className="mt-0.5 text-2xl font-black text-amber-200">${payload.totalEscrow.toFixed(2)}</p>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-slate-950/60 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-200/80">Game challenge</p>
            <p className="mt-2 text-sm font-semibold text-slate-100 line-clamp-2">{payload.marketTitle}</p>
            <p className="mt-1 text-xs text-slate-400">
              Your side: <span className="text-emerald-300">{payload.yourPick}</span>
            </p>
          </div>
        )}

        {showBanter ? (
          <div className="mt-4">
            <label htmlFor="winBanter" className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Victory lap (optional) — drops in your DM with them
            </label>
            <textarea
              id="winBanter"
              value={banter}
              onChange={(e) => setBanter(e.target.value)}
              rows={2}
              maxLength={280}
              placeholder="Talk your talk…"
              className="mt-1.5 w-full resize-none rounded-xl border border-slate-600/70 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-amber-500/50"
            />
            <p className="mt-1 text-right text-[10px] text-slate-500">{banter.length}/280</p>
          </div>
        ) : null}

        <div className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-orange-200/90">
          <Sparkles size={12} />
          {payload.kind === 'bet' ? 'May the odds be ever in your favor.' : 'Congratulations on your win!'}
        </div>
      </div>
    </div>
  );
};

const BetWinBody: React.FC<{ bet: Bet }> = ({ bet }) => {
  const payout = resolvedPayout(bet);
  const reducedParlay = isReducedParlay(bet);
  const settledAtLabel = bet.settledAt?.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="mt-4 rounded-xl border border-slate-700/80 bg-slate-950/70 p-3.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Bet details</p>
      <p className="mt-2 text-sm font-semibold text-slate-100">{bet.optionLabel}</p>
      <p className="mt-1 text-xs text-slate-400">{bet.marketTitle}</p>

      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="font-semibold uppercase tracking-wider text-slate-500">Stake</p>
          <p className="mt-0.5 text-slate-200">${bet.stake.toFixed(2)}</p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-wider text-slate-500">Payout</p>
          <p className="mt-0.5 font-bold text-emerald-300">${payout.toFixed(2)}</p>
        </div>
      </div>

      {bet.betType === 'parlay' && (
        <p className="mt-2 text-[11px] text-violet-200/90">
          {bet.parlayLegs?.length ?? 0}-leg parlay
          {reducedParlay ? ' (reduced after pushed/voided leg)' : ''}
        </p>
      )}
      {settledAtLabel ? <p className="mt-1 text-[11px] text-slate-500">Settled at {settledAtLabel}</p> : null}
    </div>
  );
};
