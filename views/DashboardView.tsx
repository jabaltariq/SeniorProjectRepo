import React, {useEffect} from 'react';
import {
  Trophy,
  Wallet as WalletIcon,
  Zap,
  BarChart3,
  History,
  Gamepad2,
  TrendingUp,
  Search,
  Users,
  Medal,
  Loader2,
  RefreshCw,
  AlertCircle,
  LogOut,
} from 'lucide-react';
import type { Market, MarketOption, Bet } from '../models';
import { MarketCard } from '../components/MarketCard';
import { BetSlip } from '../components/BetSlip';
import { Leaderboard } from '../components/Leaderboard';
import { SocialView } from '../components/SocialView';
import type { LeaderboardEntry, Friend, SocialActivity } from '../models';
import { DAILY_BONUS_AMOUNT } from '../models/constants';
import {getUserMoney, listenForChange} from "@/services/dbOps.ts";

interface DashboardViewProps {
  balance: number;
  activeBets: Bet[];
  betSelection: { market: Market; option: MarketOption } | null;
  dailyBonusAvailable: boolean;
  bonusMessage: string | null;
  view: string;
  userInitials: string;
  sportFilter: string;
  leagueFilter: string;
  searchQuery: string;
  sportTabs: readonly string[];
  availableLeagues: string[];
  markets: Market[];
  loading: boolean;
  error: string | null;
  leaderboardEntries: LeaderboardEntry[];
  friends: Friend[];
  activity: SocialActivity[];
  onPlaceBet: (stake: number) => void;
  onClearBet: () => void;
  onSelectBet: (market: Market, option: MarketOption) => void;
  onDailyBonus: () => void;
  onLogout: () => void;
  onSetView: (view: string) => void;
  onSportFilter: (sport: string) => void;
  onLeagueFilter: (league: string) => void;
  onSearchChange: (query: string) => void;
  onRetryMarkets: () => void;
  onChallenge: (friend: Friend) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = (props) => {
  var {
    balance,
    betSelection,
    dailyBonusAvailable,
    bonusMessage,
    view,
    userInitials,
    sportFilter,
    leagueFilter,
    searchQuery,
    sportTabs,
    availableLeagues,
    markets,
    loading,
    error,
    leaderboardEntries,
    friends,
    activity,
    onPlaceBet,
    onClearBet,
    onSelectBet,
    onDailyBonus,
    onLogout,
    onSetView,
    onSportFilter,
    onLeagueFilter,
    onSearchChange,
    onRetryMarkets,
    onChallenge,
  } = props;

  const renderContent = () => {
    useEffect(() => {
      listenForChange(localStorage.getItem("uid"))

    }, []);

    switch (view) {
      case 'LEADERBOARD':
        return <Leaderboard entries={leaderboardEntries} />;
      case 'SOCIAL':
        return <SocialView friends={friends} activities={activity} onChallenge={onChallenge} />;
      case 'HISTORY':
        return (
          <div className="animate-in fade-in duration-500">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <History className="text-blue-400" size={24} /> Betting History
            </h2>
            <div className="space-y-4">
              {props.activeBets.length > 0 ? (
                props.activeBets.map(bet => (
                  <div key={bet.id} className="glass-card rounded-2xl p-6 border-slate-800 hover:border-slate-700 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">{bet.marketTitle}</p>
                        <h4 className="text-lg font-bold">Selected: {bet.optionLabel}</h4>
                        <p className="text-xs text-slate-500 mt-1">{bet.placedAt.toLocaleString()}</p>
                      </div>
                      <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Pending Result</span>
                    </div>
                    <div className="flex justify-between items-end border-t border-slate-800 pt-4">
                      <div className="grid grid-cols-2 gap-8">
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase">Stake</p>
                          <p className="font-bold text-slate-200">${bet.stake.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase">Odds</p>
                          <p className="font-bold text-slate-200">{bet.odds.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Potential Payout</p>
                        <p className="text-xl font-black text-blue-400">${bet.potentialPayout.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center glass-card rounded-2xl border-dashed">
                  <Gamepad2 className="mx-auto text-slate-700 mb-4" size={48} />
                  <h3 className="text-xl font-bold text-slate-500">No bets placed yet</h3>
                  <button onClick={() => onSetView('MARKETS')} className="mt-4 text-blue-400 hover:text-blue-300 font-bold">
                    Start betting now &rarr;
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      case 'MARKETS':
      default:
        return (
          <>
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="text"
                  placeholder="Search games..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 outline-none focus:border-blue-500 transition-all text-sm"
                />
              </div>
              <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800 overflow-x-auto no-scrollbar max-w-full">
                {sportTabs.map((t) => (
                  <button
                    key={t}
                    onClick={() => onSportFilter(t)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${sportFilter === t ? 'bg-slate-800 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    {t === 'ALL' ? 'All Sports' : t}
                  </button>
                ))}
              </div>
            </div>

            {sportFilter !== 'ALL' && availableLeagues.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Leagues</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onLeagueFilter('ALL')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${leagueFilter === 'ALL' ? 'bg-slate-700 text-blue-400 border border-slate-600' : 'bg-slate-800/50 text-slate-500 hover:text-slate-300 border border-slate-700'}`}
                  >
                    All Leagues
                  </button>
                  {availableLeagues.map((league) => (
                    <button
                      key={league}
                      onClick={() => onLeagueFilter(league)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${leagueFilter === league ? 'bg-slate-700 text-blue-400 border border-slate-600' : 'bg-slate-800/50 text-slate-500 hover:text-slate-300 border border-slate-700'}`}
                    >
                      {league}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="text-blue-400 animate-spin" size={48} />
                <p className="text-slate-400">Loading live odds...</p>
              </div>
            ) : error ? (
              <div className="glass-card rounded-2xl p-8 text-center border-red-500/20">
                <AlertCircle className="mx-auto text-red-400 mb-4" size={48} />
                <h3 className="text-xl font-bold text-slate-200 mb-2">Couldn&apos;t load odds</h3>
                <p className="text-slate-400 mb-4">{error}</p>
                <p className="text-xs text-slate-500 mb-4">Set ODDS_API_KEY in .env.local and restart the dev server.</p>
                <button onClick={onRetryMarkets} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all">
                  <RefreshCw size={18} /> Retry
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {markets.length > 0 ? (
                  markets.map(market => (
                    <MarketCard key={market.id} market={market} onBetClick={onSelectBet} />
                  ))
                ) : (
                  <div className="col-span-full py-20 text-center">
                    <BarChart3 className="mx-auto text-slate-700 mb-4" size={48} />
                    <h3 className="text-xl font-bold text-slate-500">No matches found</h3>
                    <p className="text-slate-600">
                      {sportFilter === 'ALL' ? 'Try a different search term.' : leagueFilter !== 'ALL' ? `No ${leagueFilter} games at the moment. Try another league or sport.` : `No ${sportFilter} games at the moment. Try another sport.`}
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col lg:flex-row">
      {bonusMessage && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm font-medium text-green-400 shadow-lg animate-in fade-in slide-in-from-top-2">
          {bonusMessage}
        </div>
      )}
      <nav className="w-full lg:w-20 bg-slate-900 border-b lg:border-r border-slate-800 flex flex-row lg:flex-col items-center py-4 px-2 lg:py-8 sticky top-0 z-40 lg:h-screen justify-between lg:justify-start lg:gap-8">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/40 cursor-pointer" onClick={() => onSetView('MARKETS')}>
          <Zap className="text-white" size={24} />
        </div>
        <div className="flex lg:flex-col gap-4">
          <button title="Markets" onClick={() => onSetView('MARKETS')} className={`p-3 rounded-xl transition-all ${view === 'MARKETS' ? 'bg-blue-600/10 text-blue-400' : 'text-slate-500 hover:bg-slate-800'}`}>
            <TrendingUp size={24} />
          </button>
          <button title="Leaderboard" onClick={() => onSetView('LEADERBOARD')} className={`p-3 rounded-xl transition-all ${view === 'LEADERBOARD' ? 'bg-blue-600/10 text-blue-400' : 'text-slate-500 hover:bg-slate-800'}`}>
            <Medal size={24} />
          </button>
          <button title="Social & Friends" onClick={() => onSetView('SOCIAL')} className={`p-3 rounded-xl transition-all ${view === 'SOCIAL' ? 'bg-blue-600/10 text-blue-400' : 'text-slate-500 hover:bg-slate-800'}`}>
            <Users size={24} />
          </button>
          <button title="History" onClick={() => onSetView('HISTORY')} className={`p-3 rounded-xl transition-all ${view === 'HISTORY' ? 'bg-blue-600/10 text-blue-400' : 'text-slate-500 hover:bg-slate-800'}`}>
            <History size={24} />
          </button>
        </div>
        <div className="hidden lg:mt-auto lg:block">
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600">
              <span className="text-xs font-bold">{userInitials}</span>
            </div>
            <button onClick={onLogout} className="text-xs text-slate-500 hover:text-slate-400 flex items-center gap-1">
              <LogOut size={12} /> Log out
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              BetHub <span className="text-xs font-normal text-slate-500 bg-slate-800 px-2 py-1 rounded">LIVE</span>
            </h1>
            <p className="text-slate-400 mt-1">Simulated betting with fake currency.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="glass-card flex items-center gap-3 px-6 py-3 rounded-2xl border-green-500/20 shadow-lg shadow-green-900/10">
              <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center">
                <WalletIcon className="text-green-400" size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Wallet Balance</p>
                <p className="text-xl font-black text-green-400">${balance.toLocaleString()}</p>
              </div>
            </div>
            <button
              onClick={onDailyBonus}
              disabled={!dailyBonusAvailable}
              className={`px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all active:scale-95 ${dailyBonusAvailable ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
            >
              <Trophy size={18} /> {dailyBonusAvailable ? `Daily Bonus (+$${DAILY_BONUS_AMOUNT})` : 'Claimed Today'}
            </button>
            <button onClick={onLogout} className="lg:hidden px-4 py-2 rounded-xl text-sm text-slate-500 hover:text-slate-300 hover:bg-slate-800 flex items-center gap-2">
              <LogOut size={16} /> Log out
            </button>
          </div>
        </header>
        {renderContent()}
      </main>

      <BetSlip selection={betSelection} onClear={onClearBet} onPlaceBet={onPlaceBet} balance={balance} />
    </div>
  );
};
