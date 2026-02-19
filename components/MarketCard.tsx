import React from 'react';
import { Market, MarketOption } from '../models';
import { Timer } from 'lucide-react';

interface MarketCardProps {
  market: Market;
  onBetClick: (market: Market, option: MarketOption) => void;
}

export const MarketCard: React.FC<MarketCardProps> = ({ market, onBetClick }) => {
  return (
    <div className="glass-card rounded-xl p-5 hover:border-blue-500/50 transition-all duration-300 group">
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mb-2 inline-block ${
            market.status === 'LIVE' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
          }`}>
            {market.status}
          </span>
          <h3 className="font-bold text-lg text-slate-100 leading-tight">{market.title}</h3>
          <p className="text-sm text-slate-400">{market.subtitle}</p>
        </div>
        <div className="flex flex-col items-end text-right">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
            <Timer size={12} /> {market.subtitle}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        {market.options.map((option) => (
          <button
            key={option.id}
            onClick={() => onBetClick(market, option)}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-800/50 hover:bg-blue-600 border border-slate-700 hover:border-blue-400 transition-all group"
          >
            <span className="text-xs text-slate-400 group-hover:text-blue-100 mb-1">{option.label}</span>
            <span className="text-lg font-bold text-blue-400 group-hover:text-white">{option.odds.toFixed(2)}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
