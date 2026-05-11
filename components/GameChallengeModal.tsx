import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Loader2, ChevronRight, Trophy } from 'lucide-react';
import type { Market, MarketOption } from '@/models';
import { createGameChallengeAndNotify } from '@/services/gameChallenges';

export interface GameChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  markets: Market[];
  opponentUserId: string;
  opponentDisplayName: string;
  opponentAvatarUrl?: string | null;
  backgroundImageUrl: string;
  currentUserId: string | null;
  challengerDisplayName: string;
  onSent?: () => void;
}

function h2hPair(market: Market): [MarketOption, MarketOption] | null {
  const h2h = market.options.filter((o) => (o.marketKey ?? 'h2h') === 'h2h');
  if (h2h.length !== 2) return null;
  return [h2h[0], h2h[1]];
}

/**
 * Pick an upcoming two-sided moneyline; sends a DM the opponent must accept.
 */
export const GameChallengeModal: React.FC<GameChallengeModalProps> = ({
  isOpen,
  onClose,
  markets,
  opponentUserId,
  opponentDisplayName,
  opponentAvatarUrl,
  backgroundImageUrl,
  currentUserId,
  challengerDisplayName,
  onSent,
}) => {
  const eligible = useMemo(
    () =>
      markets.filter((m) => m.status !== 'CLOSED' && h2hPair(m) !== null),
    [markets],
  );

  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [selectedOption, setSelectedOption] = useState<MarketOption | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setSelectedMarket(null);
    setSelectedOption(null);
    setError(null);
    setSending(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    reset();
  }, [isOpen, opponentUserId, reset]);

  const pair = selectedMarket ? h2hPair(selectedMarket) : null;

  const handleSend = async () => {
    if (!currentUserId || !selectedMarket || !selectedOption) return;
    setSending(true);
    setError(null);
    const res = await createGameChallengeAndNotify({
      challengerUid: currentUserId,
      opponentUid: opponentUserId,
      challengerName: challengerDisplayName,
      opponentName: opponentDisplayName,
      market: selectedMarket,
      chosenOption: selectedOption,
    });
    setSending(false);
    if (res.success) {
      onSent?.();
      onClose();
    } else {
      setError(res.error ?? 'Could not send');
    }
  };

  if (!isOpen) return null;

  const safeBg = backgroundImageUrl.replace(/"/g, '\\"');

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-challenge-title"
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default bg-slate-950/80"
        aria-label="Close"
        onClick={() => !sending && onClose()}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-cover bg-center opacity-[0.22]"
        style={{ backgroundImage: `url("${safeBg}")` }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-b from-slate-950/88 via-slate-950/78 to-slate-950/92" aria-hidden />

      <div className="pointer-events-auto relative z-10 flex max-h-[min(90vh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-amber-700/40 bg-slate-900/95 shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-200">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-800/90 px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-amber-600/50 bg-slate-950">
              {opponentAvatarUrl ? (
                <img
                  src={opponentAvatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-sm font-bold text-amber-100">
                  {opponentDisplayName.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/90">Challenge</p>
              <h2 id="game-challenge-title" className="truncate text-lg font-black text-white">
                vs. {opponentDisplayName}
              </h2>
              <p className="text-[11px] leading-snug text-slate-400">
                New pick on a game — they accept in chat. Winner earns a leaderboard challenge win when the game
                grades.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={sending}
            onClick={() => onClose()}
            className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200 disabled:opacity-50"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="pointer-events-auto min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4 custom-scrollbar">
          {!selectedMarket ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Choose a game</p>
              {eligible.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  No open two-team moneylines loaded. Open Markets first so games appear here.
                </p>
              ) : (
                eligible.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedMarket(m);
                      setSelectedOption(null);
                    }}
                    className="w-full rounded-xl border border-slate-700/80 bg-slate-950/50 px-3 py-3 text-left text-sm text-slate-100 transition-colors hover:border-amber-500/40 hover:bg-slate-900/70"
                  >
                    <span className="font-bold line-clamp-2">{m.title}</span>
                    <span className="mt-1 block text-[11px] uppercase tracking-wider text-slate-500">
                      {m.sport_key} · {m.status}
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedMarket(null);
                  setSelectedOption(null);
                }}
                className="text-xs font-bold uppercase tracking-wider text-amber-400 hover:text-amber-300"
              >
                ← Back to games
              </button>
              <p className="text-sm font-semibold text-slate-200">{selectedMarket.title}</p>
              <p className="text-[11px] text-slate-500">Pick your side. They get the other side if they accept.</p>
              {pair && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {pair.map((opt) => {
                    const picked = selectedOption?.id === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedOption(opt)}
                        className={`rounded-xl border px-3 py-4 text-center text-sm font-bold transition-all ${
                          picked
                            ? 'border-amber-500/70 bg-amber-500/15 ring-2 ring-amber-500/35 text-amber-100'
                            : 'border-slate-700 bg-slate-950/50 text-slate-100 hover:border-amber-500/40'
                        }`}
                      >
                        {opt.label}
                        <span className="mt-1 block text-xs font-normal text-slate-400">{opt.odds.toFixed(2)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {error && <p className="mt-3 text-center text-xs text-red-300">{error}</p>}
        </div>

        <div className="pointer-events-auto shrink-0 border-t border-slate-800/90 bg-slate-950/50 px-4 py-3 sm:px-5">
          <button
            type="button"
            disabled={!selectedMarket || !selectedOption || !currentUserId || sending}
            onClick={() => void handleSend()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600/90 py-3 text-sm font-bold uppercase tracking-wide text-slate-950 transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {sending ? <Loader2 className="animate-spin" size={18} /> : <Trophy size={18} />}
            Send to messages
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
