import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bet, Market, MarketOption } from '../models';
import { Trash2, X, Minus, TrendingUp, RefreshCcw, AlertCircle } from 'lucide-react';
import { BoostType } from '@/services/dbOps.ts';
import { computeParlayRollup } from '@/services/parlayRollup';

type SlipTab = 'SINGLES' | 'PARLAYS';

interface BetSlipProps {
  selection: { market: Market; option: MarketOption } | null;
  parlaySelections: Array<{ market: Market; option: MarketOption }>;
  activeBets: Bet[];
  onPlaceBet: (stake: number, betType?: 'single' | 'parlay') => void;
  onClose: () => void;
  onClear: () => void;
  onSelectBet: (market: Market, option: MarketOption) => void;
  balance: number;
  activeBoost: BoostType | null;
  limitError: string | null;
  /** Strict-parlay rule rejection (max legs / both-sides). Displays as a
   *  non-blocking inline banner at the top of the slip and auto-clears
   *  after a short timeout in the viewModel. Intentionally separate from
   *  `limitError` so it does NOT disable the place-bet button — the user
   *  may still have a valid parlay queued up. */
  parlayRuleError?: string | null;
}

export const BetSlip: React.FC<BetSlipProps> = ({
                                                  selection,
                                                  parlaySelections,
                                                  activeBets,
                                                  onPlaceBet,
                                                  onClose,
                                                  onClear,
                                                  onSelectBet,
                                                  balance,
                                                  activeBoost,
                                                  limitError,
                                                  parlayRuleError,
                                                }) => {
  const [stakeInput, setStakeInput] = useState<string>('20');
  const [tab, setTab] = useState<SlipTab>('SINGLES');
  const [expandedParlays, setExpandedParlays] = useState<Record<string, boolean>>({});
  const previousParlayCount = useRef(0);

  const isSinglesEmpty = !selection;
  const isParlayEmpty = parlaySelections.length === 0;
  const hasMinimumParlayLegs = parlaySelections.length >= 2;
  const stake = Number(stakeInput) || 0;
  const potentialPayout = selection ? stake * selection.option.odds : 0;
  const parlayPotentialPayout = stake * (parlaySelections.length ? parlaySelections.reduce((a, s) => a * s.option.odds, 1) : 0);
  const isAffordable = stake <= balance;
  // "Current" = still pending (game hasn't finalized yet). As soon as a bet
  // settles via the realtime onSnapshot listener we want it OUT of the
  // current section so the user sees a live transition from Current ->
  // Recent Bets without a refresh.
  const isPending = (b: Bet) => (b.status ?? 'PENDING') === 'PENDING';
  const singleBets = useMemo(
    () => activeBets.filter((b) => (b.betType ?? 'single') === 'single' && isPending(b)),
    [activeBets],
  );
  const parlayBets = useMemo(
    () => activeBets.filter((b) => b.betType === 'parlay' && isPending(b)),
    [activeBets],
  );

  // Settled bets, newest-first by settledAt (fall back to placedAt for
  // legacy rows that pre-date the settledAt write). Capped at 10 per tab
  // to keep the slip from turning into a history page; the dedicated
  // history view in DashboardView handles longer-term browsing.
  const settledSortKey = (b: Bet) =>
    (b.settledAt?.getTime?.() ?? b.placedAt.getTime());
  const recentSingles = useMemo(
    () => activeBets
        .filter((b) => (b.betType ?? 'single') === 'single' && !isPending(b))
        .sort((a, b) => settledSortKey(b) - settledSortKey(a))
        .slice(0, 10),
    [activeBets],
  );
  const recentParlays = useMemo(
    () => activeBets
        .filter((b) => b.betType === 'parlay' && !isPending(b))
        .sort((a, b) => settledSortKey(b) - settledSortKey(a))
        .slice(0, 10),
    [activeBets],
  );

  // Boosted payout display (profit doubled for double_payout)
  const boostedSinglePayout = useMemo(() => {
    if (!selection || activeBoost !== 'double_payout') return null;
    const profit = potentialPayout - stake;
    return potentialPayout + profit;
  }, [selection, activeBoost, potentialPayout, stake]);

  const boostedParlayPayout = useMemo(() => {
    if (!parlaySelections.length || activeBoost !== 'double_payout') return null;
    const profit = parlayPotentialPayout - stake;
    return parlayPotentialPayout + profit;
  }, [parlaySelections, activeBoost, parlayPotentialPayout, stake]);

  const boostLabel = activeBoost === 'double_payout'
      ? { icon: <TrendingUp size={10} />, text: 'Double Payout active', color: 'text-amber-300' }
      : activeBoost === 'money_back'
          ? { icon: <RefreshCcw size={10} />, text: 'Money Back active', color: 'text-cyan-300' }
          : null;

  const decimalToAmerican = (decimalOdds: number) => {
    if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) return 0;
    if (decimalOdds >= 2) return Math.round((decimalOdds - 1) * 100);
    return Math.round(-100 / (decimalOdds - 1));
  };

  const marketToneLabel = (key?: MarketOption['marketKey']) => {
    if (key === 'h2h') return 'TO WIN';
    if (key === 'spreads') return 'SPREAD';
    if (key === 'totals') return 'TOTAL';
    return 'PICK';
  };

  const marketTone = useMemo(() => {
    if (!selection) return '';
    return marketToneLabel(selection.option.marketKey);
  }, [selection]);

  const singleAmericanOdds = useMemo(() => {
    if (!selection) return 0;
    return decimalToAmerican(selection.option.odds);
  }, [selection]);

  const combinedParlayDecimalOdds = useMemo(() => {
    if (parlaySelections.length === 0) return 0;
    return parlaySelections.reduce((acc, sel) => acc * sel.option.odds, 1);
  }, [parlaySelections]);

  const parlayAmericanOdds = useMemo(
      () => decimalToAmerican(combinedParlayDecimalOdds),
      [combinedParlayDecimalOdds]
  );

  const parlayLegs = useMemo(
      () =>
          parlaySelections.map((sel) => {
            const odds = decimalToAmerican(sel.option.odds);
            return {
              id: `${sel.market.id}:${sel.option.id}`,
              market: sel.market,
              option: sel.option,
              name: sel.option.label,
              matchup: sel.market.title,
              odds: odds >= 0 ? `+${odds}` : `${odds}`,
              lineLabel: marketToneLabel(sel.option.marketKey),
            };
          }),
      [parlaySelections]
  );

  useEffect(() => {
    const wasParlay = previousParlayCount.current >= 2;
    const isParlay = parlaySelections.length >= 2;
    if (!wasParlay && isParlay) {
      setTab('PARLAYS');
    }
    previousParlayCount.current = parlaySelections.length;
  }, [parlaySelections.length]);

  const setStakeFromInput = (raw: string) => {
    const cleaned = raw.replace(/[^\d.]/g, '');
    if (cleaned === '') {
      setStakeInput('0');
      return;
    }
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    setStakeInput(cleaned.startsWith('.') ? `0${cleaned}` : cleaned);
  };

  const toggleParlayDetails = (betId: string) => {
    setExpandedParlays((prev) => ({ ...prev, [betId]: !prev[betId] }));
  };

  const hasAnyPick = !isSinglesEmpty || !isParlayEmpty;
  const singlesPlaceDisabled = isSinglesEmpty || !isAffordable || stake <= 0 || !!limitError;
  const parlayPlaceDisabled  = !hasMinimumParlayLegs || !isAffordable || stake <= 0 || !!limitError;
  const tabLabels: Record<SlipTab, string> = { SINGLES: 'Singles', PARLAYS: 'Parlays' };

  const cardClass = 'rounded-xl border border-slate-800 bg-[#100d1f]';

  // Boost banner shown inside the bet card when a boost is active
  const BoostBanner = () => boostLabel ? (
      <div className={`mt-2 flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/60 px-2.5 py-1.5 text-[10px] font-semibold ${boostLabel.color}`}>
        {boostLabel.icon}
        {boostLabel.text}
        {activeBoost === 'double_payout' && (
            <span className="ml-auto text-slate-400 normal-case font-normal">
          Payout doubles to <span className="text-amber-200 font-bold">
            ${(tab === 'SINGLES' ? boostedSinglePayout : boostedParlayPayout)?.toFixed(2) ?? '—'}
          </span>
        </span>
        )}
        {activeBoost === 'money_back' && (
            <span className="ml-auto text-slate-400 normal-case font-normal">Stake refunded if you lose</span>
        )}
      </div>
  ) : null;

  // Limit error banner
  const LimitBanner = () => limitError ? (
      <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-red-400">
        <AlertCircle size={11} />
        {limitError}
      </div>
  ) : null;

  // Compute the actual amount returned to the wallet for a settled bet.
  // Singles and non-reduced parlays use stored potentialPayout; reduced
  // parlays (some legs pushed) get recomputed via computeParlayRollup so
  // the slip never overstates winnings. Boost adjustments are not
  // reflected here yet — see TODO when we surface boost-aware payouts.
  const settledReturn = (bet: Bet): { kind: 'WON' | 'PUSH' | 'LOST' | 'VOID' | 'CANCELLED'; amount: number } => {
    const status = (bet.status ?? 'PENDING').toUpperCase();
    if (status === 'WON') {
      if (bet.betType === 'parlay' && bet.parlayLegs?.length) {
        const rollup = computeParlayRollup(bet.parlayLegs, bet.stake);
        if (rollup.state === 'WON') return { kind: 'WON', amount: rollup.payout };
      }
      return { kind: 'WON', amount: bet.potentialPayout };
    }
    if (status === 'PUSH' || status === 'VOID' || status === 'CANCELLED') {
      return { kind: status, amount: bet.stake };
    }
    return { kind: 'LOST', amount: 0 };
  };

  // Recent settled bets card — sibling of "Current Singles/Parlays" cards.
  // Uses one component for both kinds so we don't duplicate empty-state /
  // header / scroll-frame styling four times across the tab branches.
  const RecentBetsCard: React.FC<{ title: string; bets: Bet[]; emptyText: string; kind: 'single' | 'parlay' }> =
      ({ title, bets, emptyText, kind }) => (
      <div className={`${cardClass} p-3.5`}>
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{title}</p>
          <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-slate-300">{bets.length}</span>
        </div>
        {bets.length === 0 ? (
            <p className="text-xs text-slate-500">{emptyText}</p>
        ) : (
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {bets.map((bet) => {
                const { kind: outcome, amount } = settledReturn(bet);
                const tone =
                    outcome === 'WON'  ? { row: 'border-l-emerald-500',  pill: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300', label: `Won $${amount.toFixed(2)}` } :
                    outcome === 'LOST' ? { row: 'border-l-red-500',      pill: 'border-red-500/40 bg-red-500/15 text-red-300',           label: 'Lost' } :
                    outcome === 'PUSH' ? { row: 'border-l-amber-500',    pill: 'border-amber-500/40 bg-amber-500/15 text-amber-300',     label: `Push $${amount.toFixed(2)}` } :
                                          { row: 'border-l-slate-500',    pill: 'border-slate-500/40 bg-slate-500/15 text-slate-300',     label: outcome === 'VOID' ? 'Void' : 'Cancelled' };
                return (
                    <div key={bet.id} className={`rounded-xl border-l-4 ${tone.row} border-y border-r border-slate-700/80 bg-gradient-to-b from-slate-900 to-slate-900/70 p-2.5 shadow-[0_1px_0_rgba(148,163,184,0.12)_inset]`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-100 truncate">{bet.optionLabel}</p>
                          <p className="mt-0.5 text-[11px] text-slate-400 truncate">{bet.marketTitle}</p>
                        </div>
                        <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone.pill}`}>
                          {tone.label}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className="rounded-md border border-violet-500/25 bg-violet-500/10 px-1.5 py-0.5 font-semibold text-violet-200">Stake ${bet.stake.toFixed(2)}</span>
                        <span className="font-semibold text-slate-400">@ {bet.odds.toFixed(2)}</span>
                      </div>
                      {kind === 'parlay' && !!bet.parlayLegs?.length && (
                          <>
                            <button
                                type="button"
                                onClick={() => toggleParlayDetails(bet.id)}
                                className="mt-1.5 text-[10px] font-semibold text-violet-300 hover:text-violet-200"
                            >
                              {expandedParlays[bet.id] ? 'hide legs' : `show ${bet.parlayLegs.length} legs`}
                            </button>
                            {expandedParlays[bet.id] && (
                                <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                                  <div className="space-y-1.5">
                                    {bet.parlayLegs.map((leg, idx) => {
                                      const legResult = (leg.result ?? 'PENDING').toUpperCase();
                                      const legColor =
                                          legResult === 'WON'  ? 'text-emerald-300' :
                                          legResult === 'LOST' ? 'text-red-300' :
                                          legResult === 'PUSH' ? 'text-amber-300' :
                                          legResult === 'VOID' ? 'text-slate-400' :
                                                                  'text-slate-500';
                                      return (
                                          <div key={`${bet.id}-leg-${idx}`} className="flex items-center justify-between gap-2 rounded-md border border-slate-800/70 bg-slate-900/70 px-2 py-1.5">
                                            <div className="min-w-0">
                                              <p className="text-[10px] font-semibold text-slate-200 truncate">{leg.optionLabel}</p>
                                              <p className="text-[9px] text-slate-500 truncate">{leg.marketTitle}</p>
                                            </div>
                                            <span className={`shrink-0 text-[9px] font-bold uppercase ${legColor}`}>{legResult}</span>
                                          </div>
                                      );
                                    })}
                                  </div>
                                </div>
                            )}
                          </>
                      )}
                    </div>
                );
              })}
            </div>
        )}
      </div>
  );

  return (
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:static lg:z-auto lg:shrink-0 lg:w-[330px] lg:min-h-0 lg:h-full lg:overflow-y-auto lg:overscroll-contain animate-in slide-in-from-bottom lg:slide-in-from-right duration-300">
        <div className="betslip-shell mx-4 mb-4 flex min-h-0 flex-col lg:mx-0 lg:mb-0 lg:min-h-full rounded-t-2xl lg:rounded-none lg:h-full p-4 lg:px-4 lg:pb-4 lg:pt-5 shadow-2xl border-t border-violet-500/40 lg:border-t-0 lg:border-l border-slate-700/70 bg-[#171427]">
          <div className="flex items-center justify-between mb-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/70 px-2 py-1 text-[11px]">
              <span className="text-slate-300">Balance</span>
              <span className="font-bold text-violet-300">${balance.toFixed(2)}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-300 transition-colors"
              title="Close bet slip"
              aria-label="Close bet slip"
            >
              <X size={16} />
            </button>
          </div>

          {parlayRuleError ? (
              <div
                  role="alert"
                  aria-live="polite"
                  className="mb-3 flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-amber-300"
              >
                <AlertCircle size={11} />
                {parlayRuleError}
              </div>
          ) : null}

          <div className="flex border-b border-slate-800 mb-2">
            {(['SINGLES', 'PARLAYS'] as const).map((t) => (
                <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`flex-1 pb-2.5 text-[11px] font-bold uppercase tracking-wide border-b-2 -mb-px transition-colors ${
                        tab === t
                            ? 'border-violet-400 text-violet-200'
                            : 'border-transparent text-slate-500 hover:text-slate-400'
                    }`}
                >
                  {tabLabels[t]}
                </button>
            ))}
          </div>

          <button
              type="button"
              onClick={onClear}
              disabled={!hasAnyPick}
              className="mb-3 flex w-full items-center justify-center gap-1.5 text-[11px] font-semibold text-violet-400 hover:text-violet-300 disabled:opacity-40 disabled:hover:text-violet-400"
          >
            <Trash2 size={14} strokeWidth={2} />
            Remove all selections
          </button>

          {/* ——— Singles ——— */}
          {tab === 'SINGLES' && selection ? (
              <div className="mb-4 flex flex-col gap-3">
                <div className={`${cardClass} p-3`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                  <span className="inline-block rounded bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                    Single
                  </span>
                      <p className="mt-2 text-xs font-medium text-slate-200 truncate">{selection.option.label}</p>
                    </div>
                    <span className="shrink-0 text-lg font-black text-violet-300">
                  {singleAmericanOdds >= 0 ? `+${singleAmericanOdds}` : singleAmericanOdds}
                </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Wager</p>
                      <div className="mt-1 flex items-center rounded-lg border border-slate-700 bg-slate-900/80 px-2.5 py-2">
                        <span className="text-slate-400 text-sm mr-0.5">$</span>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={stakeInput}
                            onChange={(e) => setStakeFromInput(e.target.value)}
                            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-100 outline-none"
                            aria-label="Wager amount"
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Payout</p>
                      {boostedSinglePayout ? (
                          <div className="mt-1">
                            <p className="text-sm font-semibold line-through text-slate-500">${potentialPayout.toFixed(2)}</p>
                            <p className="text-2xl font-semibold leading-tight text-amber-300">${boostedSinglePayout.toFixed(2)}</p>
                          </div>
                      ) : (
                          <p className="mt-1 text-2xl font-semibold leading-tight text-slate-100">${potentialPayout.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                  <BoostBanner />
                  <LimitBanner />
                  {!isAffordable && (
                      <p className="text-red-400 text-[10px] mt-2 font-semibold">Insufficient funds</p>
                  )}
                  <button
                      type="button"
                      disabled={singlesPlaceDisabled}
                      onClick={() => onPlaceBet(stake, 'single')}
                      className={`mt-3 w-full font-bold py-3 rounded-lg shadow-lg active:scale-[0.99] transition-all text-xs uppercase tracking-wide text-white ${
                          singlesPlaceDisabled
                              ? 'bg-slate-700 text-slate-500'
                              : activeBoost
                                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                                  : 'bg-violet-600 hover:bg-violet-500 shadow-violet-600/20'
                      }`}
                  >
                    {activeBoost ? `PLACE BET + ${activeBoost === 'double_payout' ? '2× PAYOUT' : 'MONEY BACK'}` : 'PLACE BET'}
                  </button>
                </div>

                <div className={`${cardClass} p-3`}>
                  <div className="flex gap-2.5">
                    <button
                        type="button"
                        onClick={() => onSelectBet(selection.market, selection.option)}
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-red-500/70 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        aria-label="Remove selection"
                    >
                      <Minus size={14} strokeWidth={2.5} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-100 truncate">{selection.option.label}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{marketTone}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{selection.market.title}</p>
                    </div>
                    <span className="shrink-0 text-base font-bold text-violet-300">
                  {singleAmericanOdds >= 0 ? `+${singleAmericanOdds}` : singleAmericanOdds}
                </span>
                  </div>
                </div>

                <div className={`${cardClass} p-3.5`}>
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Current Singles</p>
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-slate-300">{singleBets.length}</span>
                  </div>
                  {singleBets.length === 0 ? (
                      <p className="text-xs text-slate-500">No single bets placed yet.</p>
                  ) : (
                      <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                        {singleBets.slice(0, 10).map((bet) => (
                            <div key={bet.id} className="rounded-xl border border-slate-700/80 bg-gradient-to-b from-slate-900 to-slate-900/70 p-2.5 shadow-[0_1px_0_rgba(148,163,184,0.12)_inset]">
                              <p className="text-sm font-semibold text-slate-100 truncate">{bet.optionLabel}</p>
                              <p className="mt-0.5 text-[11px] text-slate-400 truncate">{bet.marketTitle}</p>
                              <div className="mt-2 flex items-center justify-between text-[11px]">
                                <span className="rounded-md border border-violet-500/25 bg-violet-500/10 px-1.5 py-0.5 font-semibold text-violet-200">Stake ${bet.stake.toFixed(2)}</span>
                                <span className="font-semibold text-emerald-300">To win ${bet.potentialPayout.toFixed(2)}</span>
                              </div>
                            </div>
                        ))}
                      </div>
                  )}
                </div>
                <RecentBetsCard
                    title="Recent Bets"
                    bets={recentSingles}
                    emptyText="No settled singles yet. Once a game ends, results land here."
                    kind="single"
                />
              </div>
          ) : tab === 'SINGLES' ? (
              <div className="mb-4 flex flex-col gap-3">
                <div className={`${cardClass} px-4 py-10 text-center text-slate-400 lg:min-h-[28vh] flex flex-col items-center justify-center`}>
                  <p className="text-sm font-semibold text-slate-300 mb-1">No singles yet</p>
                  <p className="text-xs text-slate-500">Pick a line from the board to add it here.</p>
                </div>
                <div className={`${cardClass} p-3.5`}>
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Current Singles</p>
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-slate-300">{singleBets.length}</span>
                  </div>
                  {singleBets.length === 0 ? (
                      <p className="text-xs text-slate-500">No single bets placed yet.</p>
                  ) : (
                      <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                        {singleBets.slice(0, 10).map((bet) => (
                            <div key={bet.id} className="rounded-xl border border-slate-700/80 bg-gradient-to-b from-slate-900 to-slate-900/70 p-2.5 shadow-[0_1px_0_rgba(148,163,184,0.12)_inset]">
                              <p className="text-sm font-semibold text-slate-100 truncate">{bet.optionLabel}</p>
                              <p className="mt-0.5 text-[11px] text-slate-400 truncate">{bet.marketTitle}</p>
                              <div className="mt-2 flex items-center justify-between text-[11px]">
                                <span className="rounded-md border border-violet-500/25 bg-violet-500/10 px-1.5 py-0.5 font-semibold text-violet-200">Stake ${bet.stake.toFixed(2)}</span>
                                <span className="font-semibold text-emerald-300">To win ${bet.potentialPayout.toFixed(2)}</span>
                              </div>
                            </div>
                        ))}
                      </div>
                  )}
                </div>
                <RecentBetsCard
                    title="Recent Bets"
                    bets={recentSingles}
                    emptyText="No settled singles yet. Once a game ends, results land here."
                    kind="single"
                />
              </div>
          ) : null}

          {/* ——— Parlays ——— */}
          {tab === 'PARLAYS' && !isParlayEmpty ? (
              <div className="mb-4 flex flex-col gap-3">
                <div className={`${cardClass} p-3`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 rounded bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                    Parlay
                  </span>
                      <span className="text-sm font-semibold text-slate-200 truncate">
                    {parlayLegs.length}-Bet Parlay
                  </span>
                    </div>
                    <span className="shrink-0 text-lg font-black text-violet-300">
                  {parlayAmericanOdds >= 0 ? `+${parlayAmericanOdds}` : parlayAmericanOdds}
                </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Wager</p>
                      <div className="mt-1 flex items-center rounded-lg border border-slate-700 bg-slate-900/80 px-2.5 py-2">
                        <span className="text-slate-400 text-sm mr-0.5">$</span>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={stakeInput}
                            onChange={(e) => setStakeFromInput(e.target.value)}
                            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-100 outline-none"
                            aria-label="Wager amount"
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Payout</p>
                      {boostedParlayPayout ? (
                          <div className="mt-1">
                            <p className="text-sm font-semibold line-through text-slate-500">${parlayPotentialPayout.toFixed(2)}</p>
                            <p className="text-2xl font-semibold leading-tight text-amber-300">${boostedParlayPayout.toFixed(2)}</p>
                          </div>
                      ) : (
                          <p className="mt-1 text-2xl font-semibold leading-tight text-slate-100">${parlayPotentialPayout.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                  <BoostBanner />
                  <LimitBanner />
                  {!isAffordable && (
                      <p className="text-red-400 text-[10px] mt-2 font-semibold">Insufficient funds</p>
                  )}
                  {!hasMinimumParlayLegs && (
                      <p className="text-amber-300 text-[10px] mt-2 font-semibold">Add at least 2 legs to place a parlay.</p>
                  )}
                  <button
                      type="button"
                      disabled={parlayPlaceDisabled}
                      onClick={() => onPlaceBet(stake, 'parlay')}
                      className={`mt-3 w-full font-bold py-3 rounded-lg shadow-lg active:scale-[0.99] transition-all text-xs uppercase tracking-wide text-white ${
                          parlayPlaceDisabled
                              ? 'bg-slate-700 text-slate-500'
                              : activeBoost
                                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                                  : 'bg-violet-600 hover:bg-violet-500 shadow-violet-600/20'
                      }`}
                  >
                    {activeBoost ? `PLACE BET + ${activeBoost === 'double_payout' ? '2× PAYOUT' : 'MONEY BACK'}` : 'PLACE BET'}
                  </button>
                </div>

                <div className={`${cardClass} divide-y divide-slate-800/90`}>
                  {parlayLegs.map((leg) => (
                      <div key={leg.id} className="flex gap-2.5 p-3">
                        <button
                            type="button"
                            onClick={() => onSelectBet(leg.market, leg.option)}
                            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-red-500/70 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            aria-label="Remove leg"
                        >
                          <Minus size={14} strokeWidth={2.5} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-100 truncate">{leg.name}</p>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{leg.lineLabel}</p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">{leg.matchup}</p>
                        </div>
                        <span className="shrink-0 text-base font-bold text-violet-300">{leg.odds}</span>
                      </div>
                  ))}
                </div>

                <div className={`${cardClass} p-3.5`}>
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Current Parlays</p>
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-slate-300">{parlayBets.length}</span>
                  </div>
                  {parlayBets.length === 0 ? (
                      <p className="text-xs text-slate-500">No parlay bets placed yet.</p>
                  ) : (
                      <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                        {parlayBets.slice(0, 10).map((bet) => (
                            <div key={bet.id} className="rounded-xl border border-slate-700/80 bg-gradient-to-b from-slate-900 to-slate-900/70 p-2.5 shadow-[0_1px_0_rgba(148,163,184,0.12)_inset]">
                              <p className="text-sm font-semibold text-slate-100 truncate">{bet.optionLabel}</p>
                              <p className="mt-0.5 text-[11px] text-slate-400 truncate">{bet.marketTitle}</p>
                              <p className="mt-1 text-[10px] text-slate-500">{bet.parlayLegs?.length ?? 0} legs</p>
                              {!!bet.parlayLegs?.length && (
                                  <button type="button" onClick={() => toggleParlayDetails(bet.id)} className="mt-1 text-[10px] font-semibold text-violet-300 hover:text-violet-200">
                                    {expandedParlays[bet.id] ? 'hide legs' : 'show legs'}
                                  </button>
                              )}
                              {!!bet.parlayLegs?.length && expandedParlays[bet.id] && (
                                  <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                                    <div className="space-y-1.5">
                                      {bet.parlayLegs.map((leg, idx) => (
                                          <div key={`${bet.id}-leg-${idx}`} className="rounded-md border border-slate-800/70 bg-slate-900/70 px-2 py-1.5">
                                            <p className="text-[10px] font-semibold text-slate-200 truncate">{leg.optionLabel}</p>
                                            <p className="text-[10px] text-slate-500 truncate">{leg.marketTitle}</p>
                                            <p className="text-[10px] text-slate-400">odds {leg.odds.toFixed(2)}</p>
                                          </div>
                                      ))}
                                    </div>
                                  </div>
                              )}
                              <div className="mt-2 flex items-center justify-between text-[11px]">
                                <span className="rounded-md border border-violet-500/25 bg-violet-500/10 px-1.5 py-0.5 font-semibold text-violet-200">Stake ${bet.stake.toFixed(2)}</span>
                                <span className="font-semibold text-emerald-300">To win ${bet.potentialPayout.toFixed(2)}</span>
                              </div>
                            </div>
                        ))}
                      </div>
                  )}
                </div>
                <RecentBetsCard
                    title="Recent Bets"
                    bets={recentParlays}
                    emptyText="No settled parlays yet. Once every leg finalizes, results land here."
                    kind="parlay"
                />
              </div>
          ) : tab === 'PARLAYS' ? (
              <div className="mb-4 flex flex-col gap-3">
                <div className={`${cardClass} px-4 py-10 text-center text-slate-400 lg:min-h-[28vh] flex flex-col items-center justify-center`}>
                  <p className="text-sm font-semibold text-slate-300 mb-1">No parlay legs yet</p>
                  <p className="text-xs text-slate-500">Add two or more picks to build a parlay.</p>
                </div>
                <div className={`${cardClass} p-3.5`}>
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Current Parlays</p>
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-slate-300">{parlayBets.length}</span>
                  </div>
                  {parlayBets.length === 0 ? (
                      <p className="text-xs text-slate-500">No parlay bets placed yet.</p>
                  ) : (
                      <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                        {parlayBets.slice(0, 10).map((bet) => (
                            <div key={bet.id} className="rounded-xl border border-slate-700/80 bg-gradient-to-b from-slate-900 to-slate-900/70 p-2.5 shadow-[0_1px_0_rgba(148,163,184,0.12)_inset]">
                              <p className="text-sm font-semibold text-slate-100 truncate">{bet.optionLabel}</p>
                              <p className="mt-0.5 text-[11px] text-slate-400 truncate">{bet.marketTitle}</p>
                              <p className="mt-1 text-[10px] text-slate-500">{bet.parlayLegs?.length ?? 0} legs</p>
                              {!!bet.parlayLegs?.length && (
                                  <button type="button" onClick={() => toggleParlayDetails(bet.id)} className="mt-1 text-[10px] font-semibold text-violet-300 hover:text-violet-200">
                                    {expandedParlays[bet.id] ? 'hide legs' : 'show legs'}
                                  </button>
                              )}
                              {!!bet.parlayLegs?.length && expandedParlays[bet.id] && (
                                  <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                                    <div className="space-y-1.5">
                                      {bet.parlayLegs.map((leg, idx) => (
                                          <div key={`${bet.id}-leg-${idx}`} className="rounded-md border border-slate-800/70 bg-slate-900/70 px-2 py-1.5">
                                            <p className="text-[10px] font-semibold text-slate-200 truncate">{leg.optionLabel}</p>
                                            <p className="text-[10px] text-slate-500 truncate">{leg.marketTitle}</p>
                                            <p className="text-[10px] text-slate-400">odds {leg.odds.toFixed(2)}</p>
                                          </div>
                                      ))}
                                    </div>
                                  </div>
                              )}
                              <div className="mt-2 flex items-center justify-between text-[11px]">
                                <span className="rounded-md border border-violet-500/25 bg-violet-500/10 px-1.5 py-0.5 font-semibold text-violet-200">Stake ${bet.stake.toFixed(2)}</span>
                                <span className="font-semibold text-emerald-300">To win ${bet.potentialPayout.toFixed(2)}</span>
                              </div>
                            </div>
                        ))}
                      </div>
                  )}
                </div>
                <RecentBetsCard
                    title="Recent Bets"
                    bets={recentParlays}
                    emptyText="No settled parlays yet. Once every leg finalizes, results land here."
                    kind="parlay"
                />
              </div>
          ) : null}
        </div>
      </div>
  );
};