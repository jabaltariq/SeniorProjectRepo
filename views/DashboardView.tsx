import React, { useState } from 'react';
import { useLocation, useNavigate, NavLink } from 'react-router-dom';
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
  Settings,
  Flame,
  Clock3,
  ChevronRight,
  Compass,
  Sparkles,
  CircleDot,
  User,
} from 'lucide-react';
import type { Market, MarketOption, Bet } from '../models';
import { BetSlip } from '../components/BetSlip';
import { Leaderboard } from '../components/Leaderboard';
import { SocialView } from '../components/SocialView';
import { HomeLanding } from '../components/HomeLanding';
import { SettingsView } from './SettingsView';
import { BetOfTheDayCard } from '../components/BetofthedayCard';
import { ProfileView } from './ProfileView';
import type { LeaderboardEntry, Friend, SocialActivity } from '../models';
import { DAILY_BONUS_AMOUNT } from '../models/constants';
import { getBets, getUserMoney, listenForChange} from "@/services/dbOps.ts";
import {betList, friendsList} from "@/services/authService.ts";

type DashboardViewType = 'HOME' | 'MARKETS' | 'HISTORY' | 'LEADERBOARD' | 'SOCIAL' | 'PROFILE';

function pathToView(pathname: string): DashboardViewType {
  const normalized = pathname.replace(/^\/bethub\/?/, '').replace(/^\//, '');
  const segment = normalized.split('/').filter(Boolean)[0] ?? '';

  switch (segment) {
    case '':
      return 'HOME';
    case 'bet':
    case 'markets':
      return 'MARKETS';
    case 'profile':
      return 'PROFILE';
    case 'friends':
      return 'SOCIAL';
    case 'leaderboard':
      return 'LEADERBOARD';
    case 'history':
      return 'HISTORY';
    default:
      return 'HOME';
  }
}

interface DashboardViewProps {
  balance: number;
  activeBets: Bet[];
  betList: Bet[];
  betSelection: { market: Market; option: MarketOption } | null;
  parlaySelections: Array<{ market: Market; option: MarketOption }>;
  dailyBonusAvailable: boolean;
  bonusMessage: string | null;
  view: string;
  userInitials: string;
  userEmail: string;
  sportFilter: string;
  hasSelectedSport: boolean;
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
  onPlaceBet: (stake: number, betType?: 'single' | 'parlay') => void;
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
  const {
    balance,
    betList,
    betSelection,
    parlaySelections,
    dailyBonusAvailable,
    bonusMessage,
    userInitials,
    userEmail,
    sportFilter,
    hasSelectedSport,
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

  const location = useLocation();
  const navigate = useNavigate();
  const view = pathToView(location.pathname);
  const [marketLayoutMode, setMarketLayoutMode] = useState<'DISCOVER' | 'ALL_LEAGUES'>('DISCOVER');

  // ── Grab uid once for BetOfTheDayCard ──────────────────────────
  const uid = localStorage.getItem('uid') ?? '';

  const splitTeams = (title: string) => {
    const [away, home] = title.split(' @ ');
    return { away: away || title, home: home || 'TBD' };
  };

  const firstByKey = (market: Market, key: MarketOption['marketKey'], startsWith?: string) => {
    const matching = market.options.filter((o) => o.marketKey === key);
    if (!startsWith) return matching[0] ?? null;
    return matching.find((o) => o.label.toLowerCase().startsWith(startsWith.toLowerCase())) ?? null;
  };

  const formatMarketTime = (market: Market) => {
    const date = new Date(market.startTime);
    const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (market.status === 'LIVE') {
      return { label: `Live • Started ${time}`, tone: 'live' as const };
    }
    return { label: time, tone: 'upcoming' as const };
  };

  const leagueBadge = (label: string) => {
    const words = label.split(' ').filter(Boolean);
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
    return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
  };

  const SPORT_LOGOS: Record<string, string> = {
    Football: 'https://upload.wikimedia.org/wikipedia/en/a/a2/National_Football_League_logo.svg',
    Basketball: 'https://upload.wikimedia.org/wikipedia/en/0/03/National_Basketball_Association_logo.svg',
    Baseball: 'https://cdn.jsdelivr.net/npm/simple-icons@11.14.0/icons/mlb.svg',
    Hockey: 'https://cdn.jsdelivr.net/npm/simple-icons@11.14.0/icons/nhl.svg',
    Soccer: 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Association_football_ball_01.svg',
  };

  const SPORT_ICON_EMOJI: Record<string, string> = {
    Baseball: '⚾',
    Hockey: '🏒',
    Soccer: '⚽',
    Football: '🏈',
    Basketball: '🏀',
  };

  const normalizeSportKey = (sport: string) => {
    const s = sport.trim();
    return Object.keys(SPORT_LOGOS).find((k) => k.toLowerCase() === s.toLowerCase()) ?? s;
  };

  const renderSportIcon = (sport: string, className = 'h-5 w-5') => {
    const key = normalizeSportKey(sport);
    const emoji = SPORT_ICON_EMOJI[key];
    const src = SPORT_LOGOS[key];
    if (!src) {
      return emoji ? (
          <span className={`inline-flex items-center justify-center ${className} text-[1.1rem] leading-none`}>{emoji}</span>
      ) : (
          <CircleDot size={14} className="text-slate-300" />
      );
    }
    const lightMonoLogo = key === 'Baseball' || key === 'Hockey';
    return (
        <span className="inline-flex items-center justify-center">
        <img
            src={src}
            alt={`${key} logo`}
            className={`${className} object-contain ${lightMonoLogo ? 'brightness-0 invert opacity-90' : ''}`}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const next = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (next) next.style.display = 'inline-flex';
            }}
        />
        <span className="hidden items-center justify-center text-[1.1rem] leading-none" aria-hidden>
          {emoji ?? '·'}
        </span>
      </span>
    );
  };

  const leaguesBySport: Record<string, string[]> = markets.reduce((acc, market) => {
    if (!acc[market.category]) acc[market.category] = [];
    if (!acc[market.category].includes(market.subtitle)) acc[market.category].push(market.subtitle);
    return acc;
  }, {} as Record<string, string[]>);

  const safeBalance = Number.isFinite(balance) ? balance : 0;
  const displayBalance = `$${Math.max(0, safeBalance).toFixed(2)}`;
  const isOptionSelected = (market: Market, option: MarketOption) =>
      parlaySelections.some((sel) => sel.market.id === market.id && sel.option.id === option.id);

  const renderContent = () => {
    switch (view) {
      case 'HOME':
        return (
            <div className="animate-in fade-in duration-500 flex min-h-0 w-full flex-1 flex-col">
              <HomeLanding dailyBonusAvailable={dailyBonusAvailable} onDailyBonus={onDailyBonus} onLogout={onLogout} />
            </div>
        );
      case 'LEADERBOARD':
        return <Leaderboard entries={leaderboardEntries} />;
      case 'SOCIAL':
        return <SocialView friends={friends} activities={activity} onChallenge={onChallenge} bets={betList} />;
      case 'SETTINGS':
        return <SettingsView userEmail={userEmail} />;
      case 'PROFILE':
        return (
          <ProfileView
            userInitials={userInitials}
            userEmail={userEmail}
            balance={balance}
            activeBetsCount={props.activeBets.length}
            currentUserId={typeof localStorage !== 'undefined' ? localStorage.getItem('uid') : null}
          />
        );
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
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                                bet.status?.toLowerCase() === 'won'  ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                    bet.status?.toLowerCase() === 'lost' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                        'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            }`}>
                        {bet.status?.toLowerCase() === 'won' ? 'Won' : bet.status?.toLowerCase() === 'lost' ? 'Lost' : 'Pending'}
                      </span>
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
                      <button onClick={() => navigate('/bet')} className="mt-4 text-blue-400 hover:text-blue-300 font-bold">
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
              <div className="grid grid-cols-1 xl:grid-cols-[220px_minmax(0,1fr)] gap-5">
                <aside className="glass-card rounded-xl p-3 border border-slate-800/80 h-fit xl:sticky xl:top-6">
                  <div className="grid grid-cols-2 gap-1 mb-3 rounded-lg border border-slate-800 bg-slate-900 p-1">
                    <button
                        onClick={() => setMarketLayoutMode('DISCOVER')}
                        className={`inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[10px] font-bold transition-colors ${
                            marketLayoutMode === 'DISCOVER' ? 'bg-slate-700 text-blue-300' : 'text-slate-500 hover:text-slate-300'
                        }`}
                    >
                      <Compass size={11} />
                      Discover
                    </button>
                    <button
                        onClick={() => {
                          setMarketLayoutMode('ALL_LEAGUES');
                          onSportFilter('ALL');
                          onLeagueFilter('ALL');
                        }}
                        className={`rounded-md px-2 py-1.5 text-[10px] font-bold transition-colors ${
                            marketLayoutMode === 'ALL_LEAGUES' ? 'bg-slate-700 text-blue-300' : 'text-slate-500 hover:text-slate-300'
                        }`}
                    >
                      All Leagues
                    </button>
                  </div>

                  {marketLayoutMode === 'DISCOVER' ? (
                      <>
                        <div className="grid grid-cols-4 gap-1.5 mb-4">
                          {sportTabs.filter((tab) => tab !== 'ALL').slice(0, 8).map((tab) => (
                              <button
                                  key={`tile-${tab}`}
                                  onClick={() => onSportFilter(tab)}
                                  title={tab}
                                  className={`rounded-lg border p-2 flex items-center justify-center text-[10px] font-black transition-all ${
                                      sportFilter === tab
                                          ? 'border-blue-500 bg-blue-600/20 text-blue-200'
                                          : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                                  }`}
                              >
                                {renderSportIcon(tab)}
                              </button>
                          ))}
                        </div>

                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Popular</p>
                        <div className="space-y-1.5 mb-4">
                          <button className="w-full text-left px-2 py-1.5 rounded-md text-xs border border-slate-800 bg-slate-900/70 text-amber-300/90 hover:text-amber-200 transition-all inline-flex items-center gap-2">
                            <Sparkles size={12} />
                            Boosts
                          </button>

                          {/* ── Promotions button — expands BetOfTheDayCard below ── */}
                          <div className="space-y-1">
                            <button className="w-full text-left px-2 py-1.5 rounded-md text-xs border border-slate-800 bg-slate-900/70 text-cyan-300/90 hover:text-cyan-200 transition-all inline-flex items-center gap-2">
                              <Flame size={12} />
                              Promotions
                            </button>
                            {/* Free Bet of the Day card lives here, under Promotions */}
                            {uid && <BetOfTheDayCard uid={uid} />}
                          </div>

                          {markets.slice(0, 5).map((market) => (
                              <button
                                  key={`popular-${market.id}`}
                                  onClick={() => onLeagueFilter(market.subtitle)}
                                  className="w-full text-left px-2 py-1.5 rounded-md text-xs border border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700 hover:bg-slate-900 transition-all truncate inline-flex items-center gap-2"
                              >
                                <CircleDot size={11} className="shrink-0" />
                                <span className="truncate">{market.title.replace(' @ ', ' vs ')}</span>
                              </button>
                          ))}
                        </div>
                      </>
                  ) : (
                      <div className="space-y-4 mb-4">
                        {Object.entries(leaguesBySport)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .slice(0, 6)
                            .map(([sport, leagues]) => (
                                <div key={`sport-group-${sport}`} className="border-b border-slate-800 pb-3 last:border-b-0">
                                  <div className="flex items-center justify-between mb-2">
                                    <button
                                        onClick={() => onSportFilter(sport)}
                                        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-200 hover:text-blue-300 transition-colors"
                                    >
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-700">
                                {renderSportIcon(sport, 'h-3.5 w-3.5')}
                              </span>
                                      {sport}
                                    </button>
                                    <button
                                        onClick={() => onSportFilter(sport)}
                                        className="text-[11px] text-violet-300 hover:text-violet-200 font-bold"
                                    >
                                      View all {leagues.length}
                                    </button>
                                  </div>
                                  <div className="space-y-1">
                                    {leagues.slice(0, 3).map((league) => (
                                        <button
                                            key={`group-league-${sport}-${league}`}
                                            onClick={() => {
                                              onSportFilter(sport);
                                              onLeagueFilter(league);
                                            }}
                                            className="block w-full text-left text-xs text-slate-400 hover:text-slate-200 transition-colors"
                                        >
                                          {league}
                                        </button>
                                    ))}
                                  </div>
                                </div>
                            ))}
                      </div>
                  )}

                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Leagues</p>
                  <div className="space-y-1.5 max-h-[34vh] overflow-y-auto custom-scrollbar pr-1">
                    <button
                        onClick={() => onLeagueFilter('ALL')}
                        className={`w-full text-left px-2.5 py-2 rounded-md text-xs font-bold transition-all ${
                            leagueFilter === 'ALL'
                                ? 'bg-slate-700 text-blue-300 border border-slate-600'
                                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                    >
                      All Leagues
                    </button>
                    {availableLeagues.map((league) => (
                        <button
                            key={league}
                            onClick={() => onLeagueFilter(league)}
                            className={`w-full text-left px-2.5 py-2 rounded-md text-xs font-bold transition-all ${
                                leagueFilter === league
                                    ? 'bg-slate-700 text-blue-300 border border-slate-600'
                                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                            }`}
                        >
                          {league}
                        </button>
                    ))}
                  </div>
                </aside>

                <div className="space-y-4">
                  <div className="flex items-center">
                    <div className="relative w-full max-w-md">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <input
                          type="text"
                          placeholder={hasSelectedSport ? 'Search games...' : 'Select a sport tab to load markets'}
                          value={searchQuery}
                          onChange={(e) => onSearchChange(e.target.value)}
                          disabled={!hasSelectedSport}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-10 pr-3 outline-none focus:border-blue-500 transition-all text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {!loading && !error && leagueFilter === 'ALL' && hasSelectedSport && (
                      <section className="mb-2">
                        <div className="flex items-center gap-2 mb-3">
                          <Flame className="text-orange-400" size={16} />
                          <h3 className="text-xl font-bold text-slate-100 leading-none">Trending Now</h3>
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                          {sportTabs
                              .filter((tab) => tab !== 'ALL')
                              .slice(0, 8)
                              .map((tab) => (
                                  <button
                                      key={`trend-tab-${tab}`}
                                      onClick={() => onSportFilter(tab)}
                                      className={`shrink-0 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition-all ${
                                          sportFilter === tab
                                              ? 'border-violet-400/80 bg-violet-500/20 text-violet-200'
                                              : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                                      }`}
                                  >
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800">
                              {renderSportIcon(tab, 'h-5 w-5')}
                            </span>
                                    {tab}
                                  </button>
                              ))}
                        </div>
                        <button className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-300 hover:text-blue-300 transition-colors">
                          View All Games <ChevronRight size={14} />
                        </button>
                      </section>
                  )}

                  {!hasSelectedSport ? (
                      <div className="col-span-full py-20 text-center rounded-xl border border-dashed border-slate-700/80 bg-slate-950/40">
                        <BarChart3 className="mx-auto text-slate-700 mb-4" size={48} />
                        <h3 className="text-xl font-bold text-slate-200">Choose a sport to load markets</h3>
                        <p className="text-slate-500 mt-2 max-w-md mx-auto text-sm">
                          Pick a sport tab in the sidebar or trending row. We only fetch odds after you select a filter.
                        </p>
                      </div>
                  ) : loading ? (
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
                        <button
                            onClick={onRetryMarkets}
                            disabled={!hasSelectedSport}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <RefreshCw size={18} /> Retry
                        </button>
                      </div>
                  ) : (
                      <div className="overflow-hidden rounded-xl border border-slate-800/90 bg-slate-950/35">
                        <div className="grid grid-cols-[minmax(230px,1.2fr)_repeat(3,minmax(140px,0.7fr))] bg-slate-900/75 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          <div>Game</div>
                          <div className="text-center">Spread</div>
                          <div className="text-center">Total</div>
                          <div className="text-center">Winner</div>
                        </div>
                        {markets.length > 0 ? (
                            markets.map((market) => {
                              const teams = splitTeams(market.title);
                              const spreadAway = market.options.find((o) => o.marketKey === 'spreads' && o.label.toLowerCase().includes(teams.away.toLowerCase()));
                              const spreadHome = market.options.find((o) => o.marketKey === 'spreads' && o.label.toLowerCase().includes(teams.home.toLowerCase()));
                              const totalOver = firstByKey(market, 'totals', 'over') ?? market.options.find((o) => o.marketKey === 'totals');
                              const totalUnder = firstByKey(market, 'totals', 'under') ?? market.options.filter((o) => o.marketKey === 'totals')[1] ?? null;
                              const winnerAway = market.options.find((o) => o.marketKey === 'h2h' && o.label.toLowerCase().includes(teams.away.toLowerCase()));
                              const winnerHome = market.options.find((o) => o.marketKey === 'h2h' && o.label.toLowerCase().includes(teams.home.toLowerCase()));
                              const spreadFallback = firstByKey(market, 'spreads');
                              const winnerFallback = firstByKey(market, 'h2h') ?? market.options[0] ?? null;
                              const timeMeta = formatMarketTime(market);
                              const rowPairs: Array<[MarketOption | null, MarketOption | null]> = [
                                [spreadAway ?? spreadFallback, spreadHome],
                                [totalOver, totalUnder],
                                [winnerAway ?? winnerFallback, winnerHome],
                              ];
                              return (
                                  <div
                                      key={market.id}
                                      className="grid grid-cols-[minmax(230px,1.2fr)_repeat(3,minmax(140px,0.7fr))] items-stretch px-4 py-2.5 border-t border-slate-800/90 bg-slate-900/25 hover:bg-slate-800/35 transition-colors"
                                  >
                                    <div className="pr-3">
                                      <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1 ${timeMeta.tone === 'live' ? 'text-red-400' : 'text-emerald-400'}`}>
                                  <Clock3 size={10} />
                                  {timeMeta.label}
                                </span>
                                        <span className="text-slate-600">|</span>
                                        {market.status === 'LIVE' ? (
                                            <span className="inline-flex items-center gap-1 text-red-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                    Live
                                  </span>
                                        ) : (
                                            <span className="text-slate-400">Upcoming</span>
                                        )}
                                        <span>{market.subtitle}</span>
                                      </p>
                                      <div className="space-y-1">
                                        <p className="text-sm font-semibold text-slate-100 leading-tight">{teams.away}</p>
                                        <p className="text-sm font-semibold text-slate-200 leading-tight">{teams.home}</p>
                                      </div>
                                    </div>

                                    {rowPairs.map((pair, idx) => (
                                        <div className="flex flex-col justify-center gap-1" key={`${market.id}-${idx}`}>
                                          {pair.map((opt, pairIdx) => (
                                              opt ? (
                                                  <button
                                                      key={`${opt.id}-${pairIdx}`}
                                                      onClick={() => onSelectBet(market, opt)}
                                                      className={`w-full rounded-md border px-2.5 py-1.5 text-left transition-all ${
                                                          isOptionSelected(market, opt)
                                                              ? 'border-violet-400 bg-violet-600/20 shadow-[0_0_0_1px_rgba(167,139,250,0.45)]'
                                                              : 'border-slate-700/90 bg-slate-900/95 hover:border-blue-500/80 hover:bg-blue-600/15'
                                                      }`}
                                                  >
                                                    <p className="text-[10px] text-slate-400 truncate">{opt.label}</p>
                                                    <p className={`text-sm font-semibold ${isOptionSelected(market, opt) ? 'text-violet-200' : 'text-blue-300'}`}>
                                                      {opt.odds.toFixed(2)}
                                                    </p>
                                                  </button>
                                              ) : (
                                                  <div key={`${market.id}-na-${idx}-${pairIdx}`} className="w-full rounded-md border border-slate-800 bg-slate-900/60 px-2.5 py-2 text-center text-xs text-slate-600">
                                                    N/A
                                                  </div>
                                              )
                                          ))}
                                        </div>
                                    ))}
                                  </div>
                              );
                            })
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
                </div>
              </div>
            </>
        );
    }
  };

  return (
      <div className="h-screen max-h-screen min-h-0 overflow-hidden bg-gradient-to-br from-slate-800 via-[#0f172a] to-slate-950 text-slate-100 flex flex-col lg:flex-row">
        {bonusMessage && (
            <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm font-medium text-green-400 shadow-lg animate-in fade-in slide-in-from-top-2">
              {bonusMessage}
            </div>
        )}
        <nav className="w-full shrink-0 lg:w-20 bg-gradient-to-b from-slate-900 to-slate-950 border-b lg:border-r border-slate-800 flex flex-row lg:flex-col items-center py-4 px-2 lg:py-8 z-40 lg:h-full lg:min-h-0 justify-between lg:justify-start lg:gap-8">
          <NavLink
              to="/"
              end
              title="Home"
              className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/40 cursor-pointer [&.active]:ring-2 [&.active]:ring-blue-400 [&.active]:ring-offset-2 [&.active]:ring-offset-slate-900"
          >
            <Zap className="text-white" size={24} />
          </NavLink>
          <div className="flex lg:flex-col gap-4">
            <NavLink to="/bet" title="Live betting" className={({ isActive }) => `p-3 rounded-xl transition-all ${isActive ? 'bg-blue-600/10 text-blue-400' : 'text-slate-500 hover:bg-slate-800'}`}>
              <TrendingUp size={24} />
            </NavLink>
            <NavLink to="/leaderboard" title="Leaderboard" className={({ isActive }) => `p-3 rounded-xl transition-all ${isActive ? 'bg-blue-600/10 text-blue-400' : 'text-slate-500 hover:bg-slate-800'}`}>
              <Medal size={24} />
            </NavLink>
            <NavLink to="/friends" title="Social & Friends" className={({ isActive }) => `p-3 rounded-xl transition-all ${isActive ? 'bg-blue-600/10 text-blue-400' : 'text-slate-500 hover:bg-slate-800'}`}>
              <Users size={24} />
            </NavLink>
            <NavLink to="/history" title="History" className={({ isActive }) => `p-3 rounded-xl transition-all ${isActive ? 'bg-blue-600/10 text-blue-400' : 'text-slate-500 hover:bg-slate-800'}`}>
              <History size={24} />
            </NavLink>
            <NavLink to="/profile" title="Profile" className={({ isActive }) => `p-3 rounded-xl transition-all ${isActive ? 'bg-blue-600/10 text-blue-400' : 'text-slate-500 hover:bg-slate-800'}`}>
              <User size={24} />
            </NavLink>
          </div>
          <div className="hidden lg:mt-auto lg:block">
            <div className="flex flex-col items-center gap-2">
              <NavLink
                  to="/profile"
                  className={({ isActive }) => `w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600 hover:border-slate-500 hover:bg-slate-600 transition-all cursor-pointer ${isActive ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900' : ''}`}
                  title="Profile"
              >
                <span className="text-xs font-bold">{userInitials}</span>
              </NavLink>
              <button onClick={onLogout} className="text-xs text-slate-500 hover:text-slate-400 flex items-center gap-1">
                <LogOut size={12} /> Log out
              </button>
            </div>
          </div>
        </nav>

        <main
            className={`flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-contain custom-scrollbar ${view === 'HOME' ? 'p-0 flex flex-col' : 'p-4 lg:p-8'}`}
        >
          {view !== 'HOME' && (
              <header className="mb-7">
                <div className="rounded-xl border border-slate-800/90 bg-slate-900/35 px-4 py-4 lg:px-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h1 className="text-[2rem] leading-none font-extrabold text-white tracking-tight">BetHub</h1>
                      <p className="text-slate-400 mt-2 text-sm">Simulated betting with fake currency.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                    <WalletIcon size={13} />
                    Balance
                    <span className="text-emerald-200">{displayBalance}</span>
                  </span>
                      <button
                          onClick={onDailyBonus}
                          disabled={!dailyBonusAvailable}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 transition-all active:scale-95 ${
                              dailyBonusAvailable
                                  ? 'bg-indigo-600 hover:bg-indigo-500 text-indigo-50 shadow-md shadow-indigo-700/30'
                                  : 'bg-slate-700/80 text-slate-400 cursor-not-allowed'
                          }`}
                      >
                        <Trophy size={14} />
                        {dailyBonusAvailable ? `Free Claim +$${DAILY_BONUS_AMOUNT}` : 'Claimed'}
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 border-b border-slate-800/70" />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button onClick={onLogout} className="lg:hidden px-4 py-2 rounded-xl text-sm text-slate-500 hover:text-slate-300 hover:bg-slate-800 flex items-center gap-2">
                    <LogOut size={16} /> Log out
                  </button>
                </div>
              </header>
          )}
          {renderContent()}
        </main>

        {view === 'MARKETS' && (
            <BetSlip
                selection={betSelection}
                parlaySelections={parlaySelections}
                activeBets={props.activeBets}
                onClear={onClearBet}
                onPlaceBet={onPlaceBet}
                onSelectBet={onSelectBet}
                balance={balance}
            />
        )}
      </div>
  );
};