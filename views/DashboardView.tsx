import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, NavLink } from 'react-router-dom';
import {
  Trophy,
  Wallet as WalletIcon,
  Home,
  BarChart3,
  History,
  Gamepad2,
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
  Ticket,
  Layers,
  LayoutGrid,
  CircleDot,
} from 'lucide-react';
import { MarketType, type Market, type MarketOption, type Bet } from '../models';
import { BetSlip } from '../components/BetSlip';
import { Leaderboard } from '../components/Leaderboard';
import { SocialView } from '../components/SocialView';
import { HomeLanding } from '../components/HomeLanding';
import { SettingsView } from './SettingsView';
import { BetOfTheDayCard } from '../components/Betofthedaycard';
import { BoostsCard } from '../components/Boostcard';
import { SiteFooter } from '../components/SiteFooter';
import { ProfileView } from './ProfileView';
import { HeadToHeadView } from './HeadToHeadView';
import { StoreView } from './StoreView';
import { Swords, ShoppingBag } from 'lucide-react';
import type { LeaderboardEntry, Friend, SocialActivity } from '../models';
import { BoostType } from '@/services/dbOps.ts';
import { DAILY_BONUS_AMOUNT, MOCK_NFL_TEAM_POOL, VIEW_ALL_GAMES_VISIBLE_THRESHOLD } from '../models/constants';
import { FriendRequest, getBets, getUserMoney, getUserMockNflGames, listenForChange, saveUserMockNflGames } from "@/services/dbOps.ts";
import type { MockNflGameState } from "@/services/dbOps.ts";
import {betList, friendsList} from "@/services/authService.ts";
import type { UserThemeMode } from '@/services/dbOps';

type DashboardViewType = 'HOME' | 'MARKETS' | 'HISTORY' | 'LEADERBOARD' | 'SOCIAL' | 'PROFILE' | 'HEAD_TO_HEAD' | 'SETTINGS' | 'STORE';

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
    case 'head-to-head':
      return 'HEAD_TO_HEAD';
    case 'store':
      return 'STORE';
    case 'settings':
      return 'SETTINGS';
    default:
      return 'HOME';
  }
}

interface DashboardViewProps {
  userName: string;
  userPrivacy: boolean;
  friendReqs: FriendRequest[];
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
  /** Markets for current sport + search only (ignores league chip filter), for sidebar league grouping. */
  sportFilteredMarkets: Market[];
  markets: Market[];
  loading: boolean;
  error: string | null;
  /** Unique games merged into the in-memory search index (from tab loads only). */
  searchCacheMarketCount: number;
  leaderboardEntries: LeaderboardEntry[];
  friends: Friend[];
  activity: SocialActivity[];
  onPlaceBet: (stake: number, betType?: 'single' | 'parlay', boost?: BoostType | null, onBoostUsed?: () => void) => void;
  onClearBet: () => void;
  onSelectBet: (market: Market, option: MarketOption) => void;
  onDailyBonus: () => void;
  onLogout: () => void;
  onSetView: (view: string) => void;
  onSportFilter: (sport: string) => void;
  onSelectLeagueInSport: (sport: string, league: string) => void;
  onLeagueFilter: (league: string) => void;
  onSearchChange: (query: string) => void;
  onRetryMarkets: () => void;
  onChallenge: (friend: Friend) => void;
  themeMode: UserThemeMode;
  themeSaving: boolean;
  onThemeModeChange: (mode: UserThemeMode) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = (props) => {
  const {
    userName,
    friendReqs,
    userPrivacy,
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
    sportFilteredMarkets,
    markets,
    loading,
    error,
    searchCacheMarketCount,
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
    onSelectLeagueInSport,
    onLeagueFilter,
    onSearchChange,
    onRetryMarkets,
    onChallenge,
    themeMode,
    themeSaving,
    onThemeModeChange,
  } = props;

  const location = useLocation();
  const navigate = useNavigate();
  const view = pathToView(location.pathname);
  const isLightMode = themeMode === 'light';
  const [promotionsOpen, setPromotionsOpen] = useState(false);
  const [mockNflGames, setMockNflGames] = useState<MockNflGameState[]>([]);

  const userUid = typeof localStorage !== 'undefined' ? localStorage.getItem('uid') ?? '' : '';

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = isLightMode ? 'light' : 'ocean';
  }, [isLightMode]);

  const normalizeSpreadLine = (line: number) => (line > 0 ? `+${line.toFixed(1)}` : line.toFixed(1));
  const pickRandom = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];
  const randomBetween = (min: number, max: number) => Math.random() * (max - min) + min;
  const decimalOdds = () => Number(randomBetween(1.72, 2.25).toFixed(2));
  const randomWeek = () => Math.floor(randomBetween(1, 19));

  const makeMockGame = (idPrefix: string, previous?: MockNflGameState): MockNflGameState => {
    const teamPool = MOCK_NFL_TEAM_POOL;
    const shouldFlip = Boolean(previous) && Math.random() < 0.5;
    const awayTeam = shouldFlip && previous ? previous.homeTeam : pickRandom(teamPool);
    let homeTeam = shouldFlip && previous ? previous.awayTeam : pickRandom(teamPool);
    let guard = 0;
    while (homeTeam === awayTeam && guard < 10) {
      homeTeam = pickRandom(teamPool);
      guard += 1;
    }

    const spreadMag = Number(randomBetween(1.5, 7.5).toFixed(1));
    const awayFavored = Math.random() < 0.5;
    const spreadLine = awayFavored ? -spreadMag : spreadMag;
    return {
      id: `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      week: randomWeek(),
      awayTeam,
      homeTeam,
      awayOdds: decimalOdds(),
      homeOdds: decimalOdds(),
      totalOverOdds: decimalOdds(),
      totalUnderOdds: decimalOdds(),
      spreadLine,
      totalLine: Number(randomBetween(39.5, 53.5).toFixed(1)),
      status: 'UPCOMING',
      awayScore: null,
      homeScore: null,
      winner: null,
      updatedAtMs: Date.now(),
    };
  };

  const ensureMockBoard = (existing: MockNflGameState[]): MockNflGameState[] => {
    const upcoming = existing.filter((g) => g.status !== 'FINAL');
    const seeded = [...upcoming];
    while (seeded.length < 3) {
      seeded.push(makeMockGame('mock-nfl', seeded[seeded.length - 1]));
    }
    return seeded.slice(0, 3);
  };

  useEffect(() => {
    if (!userUid) return;
    let cancelled = false;
    (async () => {
      try {
        const stored = await getUserMockNflGames(userUid);
        if (cancelled) return;
        const board = ensureMockBoard(stored);
        setMockNflGames(board);
        await saveUserMockNflGames(userUid, board);
      } catch (err) {
        console.error('Failed to load mock NFL games', err);
        if (cancelled) return;
        const board = ensureMockBoard([]);
        setMockNflGames(board);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userUid]);

  const simulateMockGame = async (gameId: string, mode: 'RANDOM' | 'AWAY' | 'HOME') => {
    const next = mockNflGames.map((g) => {
      if (g.id !== gameId) return g;
      const awayBase = Math.floor(randomBetween(7, 38));
      const homeBase = Math.floor(randomBetween(7, 38));
      let awayScore = awayBase;
      let homeScore = homeBase;
      if (mode === 'AWAY') {
        awayScore = Math.max(awayBase, homeBase + 1);
      } else if (mode === 'HOME') {
        homeScore = Math.max(homeBase, awayBase + 1);
      } else if (awayScore === homeScore) {
        homeScore += 1;
      }
      const winner = awayScore > homeScore ? 'AWAY' : 'HOME';
      const finalized = {
        ...g,
        status: 'FINAL' as const,
        awayScore,
        homeScore,
        winner,
        updatedAtMs: Date.now(),
      };
      return finalized;
    });
    setMockNflGames(next);
    if (userUid) {
      await saveUserMockNflGames(userUid, next);
    }
  };

  const createNewMockGame = async (gameId: string) => {
    const next = mockNflGames.map((g) => {
      if (g.id !== gameId) return g;
      return makeMockGame('mock-nfl', g);
    });
    setMockNflGames(next);
    if (userUid) {
      await saveUserMockNflGames(userUid, next);
    }
  };

  useEffect(() => {
    if (mockNflGames.length === 0) return;
    const finalizedMockMarketIds = new Set(
      mockNflGames
        .filter((g) => g.status === 'FINAL')
        .map((g) => `mock-${g.id}`),
    );
    if (finalizedMockMarketIds.size === 0) return;

    // Remove any finalized mock legs from active selection state so users
    // cannot place singles/parlays on games that already ended.
    const staleSelections = parlaySelections.filter((sel) => finalizedMockMarketIds.has(sel.market.id));
    for (const stale of staleSelections) {
      onSelectBet(stale.market, stale.option);
    }

    if (betSelection && finalizedMockMarketIds.has(betSelection.market.id)) {
      onSelectBet(betSelection.market, betSelection.option);
    }
  }, [mockNflGames, parlaySelections, betSelection, onSelectBet]);

  // ── Boost state — lives here so BetSlip and BoostsCard share it ─
  const [activeBoost, setActiveBoost] = useState<BoostType | null>(null);

  const handlePlaceBetWithBoost = (stake: number, betType?: 'single' | 'parlay') => {
    console.log('handlePlaceBetWithBoost called, activeBoost:', activeBoost);
    onPlaceBet(stake, betType, activeBoost, () => setActiveBoost(null));
  };


  // ── Grab uid once for sidebar cards ────────────────────────────
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
      return { label: `Started ${time}`, tone: 'live' as const };
    }
    return { label: time, tone: 'upcoming' as const };
  };

  const mockMarketForGame = (game: MockNflGameState): Market => ({
    id: `mock-${game.id}`,
    sport_key: 'football_nfl_mock',
    title: `${game.awayTeam} @ ${game.homeTeam}`,
    subtitle: 'NFL',
    category: 'Football',
    type: MarketType.SPORTS,
    startTime: new Date(game.updatedAtMs).toISOString(),
    status: game.status === 'FINAL' ? 'CLOSED' : 'UPCOMING',
    options: [
      { id: `${game.id}-spread-away`, label: `${game.awayTeam} ${normalizeSpreadLine(game.spreadLine)}`, odds: game.awayOdds, marketKey: 'spreads' },
      { id: `${game.id}-spread-home`, label: `${game.homeTeam} ${normalizeSpreadLine(-game.spreadLine)}`, odds: game.homeOdds, marketKey: 'spreads' },
      { id: `${game.id}-total-over`, label: `Over ${game.totalLine.toFixed(1)}`, odds: game.totalOverOdds, marketKey: 'totals' },
      { id: `${game.id}-total-under`, label: `Under ${game.totalLine.toFixed(1)}`, odds: game.totalUnderOdds, marketKey: 'totals' },
      { id: `${game.id}-ml-away`, label: game.awayTeam, odds: game.awayOdds, marketKey: 'h2h' },
      { id: `${game.id}-ml-home`, label: game.homeTeam, odds: game.homeOdds, marketKey: 'h2h' },
    ],
  });

  const isMockOptionSelected = (gameId: string, optionId: string) =>
    parlaySelections.some((sel) => sel.market.id === `mock-${gameId}` && sel.option.id === optionId);

  const getLatestUserMockBet = (gameId: string): Bet | null => {
    const marketId = `mock-${gameId}`;
    const matching = props.activeBets.filter((b) => b.marketId === marketId && (b.betType ?? 'single') === 'single');
    if (matching.length === 0) return null;
    const sorted = [...matching].sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime());
    return sorted[0] ?? null;
  };

  const resolveMockBetOutcome = (game: MockNflGameState): 'WON' | 'LOST' | 'PUSH' | 'NONE' => {
    if (game.status !== 'FINAL' || game.awayScore == null || game.homeScore == null) return 'NONE';
    const bet = getLatestUserMockBet(game.id);
    if (!bet) return 'NONE';

    const awaySpreadLabel = `${game.awayTeam} ${normalizeSpreadLine(game.spreadLine)}`;
    const homeSpreadLabel = `${game.homeTeam} ${normalizeSpreadLine(-game.spreadLine)}`;
    const overLabel = `Over ${game.totalLine.toFixed(1)}`;
    const underLabel = `Under ${game.totalLine.toFixed(1)}`;
    const margin = game.awayScore - game.homeScore;
    const totalScore = game.awayScore + game.homeScore;
    const selected = bet.optionLabel.trim();

    if (selected === game.awayTeam) return game.awayScore > game.homeScore ? 'WON' : 'LOST';
    if (selected === game.homeTeam) return game.homeScore > game.awayScore ? 'WON' : 'LOST';
    if (selected === awaySpreadLabel) {
      const spreadResult = margin + game.spreadLine;
      if (spreadResult === 0) return 'PUSH';
      return spreadResult > 0 ? 'WON' : 'LOST';
    }
    if (selected === homeSpreadLabel) {
      const spreadResult = -margin - game.spreadLine;
      if (spreadResult === 0) return 'PUSH';
      return spreadResult > 0 ? 'WON' : 'LOST';
    }
    if (selected === overLabel) {
      if (totalScore === game.totalLine) return 'PUSH';
      return totalScore > game.totalLine ? 'WON' : 'LOST';
    }
    if (selected === underLabel) {
      if (totalScore === game.totalLine) return 'PUSH';
      return totalScore < game.totalLine ? 'WON' : 'LOST';
    }
    return 'NONE';
  };

  /** Small league tiles in the sidebar; falls back to initials when unknown. */
  const resolveLeagueIcon = (league: string): { src: string; invert?: boolean } | null => {
    const l = league.toLowerCase();
    if (l.includes('mlb')) return { src: 'https://cdn.jsdelivr.net/npm/simple-icons@11.14.0/icons/mlb.svg', invert: true };
    if (l.includes('nfl')) return { src: 'https://upload.wikimedia.org/wikipedia/en/a/a2/National_Football_League_logo.svg' };
    if (l.includes('nba')) return { src: 'https://upload.wikimedia.org/wikipedia/en/0/03/National_Basketball_Association_logo.svg' };
    if (l.includes('nhl')) return { src: 'https://cdn.jsdelivr.net/npm/simple-icons@11.14.0/icons/nhl.svg', invert: true };
    if (l.includes('ncaa')) return { src: 'https://upload.wikimedia.org/wikipedia/commons/d/dd/NCAA_logo.svg' };
    if (l.includes('brazil') || l.includes('brasileir') || l.includes('série b'))
      return { src: 'https://upload.wikimedia.org/wikipedia/en/0/05/Flag_of_Brazil.svg' };
    if (l.includes('argentina') || l.includes('primera'))
      return { src: 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Association_football_ball_01.svg' };
    if (l.includes('premier league') || l.includes('epl'))
      return { src: 'https://upload.wikimedia.org/wikipedia/en/f/f2/Premier_League_Logo.svg' };
    if (l.includes('la liga') || l.includes('laliga'))
      return { src: 'https://upload.wikimedia.org/wikipedia/commons/0/0f/LaLiga_logo_2023.svg' };
    if (l.includes('bundesliga')) return { src: 'https://upload.wikimedia.org/wikipedia/en/d/df/Bundesliga_logo_%282017%29.svg' };
    if (l.includes('serie a') && l.includes('ital')) return { src: 'https://upload.wikimedia.org/wikipedia/en/e/e1/Serie_A_logo_2022.svg' };
    if (l.includes('mls')) return { src: 'https://upload.wikimedia.org/wikipedia/commons/7/76/MLS_crest_logo_RGB_gradient.svg' };
    if (l.includes('uefa') || l.includes('champions') || l.includes('europa') || l.includes('world cup'))
      return { src: 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Association_football_ball_01.svg' };
    return null;
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

  /** One row per league (with sport for subtitle + filtering). */
  const leagueNavRows: Array<{ league: string; sport: string }> = (() => {
    const seen = new Map<string, { league: string; sport: string }>();
    for (const m of sportFilteredMarkets) {
      const key = `${m.category}||${m.subtitle}`;
      if (!seen.has(key)) seen.set(key, { league: m.subtitle, sport: m.category });
    }
    return Array.from(seen.values()).sort((a, b) => a.league.localeCompare(b.league));
  })();

  const safeBalance = Number.isFinite(balance) ? balance : 0;
  const displayBalance = `$${Math.max(0, safeBalance).toFixed(2)}`;
  const isOptionSelected = (market: Market, option: MarketOption) =>
      parlaySelections.some((sel) => sel.market.id === market.id && sel.option.id === option.id);

  const renderContent = () => {
    console.log(userPrivacy)
    switch (view) {
      case 'HOME':
        return (
            <div className="animate-in fade-in duration-500 flex min-h-0 w-full flex-1 flex-col">
              <HomeLanding
                dailyBonusAvailable={dailyBonusAvailable}
                onDailyBonus={onDailyBonus}
                onLogout={onLogout}
                isLightMode={isLightMode}
              />
            </div>
        );
      case 'LEADERBOARD':
        return <Leaderboard entries={leaderboardEntries} />;
      case 'SOCIAL':
        return <SocialView friends={friends} activities={activity} onChallenge={onChallenge} bets={betList} userPrivacy={userPrivacy} friendRequests={friendReqs} userName={userName}/>;
        
      case 'PROFILE':
        return (
          <ProfileView
            userInitials={userInitials}
            userEmail={userEmail}
            balance={balance}
            activeBetsCount={props.activeBets.length}
            currentUserId={typeof localStorage !== 'undefined' ? localStorage.getItem('uid') : null}
            themeMode={themeMode}
            themeSaving={themeSaving}
            onThemeModeChange={onThemeModeChange}
          />
        );
      case 'HEAD_TO_HEAD':
        return (
          <HeadToHeadView
            currentUserId={typeof localStorage !== 'undefined' ? localStorage.getItem('uid') : null}
          />
        );
      case 'STORE':
        return (
          <StoreView
            balance={balance}
            currentUserId={typeof localStorage !== 'undefined' ? localStorage.getItem('uid') : null}
          />
        );
      case 'SETTINGS':
        return (
          <SettingsView
            userEmail={userEmail}
            embedded
            themeMode={themeMode}
            themeSaving={themeSaving}
            onThemeModeChange={onThemeModeChange}
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
        const showMockNflBoard =
          sportFilter === 'Football' &&
          (leagueFilter === 'ALL' || leagueFilter.toLowerCase().includes('nfl'));
        return (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-[220px_minmax(0,1fr)] gap-5">
                <aside className="glass-card rounded-xl p-3 border border-slate-800/80 h-fit xl:sticky xl:top-6">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3 inline-flex items-center gap-1.5">
                    <Layers size={11} className="text-slate-500" aria-hidden />
                    Leagues
                  </p>

                  <div className="grid grid-cols-4 gap-1.5 mb-3">
                    {sportTabs.filter((tab) => tab !== 'ALL').slice(0, 8).map((tab) => {
                      const isSportContext = sportFilter === tab;
                      const sportPrimarySelected = isSportContext && leagueFilter !== 'ALL';
                      const sportMutedSelected = isSportContext && leagueFilter === 'ALL';
                      return (
                        <button
                            key={`tile-${tab}`}
                            type="button"
                            onClick={() => onSportFilter(tab)}
                            title={tab}
                            className={`market-top-pill rounded-lg border p-2 flex items-center justify-center text-[10px] font-black transition-all ${
                                sportPrimarySelected
                                    ? 'border-blue-500 bg-blue-600/20 text-blue-200'
                                    : sportMutedSelected
                                      ? 'border-slate-600 bg-slate-800/70 text-slate-300 ring-1 ring-slate-700/80'
                                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                            }`}
                        >
                          {renderSportIcon(tab)}
                        </button>
                      );
                    })}
                    <button
                        type="button"
                        onClick={() => onSportFilter('ALL')}
                        title="All sports & leagues"
                        aria-pressed={sportFilter === 'ALL'}
                        className={`market-top-pill rounded-lg border p-2 flex items-center justify-center transition-all ${
                            sportFilter === 'ALL'
                                ? 'border-blue-500 bg-blue-600/20 text-blue-200'
                                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                        }`}
                    >
                      <LayoutGrid size={20} strokeWidth={2} className="shrink-0" aria-hidden />
                    </button>
                  </div>

                  {hasSelectedSport && leagueNavRows.length > 0 && (
                      <div className="mb-4 space-y-0 divide-y divide-slate-800/90 rounded-lg border border-slate-800 overflow-hidden">
                        {leagueNavRows.map(({ league, sport }) => {
                          const icon = resolveLeagueIcon(league);
                          const selected = leagueFilter === league && sportFilter === sport;
                          return (
                              <button
                                  type="button"
                                  key={`league-row-${sport}-${league}`}
                                  onClick={() => onSelectLeagueInSport(sport, league)}
                                  className={`flex w-full items-center gap-2.5 px-2 py-2.5 text-left transition-colors ${
                                      selected ? 'bg-slate-800/70' : 'bg-slate-900/40 hover:bg-slate-800/40'
                                  }`}
                              >
                                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-950/80">
                                  {icon ? (
                                      <img
                                          src={icon.src}
                                          alt=""
                                          className={`h-5 w-5 object-contain ${icon.invert ? 'brightness-0 invert opacity-90' : ''}`}
                                          loading="lazy"
                                          referrerPolicy="no-referrer"
                                      />
                                  ) : (
                                      <span className="text-[9px] font-black uppercase tracking-tight text-slate-300">
                                        {leagueBadge(league)}
                                      </span>
                                  )}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold text-slate-100">{league}</span>
                                  <span className="block truncate text-[11px] text-slate-500">{sport}</span>
                                </span>
                              </button>
                          );
                        })}
                      </div>
                  )}

                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Popular</p>
                  <div className="space-y-1.5 mb-4">
                    {uid && (
                        <BoostsCard uid={uid} activeBoost={activeBoost} onSelectBoost={setActiveBoost} />
                    )}

                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                      <button
                          type="button"
                          onClick={() => setPromotionsOpen((o) => !o)}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-800/60 transition-colors"
                      >
                        <span className="inline-flex items-center gap-2 text-xs font-bold text-cyan-300/90">
                          <Flame size={13} className="text-cyan-400" />
                          Promotions
                        </span>
                        <Ticket size={14} className="text-slate-500 shrink-0" aria-hidden />
                      </button>
                      {promotionsOpen && (
                          <div className="px-3 pb-3 border-t border-slate-800">
                            <div className="pt-3">{uid && <BetOfTheDayCard uid={uid} />}</div>
                          </div>
                      )}
                    </div>

                    {markets.slice(0, 5).map((market) => (
                        <button
                            key={`popular-${market.id}`}
                            type="button"
                            onClick={() => onSelectLeagueInSport(market.category, market.subtitle)}
                            className="w-full text-left px-2 py-1.5 rounded-md text-xs border border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700 hover:bg-slate-900 transition-all truncate inline-flex items-center gap-2"
                        >
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-800 bg-slate-950/80">
                            {renderSportIcon(market.category, 'h-3.5 w-3.5')}
                          </span>
                          <span className="truncate">{market.title.replace(' @ ', ' vs ')}</span>
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
                          placeholder={hasSelectedSport ? 'Search loaded games…' : 'Select a sport tab to load markets'}
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
                        {markets.length >= VIEW_ALL_GAMES_VISIBLE_THRESHOLD && (
                          <button
                            type="button"
                            className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-300 hover:text-blue-300 transition-colors"
                          >
                            View All Games <ChevronRight size={14} />
                          </button>
                        )}
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
                        {showMockNflBoard && (
                          <div className="border-b border-slate-800/90 bg-gradient-to-r from-amber-500/10 via-slate-900/80 to-amber-500/10 px-4 py-3">
                            <div className="mb-3 flex items-center justify-between">
                              <div className="inline-flex items-center gap-2">
                                <span className="inline-flex rounded-full border border-amber-400/50 bg-amber-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-200">
                                  Mock NFL
                                </span>
                                <span className="text-xs text-slate-300">Simulate outcomes and place test bets</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              {mockNflGames.map((game) => (
                                <div key={game.id} className="grid grid-cols-[minmax(230px,1.2fr)_repeat(3,minmax(140px,0.7fr))] items-stretch gap-2 rounded-lg border border-amber-400/25 bg-slate-900/70 p-2.5">
                                  {(() => {
                                    const mockMarket = mockMarketForGame(game);
                                    const spreadAway = mockMarket.options[0];
                                    const spreadHome = mockMarket.options[1];
                                    const totalOver = mockMarket.options[2];
                                    const totalUnder = mockMarket.options[3];
                                    const mlAway = mockMarket.options[4];
                                    const mlHome = mockMarket.options[5];
                                    const bettable = game.status !== 'FINAL';
                                    const mockBetOutcome = resolveMockBetOutcome(game);
                                    const finalCardTone =
                                      mockBetOutcome === 'WON'
                                        ? 'border-emerald-500/30 bg-emerald-500/10'
                                        : mockBetOutcome === 'LOST'
                                          ? 'border-red-500/30 bg-red-500/10'
                                          : 'border-slate-700/90 bg-slate-900/95';
                                    const finalTextTone =
                                      mockBetOutcome === 'WON'
                                        ? 'text-emerald-300'
                                        : mockBetOutcome === 'LOST'
                                          ? 'text-red-300'
                                          : 'text-slate-300';
                                    return (
                                      <>
                                  <div className="pr-2">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">NFL • Week {game.week}</p>
                                    <div className="mt-1 space-y-0.5">
                                      <p className="text-sm font-semibold text-amber-300">
                                        {game.awayTeam} <span className="text-amber-200/80">@</span> {game.homeTeam}
                                      </p>
                                      {game.status === 'FINAL' && (
                                        <p className="text-[12px] text-slate-300">
                                          <span className={game.winner === 'AWAY' ? 'font-semibold text-emerald-300' : 'text-slate-400'}>
                                            {game.awayTeam} {game.awayScore}
                                          </span>
                                          <span className="mx-1.5 text-slate-500">|</span>
                                          <span className={game.winner === 'HOME' ? 'font-semibold text-emerald-300' : 'text-slate-400'}>
                                            {game.homeTeam} {game.homeScore}
                                          </span>
                                        </p>
                                      )}
                                    </div>
                                    <p className="mt-2 text-[11px] text-slate-400">
                                      Odds {game.awayOdds.toFixed(2)} / {game.homeOdds.toFixed(2)}
                                    </p>
                                    <div className="mt-2 space-y-1">
                                      {game.status === 'FINAL' ? (
                                        <>
                                          <div className={`rounded-md border px-2 py-1.5 text-[10px] ${finalCardTone}`}>
                                            <p className={`font-bold uppercase tracking-wider ${finalTextTone}`}>
                                              Final
                                              {mockBetOutcome !== 'NONE' ? ` • ${mockBetOutcome}` : ''}
                                            </p>
                                            <p className={finalTextTone}>{game.awayScore} - {game.homeScore}</p>
                                            <p className={`font-semibold ${finalTextTone}`}>
                                              Winner: {game.winner === 'AWAY' ? game.awayTeam : game.homeTeam}
                                            </p>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => void createNewMockGame(game.id)}
                                            className="w-full rounded-md border border-emerald-400/50 bg-emerald-500/20 px-2 py-1.5 text-[10px] font-semibold text-emerald-100 hover:bg-emerald-500/30"
                                          >
                                            Create New Game
                                          </button>
                                        </>
                                      ) : (
                                        <div className="grid grid-cols-3 gap-1">
                                          <button
                                            type="button"
                                            onClick={() => void simulateMockGame(game.id, 'RANDOM')}
                                            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-[10px] font-semibold text-slate-200 hover:border-amber-400/70 hover:text-amber-200"
                                          >
                                            Random
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => void simulateMockGame(game.id, 'AWAY')}
                                            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-[10px] font-semibold text-slate-200 hover:border-amber-400/70 hover:text-amber-200"
                                          >
                                            Away Win
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => void simulateMockGame(game.id, 'HOME')}
                                            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-[10px] font-semibold text-slate-200 hover:border-amber-400/70 hover:text-amber-200"
                                          >
                                            Home Win
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex flex-col justify-center gap-1">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-center">Spread</p>
                                    {[spreadAway, spreadHome].map((opt) => (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        disabled={!bettable}
                                        onClick={() => onSelectBet(mockMarket, opt)}
                                        className={`market-odds-btn rounded-md border px-2.5 py-1.5 text-left transition-all ${
                                          isMockOptionSelected(game.id, opt.id)
                                            ? 'border-violet-400 bg-violet-600/20 shadow-[0_0_0_1px_rgba(167,139,250,0.45)]'
                                            : 'border-slate-700/90 bg-slate-900/95 hover:border-blue-500/80 hover:bg-blue-600/15'
                                        } ${!bettable ? 'cursor-not-allowed opacity-65' : ''}`}
                                      >
                                        <p className="text-[11px] text-slate-300 truncate">{opt.label}</p>
                                        <p className="text-lg leading-none font-semibold text-blue-300">{opt.odds.toFixed(2)}</p>
                                      </button>
                                    ))}
                                  </div>

                                  <div className="flex flex-col justify-center gap-1">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-center">Total</p>
                                    {[totalOver, totalUnder].map((opt) => (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        disabled={!bettable}
                                        onClick={() => onSelectBet(mockMarket, opt)}
                                        className={`market-odds-btn rounded-md border px-2.5 py-1.5 text-left transition-all ${
                                          isMockOptionSelected(game.id, opt.id)
                                            ? 'border-violet-400 bg-violet-600/20 shadow-[0_0_0_1px_rgba(167,139,250,0.45)]'
                                            : 'border-slate-700/90 bg-slate-900/95 hover:border-blue-500/80 hover:bg-blue-600/15'
                                        } ${!bettable ? 'cursor-not-allowed opacity-65' : ''}`}
                                      >
                                        <p className="text-[11px] text-slate-300 truncate">{opt.label}</p>
                                        <p className="text-lg leading-none font-semibold text-blue-300">{opt.odds.toFixed(2)}</p>
                                      </button>
                                    ))}
                                  </div>

                                  <div className="flex flex-col justify-center gap-1">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-center">Winner</p>
                                    {[mlAway, mlHome].map((opt) => (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        disabled={!bettable}
                                        onClick={() => onSelectBet(mockMarket, opt)}
                                        className={`market-odds-btn rounded-md border px-2.5 py-1.5 text-left transition-all ${
                                          isMockOptionSelected(game.id, opt.id)
                                            ? 'border-violet-400 bg-violet-600/20 shadow-[0_0_0_1px_rgba(167,139,250,0.45)]'
                                            : 'border-slate-700/90 bg-slate-900/95 hover:border-blue-500/80 hover:bg-blue-600/15'
                                        } ${!bettable ? 'cursor-not-allowed opacity-65' : ''}`}
                                      >
                                        <p className="text-[11px] text-slate-300 truncate">{opt.label}</p>
                                        <p className="text-lg leading-none font-semibold text-blue-300">{opt.odds.toFixed(2)}</p>
                                      </button>
                                    ))}
                                  </div>
                                      </>
                                    );
                                  })()}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
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
                                        <p className="text-sm font-semibold text-slate-100 leading-tight">
                                          {teams.away} <span className="text-slate-400">@</span> {teams.home}
                                        </p>
                                      </div>
                                    </div>

                                    {rowPairs.map((pair, idx) => (
                                        <div className="flex flex-col justify-center gap-1" key={`${market.id}-${idx}`}>
                                          {pair.map((opt, pairIdx) => (
                                              opt ? (
                                                  <button
                                                      key={`${opt.id}-${pairIdx}`}
                                                      onClick={() => onSelectBet(market, opt)}
                                                      className={`market-odds-btn w-full rounded-md border px-2.5 py-1.5 text-left transition-all ${
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
                                {searchQuery.trim()
                                  ? searchCacheMarketCount === 0
                                    ? 'Open a few sport tabs first so games load into search—search uses no extra API calls.'
                                    : 'No match in loaded games. Try another word or open another sport tab to add more lines.'
                                  : leagueFilter !== 'ALL'
                                    ? `No ${leagueFilter} games at the moment. Try another league or sport.`
                                    : sportFilter === 'ALL'
                                      ? 'No upcoming games in this window. Try again later.'
                                      : `No ${sportFilter} games at the moment. Try another sport.`}
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
      <div className={`app-shell h-screen max-h-screen min-h-0 overflow-hidden text-slate-100 flex flex-col lg:flex-row ${isLightMode ? 'bg-gradient-to-br from-slate-100 via-sky-50 to-slate-200 text-slate-900' : 'bg-gradient-to-br from-slate-800 via-[#0f172a] to-slate-950'}`}>
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
            <Home className="text-white" size={24} />
          </NavLink>
          <div className="flex lg:flex-col gap-4">
            <NavLink to="/bet" title="Live betting" className={({ isActive }) => `p-3 rounded-xl transition-all ${isActive ? 'bg-blue-600/10 text-blue-400' : 'text-slate-500 hover:bg-slate-800'}`}>
              <Ticket size={24} />
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
            <NavLink to="/head-to-head" title="Head-to-Head" className={({ isActive }) => `p-3 rounded-xl transition-all ${isActive ? 'bg-red-500/10 text-red-400' : 'text-slate-500 hover:bg-slate-800'}`}>
              <Swords size={24} />
            </NavLink>
            <NavLink to="/store" title="Store" className={({ isActive }) => `p-3 rounded-xl transition-all ${isActive ? 'bg-violet-500/10 text-violet-400' : 'text-slate-500 hover:bg-slate-800'}`}>
              <ShoppingBag size={24} />
            </NavLink>
          </div>
          <div className="flex flex-col items-center gap-2 ml-auto shrink-0 lg:ml-0 lg:mt-auto">
            <NavLink
                to="/profile"
                className={({ isActive }) => `w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600 hover:border-slate-500 hover:bg-slate-600 transition-all cursor-pointer ${isActive ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900' : ''}`}
                title="Profile"
            >
              <span className="text-xs font-bold">{userInitials}</span>
            </NavLink>
            <button type="button" onClick={onLogout} className="text-xs text-slate-500 hover:text-slate-400 flex items-center gap-1">
              <LogOut size={12} /> Log out
            </button>
          </div>
        </nav>

        <main
            className={`flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-contain custom-scrollbar ${view === 'HOME' ? 'p-0 flex flex-col' : 'p-4 lg:p-8'}`}
        >
          <div className={`min-h-full ${view === 'HOME' ? 'flex flex-col' : 'mx-auto flex h-full w-full max-w-6xl flex-col'}`}>
            {view !== 'HOME' && (
                <header className="mb-7">
                  <div className="app-header-card rounded-xl border border-slate-800/90 bg-slate-900/35 px-4 py-4 lg:px-5">
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
            <div className="mt-auto pt-10 lg:pt-14">
              <SiteFooter />
            </div>
          </div>
        </main>

        {view === 'MARKETS' && (
            <BetSlip
                selection={betSelection}
                parlaySelections={parlaySelections}
                activeBets={props.activeBets}
                onClear={onClearBet}
                onPlaceBet={handlePlaceBetWithBoost}
                onSelectBet={onSelectBet}
                balance={balance}
                activeBoost={activeBoost}
            />
        )}
      </div>
  );
};
