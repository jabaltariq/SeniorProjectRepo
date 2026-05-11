import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Loader2, ChevronRight, Trophy } from 'lucide-react';
import type { Market, MarketOption } from '@/models';
import { createGameChallengeAndNotify, opposingOptionForMarket } from '@/services/gameChallenges';

export interface GameChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Global NFL sim games (same board as Markets → NFL for everyone). */
  mockNflMarkets: Market[];
  opponentUserId: string;
  opponentDisplayName: string;
  opponentAvatarUrl?: string | null;
  backgroundImageUrl: string;
  currentUserId: string | null;
  challengerDisplayName: string;
  onSent?: () => void;
}

function pairedOptionGroups(market: Market): MarketOption[][] {
  const byKey = new Map<string, MarketOption[]>();
  for (const o of market.options) {
    const k = o.marketKey ?? 'h2h';
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(o);
  }
  const out: MarketOption[][] = [];
  for (const opts of byKey.values()) {
    if (opts.length === 2) out.push(opts);
  }
  return out;
}

function marketIsSelectable(m: Market): boolean {
  return m.status !== 'CLOSED' && pairedOptionGroups(m).length > 0;
}

/**
 * Pick one of the live global NFL sim games, ML / spread / total, optional note → DM.
 */
export const GameChallengeModal: React.FC<GameChallengeModalProps> = ({
  isOpen,
  onClose,
  mockNflMarkets,
  opponentUserId,
  opponentDisplayName,
  opponentAvatarUrl,
  backgroundImageUrl,
  currentUserId,
  challengerDisplayName,
  onSent,
}) => {
  const openGames = useMemo(() => mockNflMarkets.filter(marketIsSelectable), [mockNflMarkets]);
  const endedOnly =
    mockNflMarkets.length > 0 &&
    openGames.length === 0 &&
    mockNflMarkets.every((m) => m.status === 'CLOSED');

  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [selectedOption, setSelectedOption] = useState<MarketOption | null>(null);
  const [dmNote, setDmNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setSelectedMarket(null);
    setSelectedOption(null);
    setDmNote('');
    setError(null);
    setSending(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    reset();
  }, [isOpen, opponentUserId, reset]);

  const groups = selectedMarket ? pairedOptionGroups(selectedMarket) : [];

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
      optionalDmNote: dmNote.trim() || undefined,
    });
    setSending(false);
    if (res.success) {
      onSent?.();
      onClose();
    } else {
      setError('error' in res ? res.error : 'Could not send');
    }
  };

  if (!isOpen) return null;

  const safeBg = backgroundImageUrl.replace(/"/g, '\\"');
  const hasLiveGames = openGames.length > 0;

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

      <div className="pointer-events-auto relative z-10 flex max-h-[min(90vh,820px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-amber-700/40 bg-slate-900/95 shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-200">
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
                Same global NFL sim board for everyone. Winner gets a leaderboard challenge win when the sim game
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
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Choose a game</p>
                {mockNflMarkets.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">
                    Loading the global NFL sim board… Open Markets → Football → NFL if this stays empty.
                  </p>
                ) : endedOnly ? (
                  <p className="py-6 text-center text-sm text-slate-500">
                    All five sim games are finished right now. Spin up new games from the NFL mock board, then try
                    again.
                  </p>
                ) : (
                  openGames.map((m) => (
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
                        NFL sim · {m.status}
                      </span>
                    </button>
                  ))
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500" htmlFor="challenge-dm-note">
                  Optional message (sent first in chat)
                </label>
                <textarea
                  id="challenge-dm-note"
                  value={dmNote}
                  onChange={(e) => setDmNote(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Say hi or add context…"
                  className="mt-1 w-full resize-none rounded-xl border border-slate-700/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500/45"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
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
              <p className="text-[11px] text-slate-500">
                Pick your side for each line type. They take the opposite number if they accept.
              </p>
              {!hasLiveGames && selectedMarket.status === 'CLOSED' ? (
                <p className="text-sm text-amber-200/90">This sim game already ended — go back and pick an open game.</p>
              ) : null}
              {groups.map((pair, idx) => {
                const key = pair[0]?.marketKey ?? 'h2h';
                return (
                  <div key={`${selectedMarket.id}-${key}-${idx}`} className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {key === 'h2h' ? 'Moneyline' : key === 'spreads' ? 'Spread' : key === 'totals' ? 'Total' : key}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {pair.map((opt) => {
                        const picked = selectedOption?.id === opt.id;
                        const valid = opposingOptionForMarket(selectedMarket, opt) !== null;
                        if (!valid) return null;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setSelectedOption(opt)}
                            className={`rounded-xl border px-3 py-3 text-center text-sm font-bold transition-all ${
                              picked
                                ? 'border-amber-500/70 bg-amber-500/15 ring-2 ring-amber-500/35 text-amber-100'
                                : 'border-slate-700 bg-slate-950/50 text-slate-100 hover:border-amber-500/40'
                            }`}
                          >
                            <span className="line-clamp-3">{opt.label}</span>
                            <span className="mt-1 block text-xs font-normal text-slate-400">{opt.odds.toFixed(2)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {error && <p className="mt-3 text-center text-xs text-red-300">{error}</p>}
        </div>

        <div className="pointer-events-auto flex shrink-0 flex-col gap-2 border-t border-slate-800/90 bg-slate-950/50 px-4 py-3 sm:px-5">
          <button
            type="button"
            disabled={!selectedMarket || !selectedOption || !currentUserId || sending || selectedMarket.status === 'CLOSED'}
            onClick={() => void handleSend()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600/90 py-3 text-sm font-bold uppercase tracking-wide text-slate-950 transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {sending ? <Loader2 className="animate-spin" size={18} /> : <Trophy size={18} />}
            Send
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={() => onClose()}
            className="w-full rounded-xl border border-slate-600 py-2 text-xs font-bold uppercase tracking-wide text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
