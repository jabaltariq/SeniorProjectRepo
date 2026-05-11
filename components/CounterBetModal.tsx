import React, { useState } from 'react';
import { Swords, X, AlertCircle, Wallet, Target } from 'lucide-react';
import type { Bet } from '../models';
import type { ProposeHeadToHeadResult } from '../services/dbOps';

interface CounterBetModalProps {
  /** The bet being faded (someone else's pending bet). */
  bet: Bet;
  /** Display name of the bet's owner, used in the confirmation copy. */
  ownerName: string;
  /** Current user's wallet balance — used for client-side affordability hint. */
  balance: number;
  /** Async action that posts the H2H proposal. Returns a structured result. */
  onConfirm: (originalBetId: string) => Promise<ProposeHeadToHeadResult>;
  /** Closes the modal without proposing. */
  onClose: () => void;
  /** When set, called instead of onClose after a successful proposal (e.g. parent closes a wrapper modal). */
  onAfterSuccess?: () => void;
  /** Stacking order for nested modals (default z-50). */
  overlayZIndexClass?: string;
}

/**
 * Modal that walks the user through a Counter-Bet proposal.
 *
 * Shows the odds-matched stake math up front so the user knows exactly what
 * they're risking before they commit. Calls onConfirm() and surfaces the
 * structured error from the data layer if the proposal is rejected.
 *
 * @author Cursor (head-to-head feature)
 */
export const CounterBetModal: React.FC<CounterBetModalProps> = ({
  bet,
  ownerName,
  balance,
  onConfirm,
  onClose,
  onAfterSuccess,
  overlayZIndexClass = 'z-50',
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Odds-matched math. Mirror the server-side computeChallengerStake so the
  // user sees the exact value that will be debited.
  const challengerStake = Math.round(bet.stake * (bet.odds - 1) * 100) / 100;
  const totalEscrow = bet.stake + challengerStake;
  const insufficientFunds = balance < challengerStake;
  const oddsValid = bet.odds > 1;

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const result = await onConfirm(bet.id);
      if (result.success) {
        if (onAfterSuccess) onAfterSuccess();
        else onClose();
      } else {
        setErrorMsg(friendlyError(result.error));
      }
    } catch (e) {
      setErrorMsg('Something went wrong. Please try again.');
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`fixed inset-0 ${overlayZIndexClass} flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200`}>
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-red-900/20 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-red-500/10 p-2 text-red-400">
              <Swords size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Counter-Bet</h3>
              <p className="text-[11px] text-slate-500">Fade {ownerName}&apos;s pick — head-to-head</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Their bet card */}
          <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              {ownerName}&apos;s pick
            </p>
            <p className="font-semibold text-slate-100">{bet.marketTitle}</p>
            <p className="text-sm text-blue-300">{bet.optionLabel}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Wallet size={12} /> ${bet.stake.toLocaleString()} stake
              </span>
              <span className="inline-flex items-center gap-1">
                <Target size={12} /> {bet.odds.toFixed(2)} odds
              </span>
            </div>
          </div>

          {/* The math */}
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">You stake</span>
              <span className="font-bold text-red-300">${challengerStake.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">You win if their pick loses</span>
              <span className="font-bold text-emerald-300">${bet.stake.toFixed(2)}</span>
            </div>
            <div className="border-t border-red-500/20 pt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500">Total escrow</span>
              <span className="text-slate-300">${totalEscrow.toFixed(2)}</span>
            </div>
          </div>

          {/* Disclosure */}
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Stakes are odds-matched. {ownerName} must <span className="text-slate-300">accept</span>
            {' '}before the H2H is locked in. If they decline, you&apos;re refunded in full.
            No fades after kickoff.
          </p>

          {/* Errors */}
          {!oddsValid && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <p>This bet has invalid odds and can&apos;t be faded.</p>
            </div>
          )}
          {oddsValid && insufficientFunds && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <p>You need ${challengerStake.toFixed(2)} to fade this bet (you have ${balance.toFixed(2)}).</p>
            </div>
          )}
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <p>{errorMsg}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !oddsValid || insufficientFunds}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/90 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-red-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Swords size={13} />
            {submitting ? 'Submitting...' : `Counter-Bet $${challengerStake.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
};

function friendlyError(code: string): string {
  switch (code) {
    case 'BET_NOT_FOUND':       return 'That bet no longer exists.';
    case 'BET_ALREADY_SETTLED': return 'This bet has already been settled.';
    case 'EVENT_STARTED':       return 'The game has already started — too late to fade.';
    case 'OWN_BET':             return 'You can\'t counter-bet your own pick.';
    case 'PARLAY_UNSUPPORTED':  return 'Parlays can\'t be faded yet.';
    case 'MISSING_EVENT_INFO':  return 'This bet is missing event info — can\'t auto-settle a fade.';
    case 'INSUFFICIENT_FUNDS':  return 'You don\'t have enough funds to cover this stake.';
    case 'USER_NOT_FOUND':      return 'Account not found. Try signing in again.';
    case 'DUPLICATE_PROPOSAL':  return 'You already have an active fade against this bet.';
    default:                    return 'Something went wrong. Please try again.';
  }
}
