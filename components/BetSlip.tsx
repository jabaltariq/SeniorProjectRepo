
import React, { useState } from 'react';
import { Market, MarketOption } from '../models';
import { Trash2, DollarSign, Wallet } from 'lucide-react';

interface BetSlipProps {
  selection: { market: Market; option: MarketOption } | null;
  onPlaceBet: (stake: number) => void;
  onClear: () => void;
  balance: number;
}

export const BetSlip: React.FC<BetSlipProps> = ({ selection, onPlaceBet, onClear, balance }) => {
  const [stake, setStake] = useState<number>(100);

  if (!selection) return null;

  const potentialPayout = stake * selection.option.odds;
  const isAffordable = stake <= balance;

  return (
    <div className="fixed bottom-0 left-0 right-0 lg:static lg:w-80 animate-in slide-in-from-bottom lg:slide-in-from-right duration-300 z-50">
      <div className="mx-4 mb-4 lg:m-0 glass-card rounded-t-2xl lg:rounded-2xl p-6 shadow-2xl shadow-blue-900/20 border-t-2 border-blue-500">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Wallet className="text-blue-400" size={20} /> Bet Slip
          </h2>
          <button onClick={onClear} className="text-slate-500 hover:text-red-400 transition-colors">
            <Trash2 size={20} />
          </button>
        </div>

        <div className="mb-6">
          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 mb-4">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">{selection.market.title}</p>
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-100">{selection.option.label}</span>
              <span className="text-blue-400 font-black">@{selection.option.odds.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Set Stake (Fake $)</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <DollarSign size={16} />
                </div>
                <input
                  type="number"
                  value={stake}
                  onChange={(e) => setStake(Math.max(0, Number(e.target.value)))}
                  className={`w-full bg-slate-900 border ${isAffordable ? 'border-slate-700' : 'border-red-500'} rounded-lg py-2 pl-9 pr-4 font-bold text-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all`}
                />
              </div>
              {!isAffordable && <p className="text-red-400 text-[10px] mt-1 font-bold">Insufficient funds!</p>}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[50, 200, 500].map(val => (
                <button
                  key={val}
                  onClick={() => setStake(val)}
                  className="py-1 px-2 rounded bg-slate-700 hover:bg-slate-600 text-xs font-bold transition-colors"
                >
                  +${val}
                </button>
              ))}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-700/50">
              <span className="text-slate-400 text-sm">Potential Payout</span>
              <span className="text-green-400 font-bold text-xl">${potentialPayout.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <button
          disabled={!isAffordable || stake <= 0}
          onClick={() => onPlaceBet(stake)}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all uppercase tracking-widest text-sm"
        >
          Place Simulated Bet
        </button>
      </div>
    </div>
  );
};
