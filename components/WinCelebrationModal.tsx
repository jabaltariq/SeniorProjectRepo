import React, { useState } from 'react';
import { X, Sparkles, Trophy, Flame, Scale, Skull } from 'lucide-react';
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
      kind: 'h2h_loss';
      opponentUid: string;
      marketTitle: string;
      /** Short label for the user’s head-to-head side (original pick or fade context). */
      yourSideLabel: string;
    }
  | {
      kind: 'h2h_push';
      opponentUid: string;
      marketTitle: string;
    }
  | {
      kind: 'gc_win';
      opponentUid: string;
      marketTitle: string;
      yourPick: string;
    }
  | {
      kind: 'gc_loss';
      opponentUid: string;
      marketTitle: string;
      yourPick: string;
    }
  | {
      kind: 'gc_push';
      opponentUid: string;
      marketTitle: string;
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

type PeerOutcomeKind = WinCelebrationPayload['kind'];

const isWinKind = (k: PeerOutcomeKind) =>
  k === 'bet' || k === 'h2h_win' || k === 'gc_win';
const isLossKind = (k: PeerOutcomeKind) => k === 'h2h_loss' || k === 'gc_loss';
const isPushKind = (k: PeerOutcomeKind) => k === 'h2h_push' || k === 'gc_push';

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

  const shell = (() => {
    if (payload.kind === 'bet') {
      return 'border-violet-300/35 bg-[#120d24]/95 shadow-[0_0_80px_rgba(249,115,22,0.35)]';
    }
    if (isLossKind(payload.kind)) {
      return 'border-rose-500/40 bg-[#1a0a10]/95 shadow-[0_0_72px_rgba(244,63,94,0.28)]';
    }
    if (isPushKind(payload.kind)) {
      return 'border-slate-500/40 bg-[#0f1419]/95 shadow-[0_0_56px_rgba(148,163,184,0.22)]';
    }
    return 'border-amber-400/45 bg-[#1a1208]/95 shadow-[0_0_72px_rgba(251,191,36,0.38)]';
  })();

  const title = (() => {
    switch (payload.kind) {
      case 'bet':
        return 'You won!';
      case 'h2h_win':
        return 'Counter cashed for you';
      case 'h2h_loss':
        return 'Counter did not cash';
      case 'h2h_push':
        return 'Head-to-head push';
      case 'gc_win':
        return 'Challenge crushed';
      case 'gc_loss':
        return 'Challenge settled';
      case 'gc_push':
        return 'Challenge push';
      default:
        return 'Result';
    }
  })();

  const subtitle = (() => {
    switch (payload.kind) {
      case 'bet':
        return 'Your bet has settled as a winner.';
      case 'h2h_win':
        return 'You cleared the head-to-head counter — the escrow is yours.';
      case 'h2h_loss':
        return 'This head-to-head is final — your side did not take the pot.';
      case 'h2h_push':
        return 'No winner on the counter — both escrows were returned.';
      case 'gc_win':
        return 'Your game challenge pick hit — flex if you want.';
      case 'gc_loss':
        return 'The game challenge is final — their side graded ahead of yours.';
      case 'gc_push':
        return "Neither side took the bragging rights — it's a push.";
      default:
        return '';
    }
  })();

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm px-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Bet outcome"
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className={`h-[26rem] w-[26rem] rounded-full blur-3xl animate-pulse ${
            payload.kind === 'bet'
              ? 'bg-[radial-gradient(circle,_rgba(139,92,246,0.45)_0%,_rgba(16,185,129,0.35)_45%,_rgba(251,146,60,0.3)_75%,_rgba(2,6,23,0)_100%)]'
              : isLossKind(payload.kind)
                ? 'bg-[radial-gradient(circle,_rgba(244,63,94,0.4)_0%,_rgba(127,29,29,0.35)_45%,_rgba(15,23,42,0.2)_75%,_rgba(2,6,23,0)_100%)]'
                : isPushKind(payload.kind)
                  ? 'bg-[radial-gradient(circle,_rgba(148,163,184,0.45)_0%,_rgba(71,85,105,0.3)_50%,_rgba(2,6,23,0)_100%)]'
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
          aria-label="Close outcome message"
        >
          <X size={15} />
        </button>

        <div
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
            payload.kind === 'bet'
              ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-200'
              : isLossKind(payload.kind)
                ? 'border-rose-400/45 bg-rose-500/15 text-rose-100'
                : isPushKind(payload.kind)
                  ? 'border-slate-500/50 bg-slate-600/20 text-slate-200'
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
          ) : payload.kind === 'h2h_loss' ? (
            <>
              <Skull size={12} />
              Counter-bet loss
            </>
          ) : payload.kind === 'h2h_push' ? (
            <>
              <Scale size={12} />
              Counter-bet push
            </>
          ) : payload.kind === 'gc_win' ? (
            <>
              <Trophy size={12} />
              Challenge win
            </>
          ) : payload.kind === 'gc_loss' ? (
            <>
              <Skull size={12} />
              Challenge loss
            </>
          ) : (
            <>
              <Scale size={12} />
              Challenge push
            </>
          )}
        </div>

        <h3
          className={`mt-3 text-3xl font-black tracking-tight ${
            payload.kind === 'bet'
              ? 'text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-emerald-300 to-orange-300'
              : isLossKind(payload.kind)
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-rose-200 via-rose-100 to-slate-200 drop-shadow-[0_0_14px_rgba(251,113,133,0.35)]'
                : isPushKind(payload.kind)
                  ? 'text-transparent bg-clip-text bg-gradient-to-r from-slate-200 via-slate-300 to-slate-400'
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
        ) : payload.kind === 'h2h_loss' ? (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-slate-950/60 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-200/80">Counter-bet</p>
            <p className="mt-2 text-sm font-semibold text-slate-100 line-clamp-2">{payload.marketTitle}</p>
            <p className="mt-1 text-xs text-slate-400">
              Your side: <span className="text-rose-200">{payload.yourSideLabel}</span>
            </p>
          </div>
        ) : payload.kind === 'h2h_push' ? (
          <div className="mt-4 rounded-xl border border-slate-600/50 bg-slate-950/60 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Counter-bet</p>
            <p className="mt-2 text-sm font-semibold text-slate-100 line-clamp-2">{payload.marketTitle}</p>
          </div>
        ) : payload.kind === 'gc_win' ? (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-slate-950/60 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-200/80">Game challenge</p>
            <p className="mt-2 text-sm font-semibold text-slate-100 line-clamp-2">{payload.marketTitle}</p>
            <p className="mt-1 text-xs text-slate-400">
              Your side: <span className="text-emerald-300">{payload.yourPick}</span>
            </p>
          </div>
        ) : payload.kind === 'gc_loss' ? (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-slate-950/60 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-200/80">Game challenge</p>
            <p className="mt-2 text-sm font-semibold text-slate-100 line-clamp-2">{payload.marketTitle}</p>
            <p className="mt-1 text-xs text-slate-400">
              Your side: <span className="text-rose-200">{payload.yourPick}</span>
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-slate-600/50 bg-slate-950/60 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Game challenge</p>
            <p className="mt-2 text-sm font-semibold text-slate-100 line-clamp-2">{payload.marketTitle}</p>
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

        <div
          className={`mt-4 flex items-center gap-1.5 text-[11px] font-semibold ${
            isWinKind(payload.kind) && payload.kind !== 'bet'
              ? 'text-orange-200/90'
              : isLossKind(payload.kind)
                ? 'text-rose-200/80'
                : isPushKind(payload.kind)
                  ? 'text-slate-400'
                  : 'text-orange-200/90'
          }`}
        >
          <Sparkles size={12} />
          {payload.kind === 'bet'
            ? 'May the odds be ever in your favor.'
            : isWinKind(payload.kind)
              ? 'Congratulations on your win!'
              : isLossKind(payload.kind)
                ? "Tough loss."
                : 'All even — no winner this time.'}
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
