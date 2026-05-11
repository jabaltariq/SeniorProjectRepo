import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bet, Market, MarketOption } from '../models';
import { X, TrendingUp, RefreshCcw, AlertCircle, Info, Wallet, History, CornerDownRight } from 'lucide-react';
import { BoostType } from '@/services/dbOps.ts';

type SlipTab = 'SINGLES' | 'PARLAYS' | 'ACTIVE';
type ActivePendingFilter = 'ALL' | 'SINGLES' | 'PARLAYS';

interface BetSlipProps {
  selection: { market: Market; option: MarketOption } | null;
  parlaySelections: Array<{ market: Market; option: MarketOption }>;
  activeBets: Bet[];
  onPlaceBet: (
    stake: number,
    betType?: 'single' | 'parlay',
    singleTarget?: { market: Market; option: MarketOption } | null,
  ) => void;
  onClose: () => void;
  onClear: () => void;
  onSelectBet: (market: Market, option: MarketOption) => void;
  onFocusSelection: (market: Market, option: MarketOption) => void;
  balance: number;
  activeBoost: BoostType | null;
  limitError: string | null;
  /** Strict-parlay rule rejection (max legs / both-sides). Displays as a
   *  non-blocking inline banner at the top of the slip and auto-clears
   *  after a short timeout in the viewModel. Intentionally separate from
   *  `limitError` so it does NOT disable the place-bet button — the user
   *  may still have a valid parlay queued up. */
  parlayRuleError?: string | null;
  /** Paper slip in light theme; dark chrome when app uses ocean theme. */
  isLightMode?: boolean;
  /** Active tab: open full betting history (e.g. react-router `navigate('/history')`). */
  onGoToHistory?: () => void;
}

export const BetSlip: React.FC<BetSlipProps> = ({
  selection,
  parlaySelections,
  activeBets,
  onPlaceBet,
  onClose,
  onClear,
  onSelectBet,
  onFocusSelection,
  balance,
  activeBoost,
  limitError,
  parlayRuleError,
  isLightMode = true,
  onGoToHistory,
}) => {
  const [stakeInput, setStakeInput] = useState<string>('20');
  /** Per-queued-pick stake on Singles tab (each pick is its own ticket). */
  const [singleStakes, setSingleStakes] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<SlipTab>('SINGLES');
  const [activePendingFilter, setActivePendingFilter] = useState<ActivePendingFilter>('ALL');
  const [expandedParlays, setExpandedParlays] = useState<Record<string, boolean>>({});
  const previousParlayCount = useRef(0);
  const previousSelectionKey = useRef<string | null>(null);

  const isQueueEmpty = parlaySelections.length === 0;
  const hasMinimumParlayLegs = parlaySelections.length >= 2;
  const stake = Number(stakeInput) || 0;
  const potentialPayout = selection ? stake * selection.option.odds : 0;
  const parlayPotentialPayout =
    parlaySelections.length > 0
      ? stake * parlaySelections.reduce((a, s) => a * s.option.odds, 1)
      : 0;
  const isAffordable = stake <= balance;
  const darkSlip = !isLightMode;
  const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');

  const isPending = (b: Bet) => (b.status ?? 'PENDING') === 'PENDING';
  const singleBets = useMemo(
    () => activeBets.filter((b) => (b.betType ?? 'single') === 'single' && isPending(b)),
    [activeBets],
  );
  const parlayBets = useMemo(
    () => activeBets.filter((b) => b.betType === 'parlay' && isPending(b)),
    [activeBets],
  );

  const sortedPendingSingles = useMemo(
    () => [...singleBets].sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime()),
    [singleBets],
  );
  const sortedPendingParlays = useMemo(
    () => [...parlayBets].sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime()),
    [parlayBets],
  );

  const previewSingle = sortedPendingSingles[0];
  const previewParlay = sortedPendingParlays[0];

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
    ? { icon: <TrendingUp size={10} />, text: 'Double Payout active', color: darkSlip ? 'text-amber-200' : 'text-amber-800' }
    : activeBoost === 'money_back'
      ? { icon: <RefreshCcw size={10} />, text: 'Money Back active', color: darkSlip ? 'text-cyan-200' : 'text-cyan-800' }
      : null;

  const decimalToAmerican = (decimalOdds: number) => {
    if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) return 0;
    if (decimalOdds >= 2) return Math.round((decimalOdds - 1) * 100);
    return Math.round(-100 / (decimalOdds - 1));
  };

  const fmtAmerican = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  const marketToneLabel = (key?: MarketOption['marketKey']) => {
    if (key === 'h2h') return 'Moneyline';
    if (key === 'spreads') return 'Spread';
    if (key === 'totals') return 'Total';
    return 'Pick';
  };

  const combinedParlayDecimalOdds = useMemo(() => {
    if (parlaySelections.length === 0) return 0;
    return parlaySelections.reduce((acc, sel) => acc * sel.option.odds, 1);
  }, [parlaySelections]);

  const parlayAmericanOdds = useMemo(
    () => decimalToAmerican(combinedParlayDecimalOdds),
    [combinedParlayDecimalOdds],
  );

  const parlayLegs = useMemo(
    () =>
      parlaySelections.map((sel) => {
        const am = decimalToAmerican(sel.option.odds);
        return {
          id: `${sel.market.id}:${sel.option.id}`,
          market: sel.market,
          option: sel.option,
          name: sel.option.label,
          matchup: sel.market.title,
          odds: fmtAmerican(am),
          lineLabel: marketToneLabel(sel.option.marketKey),
          isLive: sel.market.status === 'LIVE',
        };
      }),
    [parlaySelections],
  );

  const anyParlayLegLive = parlayLegs.some((l) => l.isLive);

  useEffect(() => {
    const wasParlay = previousParlayCount.current >= 2;
    const isParlay = parlaySelections.length >= 2;
    if (!wasParlay && isParlay) {
      setTab('PARLAYS');
    }
    previousParlayCount.current = parlaySelections.length;
  }, [parlaySelections.length]);

  useEffect(() => {
    if (!selection) {
      previousSelectionKey.current = null;
      return;
    }
    const key = `${selection.market.id}:${selection.option.id}`;
    if (previousSelectionKey.current === key) return;
    previousSelectionKey.current = key;
    if (parlaySelections.length >= 2) return;
    setTab('SINGLES');
  }, [selection, parlaySelections.length]);

  useEffect(() => {
    setSingleStakes((prev) => {
      const next = { ...prev };
      for (const s of parlaySelections) {
        const id = `${s.market.id}:${s.option.id}`;
        if (next[id] === undefined) next[id] = '20';
      }
      const allowed = new Set(parlaySelections.map((s) => `${s.market.id}:${s.option.id}`));
      for (const k of Object.keys(next)) {
        if (!allowed.has(k)) delete next[k];
      }
      return next;
    });
  }, [parlaySelections]);

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

  const setLegStakeFromInput = (legId: string, raw: string) => {
    const cleaned = raw.replace(/[^\d.]/g, '');
    if (cleaned === '') {
      setSingleStakes((p) => ({ ...p, [legId]: '0' }));
      return;
    }
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    const normalized = cleaned.startsWith('.') ? `0${cleaned}` : cleaned;
    setSingleStakes((p) => ({ ...p, [legId]: normalized }));
  };

  const toggleParlayDetails = (betId: string) => {
    setExpandedParlays((prev) => ({ ...prev, [betId]: !prev[betId] }));
  };

  const hasAnyPick = !isQueueEmpty;
  const parlayPlaceDisabled = !hasMinimumParlayLegs || !isAffordable || stake <= 0 || !!limitError;

  const slipShell = cx(
    'rounded-t-2xl lg:rounded-none shadow-xl lg:shadow-none',
    darkSlip
      ? 'border-t border-[#3FA9F5]/25 lg:border-t-0 lg:border-l border-slate-700/75 bg-[#171427] text-slate-100'
      : 'border border-slate-200 bg-white lg:border-l lg:border-slate-200 text-slate-900',
  );
  const slipAccentBtn = 'bg-[#3FA9F5] hover:bg-[#2e9ae8] text-slate-900';
  const slipAccentBtnDisabled = darkSlip ? 'bg-slate-700 text-slate-500' : 'bg-slate-200 text-slate-400';

  const headerBadgeCount =
    tab === 'ACTIVE' ? singleBets.length + parlayBets.length : parlaySelections.length;

  const BoostBanner = () =>
    boostLabel ? (
      <div
        className={cx(
          'mt-3 flex flex-wrap items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[10px] font-semibold',
          darkSlip ? 'border-amber-500/35 bg-amber-500/10' : 'border-amber-200 bg-amber-50',
          boostLabel.color,
        )}
      >
        {boostLabel.icon}
        {boostLabel.text}
        {activeBoost === 'double_payout' && (
          <span className={cx('ml-auto normal-case font-normal', darkSlip ? 'text-slate-400' : 'text-slate-600')}>
            {tab === 'SINGLES' && parlaySelections.length >= 2 ? (
              <>Doubles the win payout on each single you place.</>
            ) : (
              <>
                Payout doubles to{' '}
                <span className={cx('font-bold', darkSlip ? 'text-amber-100' : 'text-amber-900')}>
                  ${(tab === 'SINGLES' ? boostedSinglePayout : boostedParlayPayout)?.toFixed(2) ?? '—'}
                </span>
              </>
            )}
          </span>
        )}
        {activeBoost === 'money_back' && (
          <span className={cx('ml-auto normal-case font-normal', darkSlip ? 'text-slate-400' : 'text-slate-600')}>
            Stake refunded if you lose
          </span>
        )}
      </div>
    ) : null;

  const LimitBanner = () =>
    limitError ? (
      <div
        className={cx(
          'mt-3 flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[10px] font-semibold',
          darkSlip ? 'border-red-500/35 bg-red-500/10 text-red-300' : 'border-red-200 bg-red-50 text-red-700',
        )}
      >
        <AlertCircle size={11} />
        {limitError}
      </div>
    ) : null;

  const StakeField = ({ compact, fullWidth }: { compact?: boolean; fullWidth?: boolean }) => (
    <div
      className={cx(
        'flex items-center rounded-md border px-2',
        fullWidth ? 'w-full py-2' : compact ? 'w-[4.75rem] shrink-0 py-1' : 'min-w-[4.5rem] py-1.5',
        darkSlip ? 'border-slate-600 bg-slate-950' : 'border-slate-300 bg-white',
      )}
    >
      <span className={cx('text-xs mr-0.5 shrink-0', darkSlip ? 'text-slate-500' : 'text-slate-400')}>$</span>
      <input
        type="text"
        inputMode="decimal"
        value={stakeInput}
        onChange={(e) => setStakeFromInput(e.target.value)}
        className={cx(
          'min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none tabular-nums',
          compact && !fullWidth ? 'text-right' : '',
          darkSlip ? 'text-slate-100' : 'text-slate-900',
        )}
        aria-label="Wager amount"
      />
    </div>
  );

  const TabButton = ({ id, label }: { id: SlipTab; label: string }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={cx(
        'flex-1 rounded-md px-2 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors',
        tab === id
          ? darkSlip
            ? 'bg-[#3FA9F5]/20 text-[#a5e6ff] ring-1 ring-[#3FA9F5]/35 shadow-none'
            : 'bg-slate-900 text-white shadow-sm'
          : darkSlip
            ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
      )}
    >
      {label}
    </button>
  );

  const CurrentBetPreview = () => {
    if (tab === 'ACTIVE') return null;

    const isSinglesContext = tab === 'SINGLES';
    const bet = isSinglesContext ? previewSingle : previewParlay;
    const count = isSinglesContext ? singleBets.length : parlayBets.length;
    const label = isSinglesContext ? 'Current single' : 'Current parlay';

    if (!bet && count === 0) return null;

    const am = fmtAmerican(decimalToAmerican(bet.odds));
    const marketLine =
      bet.betType === 'parlay'
        ? `${bet.parlayLegs?.length ?? 0}-leg parlay`
        : marketToneLabel(bet.pickedMarketKey);

    return (
      <div
        className={cx(
          'mt-4 rounded-xl border-2 border-[#3FA9F5] overflow-hidden shadow-sm',
          darkSlip ? 'bg-slate-900/70' : 'bg-white',
        )}
      >
        <div
          className={cx(
            'flex items-center justify-between gap-2 border-b px-3 py-2',
            darkSlip ? 'border-slate-700 bg-slate-800/80' : 'border-slate-200 bg-slate-50',
          )}
        >
          <span className={cx('text-xs font-bold', darkSlip ? 'text-slate-100' : 'text-slate-800')}>
            {label}
            {count > 0 ? (
              <span className={cx('ml-1.5 font-semibold', darkSlip ? 'text-slate-400' : 'text-slate-500')}>
                ({count})
              </span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={() => setTab('ACTIVE')}
            className="text-[10px] font-bold uppercase tracking-wider text-[#3FA9F5] hover:text-[#7dd3fc]"
          >
            View all
          </button>
        </div>
        {bet ? (
          <div className="p-3">
            <div className="flex items-start gap-2">
              <p className={cx('min-w-0 flex-1 text-sm font-bold leading-tight pr-1', darkSlip ? 'text-slate-100' : 'text-slate-900')}>
                {bet.optionLabel}
              </p>
              <div className="flex w-[4.75rem] shrink-0 flex-col items-end gap-0.5 text-right">
                <span className={cx('text-sm font-bold tabular-nums', darkSlip ? 'text-[#7dd3fc]' : 'text-slate-900')}>{am}</span>
              </div>
            </div>
            <div className="mt-1 flex gap-2">
              <div className="min-w-0 flex-1 pr-1">
                <p className={cx('text-[10px] font-semibold uppercase tracking-wide', darkSlip ? 'text-slate-500' : 'text-slate-500')}>
                  {marketLine}
                </p>
                <p className={cx('mt-0.5 text-xs leading-snug', darkSlip ? 'text-slate-400' : 'text-slate-600')}>{bet.marketTitle}</p>
              </div>
              <div className="flex w-[4.75rem] shrink-0 flex-col items-end justify-start pt-0.5">
                <p className={cx('text-[9px] font-bold uppercase tracking-wide', darkSlip ? 'text-slate-500' : 'text-slate-500')}>
                  Total wager
                </p>
                <p className={cx('text-sm font-bold tabular-nums', darkSlip ? 'text-slate-100' : 'text-slate-900')}>
                  ${bet.stake.toFixed(2)}
                </p>
              </div>
            </div>

            {bet.betType === 'parlay' && !!bet.parlayLegs?.length && (
              <ul className={cx('mt-2 space-y-1 border-t pt-2', darkSlip ? 'border-slate-700' : 'border-slate-100')}>
                {bet.parlayLegs.slice(0, 4).map((leg, idx) => (
                  <li key={`${bet.id}-p-${idx}`} className="flex gap-2 text-[11px]">
                    <span className="text-slate-500">×</span>
                    <span
                      className={cx('min-w-0 font-semibold truncate', darkSlip ? 'text-slate-200' : 'text-slate-800')}
                    >
                      {leg.optionLabel}
                    </span>
                  </li>
                ))}
                {(bet.parlayLegs?.length ?? 0) > 4 ? (
                  <li className={cx('text-[10px] pl-4', darkSlip ? 'text-slate-500' : 'text-slate-500')}>
                    +{(bet.parlayLegs!.length ?? 0) - 4} more
                  </li>
                ) : null}
              </ul>
            )}

            <div className={cx('mt-3 border-t pt-3', darkSlip ? 'border-slate-700' : 'border-slate-200')}>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className={cx('text-[9px] font-bold uppercase tracking-wide', darkSlip ? 'text-slate-500' : 'text-slate-500')}>
                    Total payout
                  </p>
                  <p className={cx('text-sm font-bold tabular-nums', darkSlip ? 'text-slate-100' : 'text-slate-900')}>
                    ${bet.potentialPayout.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className={cx('p-3 text-xs', darkSlip ? 'text-slate-500' : 'text-slate-500')}>
            No pending {isSinglesContext ? 'singles' : 'parlays'}.
          </p>
        )}
      </div>
    );
  };

  /** Active-tab card matching sportsbook “pending bet” layout (teal border, header strip, wager/payout, cashout row). */
  const PendingBetActiveCard: React.FC<{ bet: Bet; variant: 'single' | 'parlay' }> = ({ bet, variant }) => {
    const am = fmtAmerican(decimalToAmerican(bet.odds));
    const marketLine =
      variant === 'parlay'
        ? `${bet.parlayLegs?.length ?? 0}-PICK PARLAY`
        : marketToneLabel(bet.pickedMarketKey).toUpperCase();
    const matchup =
      variant === 'parlay' ? bet.marketTitle.replace(/\s*\|\s*/g, ' · ') : bet.marketTitle;
    const stakeStr = bet.stake.toFixed(2);
    const payoutStr = bet.potentialPayout.toFixed(2);

    return (
      <div
        className={cx(
          'overflow-hidden rounded-xl border-2 border-[#3FA9F5] shadow-sm',
          darkSlip ? 'bg-slate-950/50' : 'bg-white',
        )}
      >
        <div
          className={cx(
            'flex items-center justify-between border-b px-3 py-2.5',
            darkSlip ? 'border-slate-700 bg-slate-800/90' : 'border-slate-200 bg-slate-100',
          )}
        >
          <span className={cx('text-xs font-bold tracking-tight', darkSlip ? 'text-slate-100' : 'text-slate-800')}>
            Active {variant === 'single' ? 'Bet' : 'Parlay'}
          </span>
        </div>

        <div className={cx('border-b px-3 py-3', darkSlip ? 'border-slate-700' : 'border-slate-200')}>
          <div className="flex items-start justify-between gap-2">
            <p className={cx('min-w-0 text-sm font-bold leading-snug', darkSlip ? 'text-slate-50' : 'text-slate-900')}>
              {bet.optionLabel}
            </p>
            <span className={cx('shrink-0 text-sm font-bold tabular-nums', darkSlip ? 'text-slate-50' : 'text-slate-900')}>
              {am}
            </span>
          </div>
          <p
            className={cx(
              'mt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]',
              darkSlip ? 'text-slate-500' : 'text-slate-500',
            )}
          >
            {marketLine}
          </p>
          <p className={cx('mt-1 text-xs leading-snug', darkSlip ? 'text-slate-400' : 'text-slate-600')}>{matchup}</p>

          {variant === 'parlay' && !!bet.parlayLegs?.length ? (
            <>
              <button
                type="button"
                onClick={() => toggleParlayDetails(bet.id)}
                className="mt-2 text-[10px] font-bold uppercase tracking-wide text-[#3FA9F5] hover:text-[#7dd3fc]"
              >
                {expandedParlays[bet.id] ? 'Hide legs' : `Show ${bet.parlayLegs.length} legs`}
              </button>
              {expandedParlays[bet.id] ? (
                <ul
                  className={cx(
                    'mt-2 space-y-1.5 rounded-lg border px-2.5 py-2',
                    darkSlip ? 'border-slate-700 bg-black/20' : 'border-slate-200 bg-slate-50',
                  )}
                >
                  {bet.parlayLegs.map((leg, idx) => (
                    <li key={`${bet.id}-leg-${idx}`} className="text-[11px] leading-snug">
                      <span className={cx('font-semibold', darkSlip ? 'text-slate-200' : 'text-slate-800')}>
                        {leg.optionLabel}
                      </span>
                      <span className={cx(darkSlip ? 'text-slate-500' : 'text-slate-500')}> · {leg.marketTitle}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </div>

        <div
          className={cx(
            'relative border-b px-3 py-3',
            darkSlip ? 'border-slate-700' : 'border-slate-200',
          )}
        >
          <div
            className={cx(
              'pointer-events-none absolute inset-0 opacity-[0.06]',
              darkSlip ? 'text-white' : 'text-slate-900',
            )}
            style={{
              backgroundImage:
                'radial-gradient(circle at 90% 40%, currentColor 0%, transparent 55%), radial-gradient(circle at 10% 80%, currentColor 0%, transparent 50%)',
            }}
            aria-hidden
          />
          <div className="relative grid grid-cols-2 gap-4">
            <div>
              <p className={cx('text-base font-bold tabular-nums', darkSlip ? 'text-slate-50' : 'text-slate-900')}>
                ${stakeStr}
              </p>
              <p
                className={cx(
                  'mt-0.5 text-[9px] font-bold uppercase tracking-[0.14em]',
                  darkSlip ? 'text-slate-500' : 'text-slate-500',
                )}
              >
                Total wager
              </p>
            </div>
            <div className="text-right">
              <p className={cx('text-base font-bold tabular-nums', darkSlip ? 'text-slate-50' : 'text-slate-900')}>
                ${payoutStr}
              </p>
              <p
                className={cx(
                  'mt-0.5 text-[9px] font-bold uppercase tracking-[0.14em]',
                  darkSlip ? 'text-slate-500' : 'text-slate-500',
                )}
              >
                Total payout
              </p>
            </div>
          </div>
        </div>

        <div className="p-3">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Cashout is not available yet."
            className={cx(
              'flex w-full items-center justify-center gap-2 rounded-lg bg-[#3FA9F5] py-3 text-xs font-bold uppercase tracking-wide text-white opacity-60 cursor-not-allowed',
            )}
          >
            <Wallet size={16} strokeWidth={2.25} className="shrink-0 opacity-95" aria-hidden />
            Cashout ${stakeStr}
          </button>
        </div>
      </div>
    );
  };

  const renderActiveTab = () => {
    const showSingles = activePendingFilter === 'ALL' || activePendingFilter === 'SINGLES';
    const showParlays = activePendingFilter === 'ALL' || activePendingFilter === 'PARLAYS';

    const ActiveFilterChip = ({ id, label }: { id: ActivePendingFilter; label: string }) => (
      <button
        type="button"
        onClick={() => setActivePendingFilter(id)}
        className={cx(
          'flex-1 rounded-md px-1.5 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors',
          activePendingFilter === id
            ? darkSlip
              ? 'bg-[#3FA9F5]/25 text-[#a5e6ff] ring-1 ring-[#3FA9F5]/40'
              : 'bg-white text-slate-900 shadow-sm'
            : darkSlip
              ? 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
              : 'text-slate-600 hover:bg-slate-200/80',
        )}
      >
        {label}
      </button>
    );

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center">
          <p className={cx('text-[11px] font-black uppercase tracking-[0.22em]', darkSlip ? 'text-slate-300' : 'text-slate-600')}>
            Active
          </p>
          <div className="mt-2.5 w-full max-w-[280px] space-y-2">
            <div className={cx('flex gap-0.5 rounded-lg p-0.5', darkSlip ? 'bg-slate-900/85' : 'bg-slate-100')}>
              <ActiveFilterChip id="ALL" label="All" />
              <ActiveFilterChip id="SINGLES" label="Singles" />
              <ActiveFilterChip id="PARLAYS" label="Parlays" />
            </div>
            {onGoToHistory ? (
              <button
                type="button"
                onClick={onGoToHistory}
                className={cx(
                  'flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-[11px] font-semibold transition-colors',
                  darkSlip
                    ? 'border-slate-600 text-slate-300 hover:border-[#3FA9F5]/50 hover:bg-slate-800 hover:text-slate-100'
                    : 'border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-white',
                )}
              >
                <History size={14} strokeWidth={2} aria-hidden />
                History
              </button>
            ) : null}
          </div>
        </div>

        {showSingles ? (
          <div>
            <p className={cx('mb-2 text-[10px] font-bold uppercase tracking-[0.14em]', darkSlip ? 'text-slate-400' : 'text-slate-500')}>
              Pending singles
            </p>
            {singleBets.length === 0 ? (
              <p className={cx('text-xs', darkSlip ? 'text-slate-500' : 'text-slate-500')}>None yet.</p>
            ) : (
              <div className="no-scrollbar max-h-[min(56vh,28rem)] space-y-3 overflow-y-auto pr-1">
                {sortedPendingSingles.map((bet) => (
                  <PendingBetActiveCard key={bet.id} bet={bet} variant="single" />
                ))}
              </div>
            )}
          </div>
        ) : null}

        {showParlays ? (
          <div>
            <p className={cx('mb-2 text-[10px] font-bold uppercase tracking-[0.14em]', darkSlip ? 'text-slate-400' : 'text-slate-500')}>
              Pending parlays
            </p>
            {parlayBets.length === 0 ? (
              <p className={cx('text-xs', darkSlip ? 'text-slate-500' : 'text-slate-500')}>None yet.</p>
            ) : (
              <div className="no-scrollbar max-h-[min(56vh,28rem)] space-y-3 overflow-y-auto pr-1">
                {sortedPendingParlays.map((bet) => (
                  <PendingBetActiveCard key={bet.id} bet={bet} variant="parlay" />
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="no-scrollbar fixed bottom-0 left-0 right-0 z-50 lg:static lg:z-auto lg:shrink-0 lg:w-[340px] lg:min-h-0 lg:h-full lg:overflow-y-auto lg:overscroll-contain animate-in slide-in-from-bottom lg:slide-in-from-right duration-300">
      <div className={`betslip-shell mx-4 mb-4 flex min-h-0 flex-col lg:mx-0 lg:mb-0 lg:min-h-full lg:h-full p-4 lg:px-4 lg:pb-4 lg:pt-4 ${slipShell}`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#3FA9F5] text-xs font-black text-slate-900">
              {headerBadgeCount > 99 ? '99+' : headerBadgeCount}
            </span>
            <h2 className={cx('text-sm font-black uppercase tracking-wide truncate', darkSlip ? 'text-slate-100' : 'text-slate-900')}>
              Bet slip
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="relative inline-flex shrink-0">
              <button
                type="button"
                className={cx(
                  'peer flex h-7 w-7 items-center justify-center rounded-full border outline-none',
                  darkSlip
                    ? 'border-slate-600 text-[#7dd3fc] hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-[#3FA9F5]/50'
                    : 'border-blue-200 text-blue-600 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-[#3FA9F5]/40',
                )}
                aria-label="Bet slip help"
                aria-describedby="betslip-help-tooltip"
              >
                <Info size={14} strokeWidth={2.5} />
              </button>
              <div
                id="betslip-help-tooltip"
                role="tooltip"
                className={cx(
                  'pointer-events-none invisible absolute right-0 top-full z-[70] mt-1.5 w-[min(calc(100vw-2rem),14rem)] rounded-lg border px-3 py-2 text-left text-[10px] leading-snug shadow-lg opacity-0 transition-opacity duration-150',
                  'peer-hover:visible peer-hover:opacity-100 peer-focus-visible:visible peer-focus-visible:opacity-100',
                  darkSlip
                    ? 'border-slate-600 bg-slate-900 text-slate-300 ring-1 ring-white/5'
                    : 'border-slate-200 bg-white text-slate-600 shadow-slate-900/10',
                )}
              >
                <p className="font-bold text-[11px] text-current">How this slip works</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-3.5 marker:text-current/70">
                  <li>
                    <strong className="font-semibold">Singles</strong>: lines you tap appear here; set stake and place one bet at a time for the
                    focused pick.
                  </li>
                  <li>
                    <strong className="font-semibold">Parlays</strong>: need at least two legs; odds multiply together. Same parlay rules as on the
                    board still apply.
                  </li>
                  <li>
                    <strong className="font-semibold">Active</strong>: bets you&apos;ve placed that are still pending.
                  </li>
                </ul>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={cx(
                'transition-colors',
                darkSlip ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700',
              )}
              title="Close bet slip"
              aria-label="Close bet slip"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between gap-2 text-[11px]">
          <span className={darkSlip ? 'text-slate-400' : 'text-slate-500'}>Balance</span>
          <span className={cx('font-bold', darkSlip ? 'text-slate-100' : 'text-slate-900')}>${balance.toFixed(2)}</span>
        </div>

        {parlayRuleError ? (
          <div
            role="alert"
            aria-live="polite"
            className={cx(
              'mb-3 flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[10px] font-semibold',
              darkSlip ? 'border-amber-500/35 bg-amber-500/10 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-900',
            )}
          >
            <AlertCircle size={11} />
            {parlayRuleError}
          </div>
        ) : null}

        <div className={cx('mb-3 flex gap-1 rounded-lg p-1', darkSlip ? 'bg-slate-900/80' : 'bg-slate-100')}>
          <TabButton id="SINGLES" label="Singles" />
          <TabButton id="PARLAYS" label="Parlays" />
          <TabButton id="ACTIVE" label="Active" />
        </div>

        <div className="min-h-0 flex-1">
          {tab === 'SINGLES' && (
            <div className="flex flex-col">
              {isQueueEmpty ? (
                <div
                  className={cx(
                    'rounded-xl border border-dashed px-4 py-12 text-center',
                    darkSlip ? 'border-slate-600 bg-slate-900/40' : 'border-slate-200 bg-slate-50',
                  )}
                >
                  <p className={cx('text-sm font-semibold', darkSlip ? 'text-slate-200' : 'text-slate-700')}>No picks yet</p>
                  <p className={cx('mt-1 text-xs', darkSlip ? 'text-slate-500' : 'text-slate-500')}>
                    Choose a line from the board to add it here.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={cx('text-[10px] font-bold uppercase tracking-[0.14em]', darkSlip ? 'text-slate-400' : 'text-slate-500')}>
                          Separate picks
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={onClear}
                        className={cx(
                          'shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold transition-colors',
                          darkSlip ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100',
                        )}
                      >
                        Clear all
                      </button>
                    </div>

                    <div className="no-scrollbar flex max-h-[min(58vh,32rem)] flex-col gap-3 overflow-y-auto pr-0.5">
                      {parlayLegs.map((leg) => {
                        const raw = singleStakes[leg.id] ?? '20';
                        const legStake = Number(raw) || 0;
                        const basePayout = legStake * leg.option.odds;
                        const boostedPay =
                          activeBoost === 'double_payout' && legStake > 0
                            ? basePayout + (basePayout - legStake)
                            : null;
                        const legAffordable = legStake <= balance && legStake > 0;
                        const betDisabled = !legAffordable || !!limitError;
                        return (
                          <div
                            key={leg.id}
                            className={cx(
                              'rounded-xl border p-3 shadow-sm',
                              darkSlip ? 'border-slate-600 bg-slate-900/85' : 'border-slate-200 bg-white',
                            )}
                          >
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => onSelectBet(leg.market, leg.option)}
                                className={cx(
                                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded',
                                  darkSlip ? 'text-slate-500 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100',
                                )}
                                aria-label="Remove pick"
                              >
                                <X size={14} strokeWidth={2} />
                              </button>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {leg.isLive ? (
                                        <span className="rounded px-1 py-0.5 text-[8px] font-bold uppercase bg-slate-900 text-white">
                                          Live
                                        </span>
                                      ) : null}
                                      <p className={cx('text-sm font-bold leading-snug', darkSlip ? 'text-slate-100' : 'text-slate-900')}>
                                        {leg.name}
                                      </p>
                                    </div>
                                  </div>
                                  <span
                                    className={cx(
                                      'shrink-0 text-sm font-black tabular-nums',
                                      darkSlip ? 'text-[#7dd3fc]' : 'text-emerald-700',
                                    )}
                                  >
                                    {leg.odds}
                                  </span>
                                </div>

                                <div className="mt-2 flex items-end justify-between gap-2">
                                  <p
                                    className={cx(
                                      'text-[10px] font-bold uppercase tracking-wide',
                                      darkSlip ? 'text-slate-500' : 'text-slate-500',
                                    )}
                                  >
                                    {leg.lineLabel}
                                  </p>
                                  <div
                                    className={cx(
                                      'flex w-[5.5rem] shrink-0 items-center rounded-md border px-2 py-1.5',
                                      darkSlip ? 'border-slate-600 bg-slate-950' : 'border-slate-300 bg-white',
                                    )}
                                  >
                                    <span className={cx('mr-0.5 shrink-0 text-xs', darkSlip ? 'text-slate-500' : 'text-slate-400')}>$</span>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={raw}
                                      onChange={(e) => setLegStakeFromInput(leg.id, e.target.value)}
                                      className={cx(
                                        'min-w-0 flex-1 bg-transparent text-right text-xs font-semibold tabular-nums outline-none',
                                        darkSlip ? 'text-slate-100' : 'text-slate-900',
                                      )}
                                      aria-label={`Wager for ${leg.name}`}
                                    />
                                  </div>
                                </div>

                                <div className="mt-2 flex items-start justify-between gap-2 text-[11px]">
                                  <span className={cx('flex min-w-0 items-start gap-1', darkSlip ? 'text-slate-500' : 'text-slate-500')}>
                                    <CornerDownRight size={12} className="mt-0.5 shrink-0 opacity-70" aria-hidden />
                                    <span className="leading-snug">{leg.matchup}</span>
                                  </span>
                                  <div className="shrink-0 text-right">
                                    {boostedPay != null ? (
                                      <div>
                                        <p className={cx('text-[10px]', darkSlip ? 'text-slate-500' : 'text-slate-500')}>Payout</p>
                                        <p className={cx('text-[10px] line-through', darkSlip ? 'text-slate-500' : 'text-slate-400')}>
                                          ${basePayout.toFixed(2)}
                                        </p>
                                        <p className={cx('text-xs font-bold tabular-nums', darkSlip ? 'text-amber-300' : 'text-amber-700')}>
                                          ${boostedPay.toFixed(2)}
                                        </p>
                                      </div>
                                    ) : (
                                      <p className={cx('tabular-nums', darkSlip ? 'text-slate-300' : 'text-slate-700')}>
                                        <span className={darkSlip ? 'text-slate-500' : 'text-slate-500'}>Payout: </span>
                                        <span className="font-semibold">${basePayout.toFixed(2)}</span>
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={betDisabled}
                              onClick={() => onPlaceBet(legStake, 'single', { market: leg.market, option: leg.option })}
                              className={cx(
                                'mt-3 w-full rounded-lg py-2.5 text-xs font-black uppercase tracking-wide active:scale-[0.99]',
                                betDisabled
                                  ? slipAccentBtnDisabled
                                  : activeBoost
                                    ? 'bg-amber-500 text-slate-900 hover:bg-amber-400'
                                    : slipAccentBtn,
                              )}
                            >
                              {activeBoost
                                ? `Bet · ${activeBoost === 'double_payout' ? '2× payout' : 'Money back'}`
                                : 'Bet'}
                            </button>
                            {!legAffordable && legStake > 0 ? (
                              <p className={cx('mt-1.5 text-center text-[10px] font-semibold', darkSlip ? 'text-red-400' : 'text-red-600')}>
                                Insufficient funds
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    {hasMinimumParlayLegs ? (
                      <button
                        type="button"
                        onClick={() => setTab('PARLAYS')}
                        className={cx(
                          'w-full rounded-lg border py-2.5 text-center text-[11px] font-semibold transition-colors',
                          darkSlip
                            ? 'border-[#3FA9F5]/40 text-[#a5e6ff] hover:border-[#3FA9F5]/60 hover:bg-[#3FA9F5]/10'
                            : 'border-slate-300 text-slate-800 hover:border-[#3FA9F5] hover:bg-[#3FA9F5]/5',
                        )}
                      >
                        Combine picks into a parlay
                      </button>
                    ) : null}

                    <BoostBanner />
                    <LimitBanner />
                  </div>
                </>
              )}
              <CurrentBetPreview />
            </div>
          )}

          {tab === 'PARLAYS' && (
            <div className="flex flex-col">
              {isQueueEmpty ? (
                <div
                  className={cx(
                    'rounded-xl border border-dashed px-4 py-12 text-center',
                    darkSlip ? 'border-slate-600 bg-slate-900/40' : 'border-slate-200 bg-slate-50',
                  )}
                >
                  <p className={cx('text-sm font-semibold', darkSlip ? 'text-slate-200' : 'text-slate-700')}>Build a parlay</p>
                  <p className={cx('mt-1 text-xs', darkSlip ? 'text-slate-500' : 'text-slate-500')}>
                    Add picks from the board — strict parlay rules still apply.
                  </p>
                </div>
              ) : !hasMinimumParlayLegs ? (
                <div className={cx('rounded-xl border overflow-hidden', darkSlip ? 'border-slate-700 bg-slate-900/50' : 'border-slate-200 bg-white')}>
                  <div
                    className={cx(
                      'border-b px-3 py-2',
                      darkSlip ? 'border-slate-700 bg-amber-500/10' : 'border-slate-100 bg-amber-50',
                    )}
                  >
                    <p className={cx('text-[11px] font-semibold', darkSlip ? 'text-amber-200' : 'text-amber-900')}>
                      Add at least one more leg to place a parlay.
                    </p>
                  </div>
                  <div className={cx('divide-y', darkSlip ? 'divide-slate-700' : 'divide-slate-100')}>
                    {parlayLegs.map((leg) => (
                      <div key={leg.id} className="flex gap-2 p-3">
                        <button
                          type="button"
                          onClick={() => onSelectBet(leg.market, leg.option)}
                          className={cx(
                            'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded',
                            darkSlip ? 'text-slate-500 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100',
                          )}
                          aria-label="Remove leg"
                        >
                          <X size={14} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={cx('text-sm font-bold', darkSlip ? 'text-slate-100' : 'text-slate-900')}>{leg.name}</p>
                          <p className={cx('text-[11px]', darkSlip ? 'text-slate-400' : 'text-slate-500')}>{leg.lineLabel}</p>
                          <p className={cx('text-[11px] truncate', darkSlip ? 'text-slate-400' : 'text-slate-500')}>{leg.matchup}</p>
                        </div>
                        <span className={cx('shrink-0 text-sm font-bold', darkSlip ? 'text-[#7dd3fc]' : 'text-slate-900')}>{leg.odds}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className={cx(
                      'overflow-hidden rounded-xl border shadow-sm',
                      darkSlip ? 'border-slate-700 bg-slate-900/50' : 'border-slate-200 bg-white',
                    )}
                  >
                    <div
                      className={cx(
                        'flex items-center justify-between border-b px-3 py-2',
                        darkSlip ? 'border-slate-700' : 'border-slate-200',
                      )}
                    >
                      <span className={cx('text-[10px] font-bold uppercase tracking-wide', darkSlip ? 'text-slate-500' : 'text-slate-500')}>
                        Legs
                      </span>
                      <button
                        type="button"
                        onClick={onClear}
                        disabled={!hasAnyPick}
                        className={cx(
                          'text-[10px] font-bold uppercase tracking-wide transition-colors disabled:opacity-35',
                          darkSlip
                            ? 'text-slate-400 hover:text-slate-200 disabled:hover:text-slate-400'
                            : 'text-slate-600 hover:text-slate-900 disabled:hover:text-slate-600',
                        )}
                      >
                        Clear all
                      </button>
                    </div>

                    <div className={cx('divide-y', darkSlip ? 'divide-slate-700' : 'divide-slate-100')}>
                      {parlayLegs.map((leg) => (
                        <div key={leg.id} className="flex gap-2 p-3">
                          <button
                            type="button"
                            onClick={() => onSelectBet(leg.market, leg.option)}
                            className={cx(
                              'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded',
                              darkSlip ? 'text-slate-500 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100',
                            )}
                            aria-label="Remove leg"
                          >
                            <X size={14} />
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className={cx('text-sm font-bold', darkSlip ? 'text-slate-100' : 'text-slate-900')}>{leg.name}</p>
                            <p className={cx('text-[11px]', darkSlip ? 'text-slate-400' : 'text-slate-500')}>{leg.lineLabel}</p>
                          </div>
                          <span className={cx('shrink-0 text-sm font-bold tabular-nums', darkSlip ? 'text-[#7dd3fc]' : 'text-slate-900')}>
                            {leg.odds}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div
                      className={cx(
                        'space-y-4 px-3 py-3',
                        darkSlip ? 'bg-slate-900/70' : 'bg-slate-50/95',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {anyParlayLegLive ? (
                              <span className="rounded px-1 py-0.5 text-[8px] font-bold uppercase bg-slate-900 text-white">
                                Live
                              </span>
                            ) : null}
                            <span className="rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide bg-violet-600 text-white">
                              Parlay
                            </span>
                            <span className={cx('text-sm font-semibold', darkSlip ? 'text-slate-100' : 'text-slate-800')}>
                              {parlayLegs.length}-Bet Parlay
                            </span>
                          </div>
                        </div>
                        <span
                          className={cx(
                            'shrink-0 text-base font-black tabular-nums leading-none',
                            darkSlip ? 'text-violet-300' : 'text-violet-600',
                          )}
                        >
                          {fmtAmerican(parlayAmericanOdds)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <p className={cx('text-[9px] font-bold uppercase tracking-wide', darkSlip ? 'text-slate-400' : 'text-slate-500')}>
                            Wager
                          </p>
                          <div className="mt-1.5">
                            <StakeField fullWidth />
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cx('text-[9px] font-bold uppercase tracking-wide', darkSlip ? 'text-slate-400' : 'text-slate-500')}>
                            Payout
                          </p>
                          {boostedParlayPayout ? (
                            <div className="mt-1.5">
                              <p className={cx('text-xs line-through', darkSlip ? 'text-slate-500' : 'text-slate-400')}>
                                ${parlayPotentialPayout.toFixed(2)}
                              </p>
                              <p className={cx('text-xl font-bold tabular-nums', darkSlip ? 'text-amber-300' : 'text-amber-700')}>
                                ${boostedParlayPayout.toFixed(2)}
                              </p>
                            </div>
                          ) : (
                            <p className={cx('mt-1.5 text-xl font-bold tabular-nums', darkSlip ? 'text-slate-100' : 'text-slate-900')}>
                              ${parlayPotentialPayout.toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <BoostBanner />
                        <LimitBanner />
                        {!isAffordable && (
                          <p className={cx('text-[10px] mt-2 font-semibold', darkSlip ? 'text-red-400' : 'text-red-600')}>
                            Insufficient funds
                          </p>
                        )}
                        <button
                          type="button"
                          disabled={parlayPlaceDisabled}
                          onClick={() => onPlaceBet(stake, 'parlay')}
                          className={cx(
                            'mt-3 w-full rounded-lg py-3 text-xs font-black uppercase tracking-wide active:scale-[0.99]',
                            parlayPlaceDisabled
                              ? slipAccentBtnDisabled
                              : activeBoost
                                ? 'bg-amber-500 text-slate-900 hover:bg-amber-400'
                                : slipAccentBtn,
                          )}
                        >
                          {activeBoost
                            ? `Place parlay · ${activeBoost === 'double_payout' ? '2× payout' : 'Money back'}`
                            : 'Place parlay'}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
              <CurrentBetPreview />
            </div>
          )}

          {tab === 'ACTIVE' && renderActiveTab()}
        </div>

      </div>
    </div>
  );
};
