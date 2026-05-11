import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Swords, X, Wallet, Target, Clock3, Loader2, ChevronRight } from 'lucide-react';
import type { Bet } from '@/models';
import { challengeBetEligibility } from '@/lib/challengeBetEligibility';
import { getBets, proposeHeadToHead } from '@/services/dbOps';
import { CounterBetModal } from '@/components/CounterBetModal';

export interface CounterOpponentModalProps {
  isOpen: boolean;
  onClose: () => void;
  opponentUserId: string;
  opponentDisplayName: string;
  opponentAvatarUrl?: string | null;
  /** Hero-style image URL (same family as profile cover). */
  backgroundImageUrl: string;
  currentUserId: string | null;
  balance: number;
  /** When provided, skips fetching (e.g. profile already loaded their bets). Omit to load via getBets. */
  prefetchedBets?: Bet[];
}

/**
 * Pick one of the opponent's open slips to fade (head-to-head counter).
 */
export const CounterOpponentModal: React.FC<CounterOpponentModalProps> = ({
  isOpen,
  onClose,
  opponentUserId,
  opponentDisplayName,
  opponentAvatarUrl,
  backgroundImageUrl,
  currentUserId,
  balance,
  prefetchedBets,
}) => {
  const [bets, setBets] = useState<Bet[] | null>(prefetchedBets ? [...prefetchedBets] : null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingBets, setLoadingBets] = useState(false);
  const [selectedBetId, setSelectedBetId] = useState<string | null>(null);
  const [confirmBet, setConfirmBet] = useState<Bet | null>(null);

  // Reset selection only when opening / switching opponent — not when prefetched array identity changes.
  useEffect(() => {
    if (!isOpen) return;
    setSelectedBetId(null);
    setConfirmBet(null);
    setLoadError(null);
  }, [isOpen, opponentUserId]);

  useEffect(() => {
    if (!isOpen) return;
    if (prefetchedBets !== undefined) {
      setBets([...prefetchedBets].sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime()));
      return;
    }
    let cancelled = false;
    setLoadingBets(true);
    setBets(null);
    void getBets(opponentUserId)
      .then((rows) => {
        if (cancelled) return;
        setBets([...rows].sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime()));
        setLoadError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError('Could not load their bets.');
        setBets([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingBets(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, opponentUserId, prefetchedBets]);

  const selectedBet = useMemo(
    () => bets?.find((b) => b.id === selectedBetId) ?? null,
    [bets, selectedBetId],
  );

  const handleBackdropClose = useCallback(() => {
    if (confirmBet) {
      setConfirmBet(null);
      return;
    }
    onClose();
  }, [confirmBet, onClose]);

  if (!isOpen) return null;

  const safeBg = backgroundImageUrl.replace(/"/g, '\\"');

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="counter-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default bg-slate-950/80"
        aria-label="Close"
        onClick={handleBackdropClose}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-cover bg-center opacity-[0.22]"
        style={{ backgroundImage: `url("${safeBg}")` }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-b from-slate-950/88 via-slate-950/78 to-slate-950/92" aria-hidden />

      <div className="pointer-events-auto relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-700/90 bg-slate-900/95 shadow-2xl shadow-black/50 backdrop-blur-md animate-in zoom-in-95 duration-200">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-800/90 px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-600/80 bg-slate-950">
              {opponentAvatarUrl ? (
                <img
                  src={opponentAvatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-300">
                  {opponentDisplayName.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Counter</p>
              <h2 id="counter-modal-title" className="truncate text-lg font-black text-white">
                {opponentDisplayName}
              </h2>
              <p className="text-[11px] leading-snug text-slate-400">
                Choose one of their pending slips to counter.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleBackdropClose}
            className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="pointer-events-auto min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4 custom-scrollbar">
          {loadingBets && bets === null ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
              <Loader2 className="animate-spin" size={28} />
              <p className="text-sm">Loading their bets…</p>
            </div>
          ) : loadError ? (
            <p className="py-10 text-center text-sm text-red-300">{loadError}</p>
          ) : !bets?.length ? (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 py-12 text-center">
              <Swords className="mx-auto mb-2 text-slate-600" size={32} />
              <p className="text-sm font-medium text-slate-400">No bets to show</p>
              <p className="mt-1 px-4 text-xs text-slate-500">
                They don&apos;t have any slips loaded, or nothing is available to counter yet.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {bets.map((bet) => {
                const el = challengeBetEligibility(bet);
                const selected = bet.id === selectedBetId;
                const disabled = el.kind === 'disabled';
                return (
                  <li key={bet.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (!disabled) setSelectedBetId(bet.id);
                      }}
                      aria-pressed={!disabled && selected}
                      className={`relative w-full rounded-xl border px-3 py-3 text-left transition-all sm:px-4 ${
                        disabled
                          ? 'cursor-not-allowed border-slate-800/80 bg-slate-950/30 opacity-70'
                          : selected
                            ? 'border-red-500/60 bg-red-500/15 ring-2 ring-red-500/40 shadow-[0_0_0_1px_rgba(248,113,113,0.15)]'
                            : 'cursor-pointer border-slate-700/80 bg-slate-950/40 hover:border-red-500/35 hover:bg-slate-900/70'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                            disabled
                              ? 'border-slate-600 bg-slate-900'
                              : selected
                                ? 'border-red-400 bg-red-500 text-white'
                                : 'border-slate-500 bg-slate-900'
                          }`}
                          aria-hidden
                        >
                          {!disabled && selected ? (
                            <span className="block h-2 w-2 rounded-full bg-white" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-100 line-clamp-2">{bet.marketTitle}</p>
                          <p className="text-sm text-blue-300">{bet.optionLabel}</p>
                          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <Wallet size={11} /> ${bet.stake.toLocaleString()}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Target size={11} /> {bet.odds.toFixed(2)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock3 size={11} /> {(bet.status ?? 'PENDING').toLowerCase()}
                            </span>
                          </div>
                          {disabled && (
                            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              {el.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="pointer-events-auto shrink-0 border-t border-slate-800/90 bg-slate-950/50 px-4 py-3 sm:px-5">
          <button
            type="button"
            disabled={!selectedBet || challengeBetEligibility(selectedBet).kind !== 'enabled' || loadingBets}
            onClick={() => selectedBet && setConfirmBet(selectedBet)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/90 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            Continue
            <ChevronRight size={18} />
          </button>
          <p className="mt-2 text-center text-[10px] text-slate-500">
            Withdraw a pending counter from Head-to-Head → Their turn → Cancel challenge.
          </p>
        </div>
      </div>

      {confirmBet && currentUserId && (
        <CounterBetModal
          bet={confirmBet}
          ownerName={opponentDisplayName}
          balance={balance}
          overlayZIndexClass="z-[65]"
          counterDm={
            currentUserId && opponentUserId
              ? { messagingFromUserId: currentUserId, opponentUserId }
              : undefined
          }
          onConfirm={(originalBetId) => proposeHeadToHead(originalBetId, currentUserId)}
          onAfterSuccess={onClose}
          onClose={() => setConfirmBet(null)}
        />
      )}
    </div>
  );
};
