import React from 'react';
import { X, Sparkles, Trophy } from 'lucide-react';
import type { Bet } from '../models';
import { computeParlayRollup } from '@/services/parlayRollup';

/* props for the win celebration modal */
/* bet: the bet that was won */
/* open: whether the modal is open */
/* onClose: function to close the modal
- aidan o'halloran at 1:45 am on may 8th 2026 */

interface WinCelebrationModalProps { 
  bet: Bet | null;
  open: boolean;
  onClose: () => void;
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

export const WinCelebrationModal: React.FC<WinCelebrationModalProps> = ({ bet, open, onClose }) => {
  if (!open || !bet) return null;

  const payout = resolvedPayout(bet);
  const reducedParlay = isReducedParlay(bet);
  const settledAtLabel = bet.settledAt?.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Winning bet celebration"
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,_rgba(139,92,246,0.45)_0%,_rgba(16,185,129,0.35)_45%,_rgba(251,146,60,0.3)_75%,_rgba(2,6,23,0)_100%)] blur-3xl animate-pulse" />
      </div>

      <div
        className="relative z-10 w-full max-w-md rounded-2xl border border-violet-300/35 bg-[#120d24]/95 p-5 shadow-[0_0_80px_rgba(249,115,22,0.35)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-300"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full border border-slate-700/80 bg-slate-900/70 p-1.5 text-slate-300 transition-colors hover:text-white"
          aria-label="Close win message"
        >
          <X size={15} />
        </button>

        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-400/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-200">
          <Trophy size={12} />
          Winning Ticket
        </div>

        <h3 className="mt-3 text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-emerald-300 to-orange-300">
          You won!
        </h3>
        <p className="mt-1 text-sm text-slate-300">Your bet has settled as a winner.</p>

        <div className="mt-4 rounded-xl border border-slate-700/80 bg-slate-950/70 p-3.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Bet Details</p>
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
          {settledAtLabel ? (
            <p className="mt-1 text-[11px] text-slate-500">Settled at {settledAtLabel}</p>
          ) : null}
        </div>

        <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold text-orange-200">
          May the odds be ever in your favor.
        </div>
      </div>
    </div>
  );
};
