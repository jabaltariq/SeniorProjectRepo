
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Market, MarketOption } from '../models';
import { Trash2, X } from 'lucide-react';

interface BetSlipProps {
  selection: { market: Market; option: MarketOption } | null;
  parlaySelections: Array<{ market: Market; option: MarketOption }>;
  onPlaceBet: (stake: number) => void;
  onClear: () => void;
  balance: number;
}

export const BetSlip: React.FC<BetSlipProps> = ({ selection, parlaySelections, onPlaceBet, onClear, balance }) => {
  const [stakeInput, setStakeInput] = useState<string>('20');
  const [tab, setTab] = useState<'BETS' | 'PARLAYS'>('BETS');
  const previousParlayCount = useRef(0);

  const isSinglesEmpty = !selection;
  const isParlayEmpty = parlaySelections.length === 0;
  const stake = Number(stakeInput) || 0;
  const potentialPayout = selection ? stake * selection.option.odds : 0;
  const isAffordable = stake <= balance;
  const marketTone = useMemo(() => {
    if (!selection) return '';
    return selection.option.marketKey === 'spreads' ? 'SPREAD' : selection.option.marketKey.toUpperCase();
  }, [selection]);
  const americanOdds = useMemo(() => {
    if (!selection) return 0;
    return Math.round((selection.option.odds - 1) * 100);
  }, [selection]);
  const decimalToAmerican = (decimalOdds: number) => {
    if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) return 0;
    if (decimalOdds >= 2) return Math.round((decimalOdds - 1) * 100);
    return Math.round(-100 / (decimalOdds - 1));
  };
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
          name: sel.option.label,
          matchup: sel.market.title.replace(' @ ', ' vs '),
          odds: odds >= 0 ? `+${odds}` : `${odds}`,
          won: false,
          marketKey: sel.option.marketKey === 'spreads' ? 'SPREAD' : (sel.option.marketKey ?? 'h2h').toUpperCase(),
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

  const handleDigit = (digit: string) => {
    setStakeInput((current) => {
      if (digit === '0' && current === '0') return current;
      if (current === '0' && digit !== '.') return digit;
      if (digit === '.' && current.includes('.')) return current;
      return `${current}${digit}`;
    });
  };

  const handleBackspace = () => {
    setStakeInput((current) => {
      if (current.length <= 1) return '0';
      return current.slice(0, -1);
    });
  };

  const addStake = (amount: number) => {
    setStakeInput((Number(stakeInput || '0') + amount).toString());
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 lg:static lg:w-[330px] lg:self-stretch lg:h-screen animate-in slide-in-from-bottom lg:slide-in-from-right duration-300 z-50">
      <div className="mx-4 mb-4 lg:m-0 rounded-t-2xl lg:rounded-none lg:h-full p-4 lg:px-4 lg:pb-4 lg:pt-6 shadow-2xl border-t border-violet-500/40 lg:border-t-0 lg:border-l border-slate-700/70 bg-[#171427]">
        <div className="flex items-center justify-between mb-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/70 px-2 py-1 text-[11px]">
            <span className="text-slate-300">Balance</span>
            <span className="font-bold text-violet-300">${balance.toFixed(2)}</span>
          </div>
          <button className="text-slate-500 hover:text-slate-300 transition-colors" title="Close bet slip">
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1 mb-3 rounded-md border border-slate-800 bg-[#100d1f] p-1">
          {(['BETS', 'PARLAYS'] as const).map((nextTab) => (
            <button
              key={nextTab}
              onClick={() => setTab(nextTab)}
              className={`rounded-sm px-2 py-1.5 text-[10px] font-bold tracking-wide transition-all ${
                tab === nextTab ? 'bg-slate-700 text-violet-200' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {nextTab}
            </button>
          ))}
        </div>

        <div className="flex justify-between items-center mb-2">
          <h2 className="text-sm font-semibold text-slate-300">Bet Slip</h2>
          <button
            onClick={onClear}
            className="text-slate-500 hover:text-red-400 transition-colors"
            disabled={isSinglesEmpty && isParlayEmpty}
            title={isSinglesEmpty && isParlayEmpty ? 'No active selection' : 'Clear bet slip'}
          >
            <Trash2 size={20} />
          </button>
        </div>

        {selection && tab === 'BETS' ? (
          <div className="mb-4">
            <div className="p-3 rounded-md bg-[#0f0c1c] border border-slate-800 mb-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">SINGLE</p>
                  <p className="text-xs text-slate-300 truncate">{selection.market.title.replace(' @ ', ' / ')}</p>
                </div>
                <span className="text-violet-300 font-black text-sm">+{Math.round((selection.option.odds - 1) * 100)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-slate-800 pt-2">
                <span className="text-[10px] text-slate-500">{marketTone}</span>
                <span className="text-sm font-bold text-slate-100">{selection.option.label}</span>
              </div>
            </div>

            <div className="rounded-md border border-slate-800 bg-[#100d1f] px-3 py-2 mb-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Wager</span>
                <span className="text-lg font-bold text-slate-100">${stake.toLocaleString()}</span>
              </div>
              <div className="mt-2 h-0.5 bg-violet-500/80 rounded-full" />
              {!isAffordable && <p className="text-red-400 text-[10px] mt-2 font-semibold">Insufficient funds</p>}
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              {[20, 50, 100].map((val) => (
                <button
                  key={val}
                  onClick={() => addStake(val)}
                  className="py-2 rounded bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-200 transition-colors"
                >
                  +${val}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handleDigit(digit)}
                  className="py-2.5 rounded bg-slate-800 hover:bg-slate-700 text-base font-semibold text-slate-100 transition-colors"
                >
                  {digit}
                </button>
              ))}
              <button
                onClick={handleBackspace}
                className="py-2.5 rounded bg-slate-800 hover:bg-slate-700 text-base font-semibold text-slate-100 transition-colors"
                aria-label="Backspace"
              >
                ⌫
              </button>
            </div>

            <div className="flex justify-between items-center pt-3 mt-3 border-t border-slate-800">
              <span className="text-xs text-slate-400">Potential payout</span>
              <span className="text-sm font-bold text-emerald-300">${potentialPayout.toFixed(2)}</span>
            </div>
          </div>
        ) : !isParlayEmpty && tab === 'PARLAYS' ? (
          <div className="mb-4 rounded-md border border-slate-800 bg-[#100d1f] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2">
                <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Parlay</span>
                <span className="text-sm font-semibold text-slate-200">{parlayLegs.length}-Bet Parlay</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-violet-300 font-black text-sm">{parlayAmericanOdds >= 0 ? `+${parlayAmericanOdds}` : parlayAmericanOdds}</span>
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">Open</span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 border-b border-slate-800 pb-2">
              <div>
                <p className="text-[10px] uppercase text-slate-500">Wager</p>
                <p className="text-3xl leading-none mt-0.5 font-light text-slate-100">${stake.toFixed(0)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase text-slate-500">Paid</p>
                <p className="text-3xl leading-none mt-0.5 font-light text-slate-500">--</p>
              </div>
            </div>

            <div className="mt-3 max-h-[52vh] overflow-y-auto custom-scrollbar pr-1 pl-3 border-l-2 border-pink-500/90">
              {parlayLegs.map((leg) => (
                <div key={leg.id} className="py-2.5 border-b border-slate-800/80 last:border-b-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-slate-100 truncate">
                        <span className={`mr-1.5 ${leg.won ? 'text-emerald-400' : 'text-violet-300'}`}>{leg.won ? '●' : '●'}</span>
                        {leg.name}
                      </p>
                      <p className="text-[10px] font-bold tracking-[0.2em] text-slate-500 uppercase">{leg.marketKey}</p>
                      <p className="text-xs text-slate-500 truncate mt-1">{leg.matchup}</p>
                    </div>
                    <span className="shrink-0 text-xl font-semibold text-violet-300">{leg.odds}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-slate-800 bg-[#100d1f] px-4 py-10 text-center text-slate-400 mb-4 lg:min-h-[48vh] lg:flex lg:flex-col lg:items-center lg:justify-center">
            <p className="text-sm font-semibold text-slate-300 mb-1">{tab === 'PARLAYS' ? 'No parlays yet' : 'No bets yet'}</p>
            <p className="text-xs text-slate-500">Pick a market selection to add it here.</p>
          </div>
        )}

        <button
          disabled={(tab === 'BETS' && isSinglesEmpty) || (tab === 'PARLAYS' && isParlayEmpty) || !isAffordable || stake <= 0}
          onClick={() => onPlaceBet(stake)}
          className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3 rounded-md shadow-lg shadow-violet-600/20 active:scale-95 transition-all text-sm"
        >
          Done
        </button>
      </div>
    </div>
  );
};
