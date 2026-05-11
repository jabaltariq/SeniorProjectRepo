import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, NavLink } from 'react-router-dom';
import {
  Trophy,
  Wallet as WalletIcon,
  Home,
  BarChart3,
  Receipt,
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
import { SocialMessagingView } from '../components/SocialMessagingView';
import { HomeLanding } from '../components/HomeLanding';
import { SettingsView } from './SettingsView';
import { BetOfTheDayCard } from '../components/Betofthedaycard';
import { BoostsCard } from '../components/Boostcard';
import { SiteFooter } from '../components/SiteFooter';
import { ProfileView } from './ProfileView';
import { HeadToHeadView } from './HeadToHeadView';
import { StoreView } from './StoreView';
import { CounterOpponentModal } from '../components/CounterOpponentModal';
import { profileBackgroundForUid } from '@/models/profileBackgrounds';
import { Swords, ShoppingBag } from 'lucide-react';
import type { LeaderboardEntry, Friend, SocialActivity } from '../models';
import { BoostType } from '@/services/dbOps.ts';
import { DAILY_BONUS_AMOUNT, VIEW_ALL_GAMES_VISIBLE_THRESHOLD } from '../models/constants';
import {
  FriendRequest,
  ensureGlobalMockNflBoardSeeded,
  getBets,
  getUserMoney,
  listenForChange,
  makeDmThreadId,
  saveGlobalMockNflGames,
  sendDirectMessage,
  settleAllUsersForMockNflGame,
  subscribeToGlobalMockNflGames,
} from "@/services/dbOps.ts";
import type { MockNflGameState } from '@/models';
import {betList, friendsList} from "@/services/authService.ts";
import type { UserThemeMode } from '@/services/dbOps';
import { buildMockNflMarketFromGameState } from '@/lib/mockNflMarketFromState';
import { reconcileMockGameChallengesAfterGlobalMockFinal } from '@/services/gameChallenges';
import { computeParlayRollup } from '@/services/parlayRollup';
import { formatAmericanOddsLine } from '@/lib/oddsAmericanFormat';
import { createRandomMockNflGameState } from '@/lib/globalMockNflBoard';
import {
  WinCelebrationModal,
  type WinCelebrationPayload,
} from '../components/WinCelebrationModal';
import { collection, onSnapshot, query, where, type QuerySnapshot } from 'firebase/firestore';
import { db } from '@/models/constants.ts';

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
  /** Inline error from strict-parlay rules (max legs / both-sides). Surfaced
   *  by the BetSlip; auto-clears in the viewModel. */
  parlayRuleError: string | null;
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
  onPlaceBet: (
    stake: number,
    betType?: 'single' | 'parlay',
    boost?: BoostType | null,
    onBoostUsed?: () => void,
    singleTarget?: { market: Market; option: MarketOption } | null,
  ) => void;
  onClearBet: () => void;
  onSelectBet: (market: Market, option: MarketOption) => void;
  onFocusQueuedSelection: (market: Market, option: MarketOption) => void;
  onDailyBonus: () => void;
  onLogout: () => void;
  onSetView: (view: string) => void;
  onSportFilter: (sport: string) => void;
  onSelectLeagueInSport: (sport: string, league: string) => void;
  onLeagueFilter: (league: string) => void;
  onSearchChange: (query: string) => void;
  onRetryMarkets: () => void;
  themeMode: UserThemeMode;
  themeSaving: boolean;
  onThemeModeChange: (mode: UserThemeMode) => void;
}

const H2H_COL = 'headToHead';
const GC_COL = 'gameChallenges';

type QueuedCelebration = { key: string; payload: WinCelebrationPayload };

function readStringSetFromLs(storageKey: string): Set<string> {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function writeStringSetToLs(storageKey: string, ids: Set<string>) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(storageKey, JSON.stringify(Array.from(ids)));
}

function userWonH2h(
  data: { status?: unknown; originalUserId?: unknown; challengerUserId?: unknown },
  uid: string,
): boolean {
  const status = String(data.status ?? '');
  const orig = String(data.originalUserId ?? '');
  const chall = String(data.challengerUserId ?? '');
  return (status === 'WON_BY_ORIGINAL' && uid === orig) || (status === 'WON_BY_CHALLENGER' && uid === chall);
}

function h2hDocToWinPayload(data: Record<string, unknown>, uid: string): WinCelebrationPayload {
  const orig = String(data.originalUserId ?? '');
  const chall = String(data.challengerUserId ?? '');
  const opponent = uid === orig ? chall : orig;
  return {
    kind: 'h2h_win',
    opponentUid: opponent,
    marketTitle: String(data.marketTitle ?? ''),
    pickLabel: String(data.originalSide ?? ''),
    totalEscrow: (Number(data.originalStake) || 0) + (Number(data.challengerStake) || 0),
    originalBetId: String(data.originalBetId ?? ''),
  };
}

function userWonGc(
  data: { status?: unknown; challengerUid?: unknown; opponentUid?: unknown },
  uid: string,
): boolean {
  const status = String(data.status ?? '');
  const chall = String(data.challengerUid ?? '');
  const opp = String(data.opponentUid ?? '');
  return (status === 'COMPLETED_CHALLENGER' && uid === chall) || (status === 'COMPLETED_OPPONENT' && uid === opp);
}

function gcDocToWinPayload(data: Record<string, unknown>, uid: string): WinCelebrationPayload {
  const chall = String(data.challengerUid ?? '');
  const opp = String(data.opponentUid ?? '');
  if (String(data.status ?? '') === 'COMPLETED_CHALLENGER' && uid === chall) {
    return {
      kind: 'gc_win',
      opponentUid: opp,
      marketTitle: String(data.marketTitle ?? ''),
      yourPick: String(data.challengerPickLabel ?? ''),
    };
  }
  return {
    kind: 'gc_win',
    opponentUid: chall,
    marketTitle: String(data.marketTitle ?? ''),
    yourPick: String(data.opponentPickLabel ?? ''),
  };
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
    parlayRuleError,
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
    onFocusQueuedSelection,
    onDailyBonus,
    onLogout,
    onSetView,
    onSportFilter,
    onSelectLeagueInSport,
    onLeagueFilter,
    onSearchChange,
    onRetryMarkets,
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
  const mockNflChallengeMarkets = useMemo(
    () => mockNflGames.map((g) => buildMockNflMarketFromGameState(g)),
    [mockNflGames],
  );
  const [isBetSlipCollapsed, setIsBetSlipCollapsed] = useState(false);
  const [celebrationQueue, setCelebrationQueue] = useState<QueuedCelebration[]>([]);
  const [activeCelebration, setActiveCelebration] = useState<QueuedCelebration | null>(null);
  const [challengeFriendTarget, setChallengeFriendTarget] = useState<Friend | null>(null);
  const seenWinningBetIds = useRef<Set<string>>(new Set());
  const hasInitializedWinTracking = useRef(false);
  const seenH2hWinCelebrationIds = useRef<Set<string>>(new Set());
  const h2hBootstrapDone = useRef(false);
  const lastH2hOrigSnap = useRef<QuerySnapshot | null>(null);
  const lastH2hChallSnap = useRef<QuerySnapshot | null>(null);
  const seenGcWinCelebrationIds = useRef<Set<string>>(new Set());
  const gcBootstrapDone = useRef(false);
  const lastGcChallSnap = useRef<QuerySnapshot | null>(null);
  const lastGcOppSnap = useRef<QuerySnapshot | null>(null);

  const userUid = typeof localStorage !== 'undefined' ? localStorage.getItem('uid') ?? '' : '';
  const seenWinningBetsStorageKey = userUid ? `bethub_seen_winning_bets:${userUid}` : '';
  const seenH2hWinCelebrationStorageKey = userUid ? `bethub_seen_h2h_win_celebration:${userUid}` : '';
  const seenGcWinCelebrationStorageKey = userUid ? `bethub_seen_gc_win_celebration:${userUid}` : '';

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = isLightMode ? 'light' : 'ocean';
  }, [isLightMode]);

  const normalizeSpreadLine = (line: number) => (line > 0 ? `+${line.toFixed(1)}` : line.toFixed(1));
  const randomBetween = (min: number, max: number) => Math.random() * (max - min) + min;

  useEffect(() => {
    const unsub = subscribeToGlobalMockNflGames(
      (games) => setMockNflGames(games),
      (err) => console.error('Global mock NFL subscription failed', err),
    );
    void ensureGlobalMockNflBoardSeeded().catch((e) => console.error('ensureGlobalMockNflBoardSeeded', e));
    return () => unsub();
  }, []);

  const simulateMockGame = async (gameId: string, mode: 'RANDOM' | 'AWAY' | 'HOME') => {
    let finalizedGame: MockNflGameState | null = null;
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
      finalizedGame = finalized;
      return finalized;
    });
    setMockNflGames(next);
    await saveGlobalMockNflGames(next);
    if (finalizedGame) {
      await settleAllUsersForMockNflGame(finalizedGame);
      await reconcileMockGameChallengesAfterGlobalMockFinal(finalizedGame);
    }
  };

  const createNewMockGame = async (gameId: string) => {
    const next = mockNflGames.map((g) => {
      if (g.id !== gameId) return g;
      return createRandomMockNflGameState('mock-nfl', g);
    });
    setMockNflGames(next);
    await saveGlobalMockNflGames(next);
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
    const staleSelectionKeys = new Set(
      staleSelections.map((sel) => `${sel.market.id}:${sel.option.id}`),
    );
    for (const stale of staleSelections) {
      onSelectBet(stale.market, stale.option);
    }

    if (betSelection && finalizedMockMarketIds.has(betSelection.market.id)) {
      const selectedKey = `${betSelection.market.id}:${betSelection.option.id}`;
      // If this selection was already removed via staleSelections above, do not
      // toggle it a second time (second toggle would re-add it).
      if (!staleSelectionKeys.has(selectedKey)) {
        onSelectBet(betSelection.market, betSelection.option);
      }
    }
  }, [mockNflGames, parlaySelections, betSelection, onSelectBet]);

  // ── Boost state — lives here so BetSlip and BoostsCard share it ─
  const [activeBoost, setActiveBoost] = useState<BoostType | null>(null);

  // ── History page filters ───────────────────────────────────────
  // State lives at the component top (not inside the HISTORY case) because
  // hooks can't be called conditionally. Keeps filter selections sticky as
  // the user toggles between views, which matches typical sportsbook UX.
  type HistorySort = 'recent' | 'oldest' | 'stake_desc' | 'payout_desc';
  const [historySort, setHistorySort] = useState<HistorySort>('recent');
  const [historyStatusSet, setHistoryStatusSet] = useState<Set<string>>(() => new Set());
  const [historyYear, setHistoryYear] = useState<number | 'all'>('all');
  const [historyMinStake, setHistoryMinStake] = useState<number>(0);
  const [historyMaxStake, setHistoryMaxStake] = useState<number | null>(null);

  // Distinct years the user has bet in. Always derived from the realtime
  // activeBets list so newly-placed bets in fresh years show up automatically.
  const historyYears = useMemo(() => {
    const years = new Set<number>();
    props.activeBets.forEach((b) => years.add(b.placedAt.getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [props.activeBets]);

  // Slider upper bound — defaults to $1000, but if a user has bets larger
  // than that we bump the bound up to the nearest $100 so they can still
  // filter their high rollers. Step on the slider itself is 1 so every
  // dollar between 0 and the bound is selectable.
  const historyMaxStakeBound = useMemo(() => {
    const observed = props.activeBets.reduce((acc, b) => Math.max(acc, b.stake), 0);
    return Math.max(1000, Math.ceil(observed / 100) * 100);
  }, [props.activeBets]);

  const filteredHistoryBets = useMemo(() => {
    const list = props.activeBets.filter((b) => {
      if (historyStatusSet.size > 0) {
        const s = (b.status ?? 'PENDING').toLowerCase();
        if (!historyStatusSet.has(s)) return false;
      }
      if (historyYear !== 'all' && b.placedAt.getFullYear() !== historyYear) return false;
      if (b.stake < historyMinStake) return false;
      if (historyMaxStake !== null && b.stake > historyMaxStake) return false;
      return true;
    });
    switch (historySort) {
      case 'oldest':      return list.sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime());
      case 'stake_desc':  return list.sort((a, b) => b.stake - a.stake);
      case 'payout_desc': return list.sort((a, b) => b.potentialPayout - a.potentialPayout);
      case 'recent':
      default:            return list.sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime());
    }
  }, [props.activeBets, historyStatusSet, historyYear, historyMinStake, historyMaxStake, historySort]);

  const toggleHistoryStatus = (status: string) =>
    setHistoryStatusSet((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });

  const resetHistoryFilters = () => {
    setHistorySort('recent');
    setHistoryStatusSet(new Set());
    setHistoryYear('all');
    setHistoryMinStake(0);
    setHistoryMaxStake(null);
  };

  const hasActiveHistoryFilters =
    historyStatusSet.size > 0 ||
    historyYear !== 'all' ||
    historyMinStake > 0 ||
    historyMaxStake !== null ||
    historySort !== 'recent';

  const handlePlaceBetWithBoost = (
    stake: number,
    betType?: 'single' | 'parlay',
    singleTarget?: { market: Market; option: MarketOption } | null,
  ) => {
    console.log('handlePlaceBetWithBoost called, activeBoost:', activeBoost);
    onPlaceBet(stake, betType, activeBoost, () => setActiveBoost(null), singleTarget);
  };

  useEffect(() => {
    if (betSelection || parlaySelections.length > 0) {
      setIsBetSlipCollapsed(false);
    }
  }, [betSelection, parlaySelections.length]);

  useEffect(() => {
    seenWinningBetIds.current = new Set();
    hasInitializedWinTracking.current = false;
    seenH2hWinCelebrationIds.current = seenH2hWinCelebrationStorageKey
      ? readStringSetFromLs(seenH2hWinCelebrationStorageKey)
      : new Set();
    seenGcWinCelebrationIds.current = seenGcWinCelebrationStorageKey
      ? readStringSetFromLs(seenGcWinCelebrationStorageKey)
      : new Set();
    h2hBootstrapDone.current = false;
    gcBootstrapDone.current = false;
    lastH2hOrigSnap.current = null;
    lastH2hChallSnap.current = null;
    lastGcChallSnap.current = null;
    lastGcOppSnap.current = null;
    setCelebrationQueue([]);
    setActiveCelebration(null);
  }, [userUid, seenH2hWinCelebrationStorageKey, seenGcWinCelebrationStorageKey]);

  useEffect(() => {
    if (!userUid) return;
    if (props.activeBets.length === 0 && !hasInitializedWinTracking.current) return;

    const readStoredSeenIds = () => {
      if (typeof localStorage === 'undefined' || !seenWinningBetsStorageKey) return new Set<string>();
      try {
        const raw = localStorage.getItem(seenWinningBetsStorageKey);
        const parsed = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
      } catch {
        return new Set<string>();
      }
    };

    const writeStoredSeenIds = (ids: Set<string>) => {
      if (typeof localStorage === 'undefined' || !seenWinningBetsStorageKey) return;
      localStorage.setItem(seenWinningBetsStorageKey, JSON.stringify(Array.from(ids)));
    };

    const winningBets = props.activeBets.filter((bet) => (bet.status ?? 'PENDING') === 'WON');
    if (!hasInitializedWinTracking.current) {
      const storedSeen = readStoredSeenIds();
      winningBets.forEach((bet) => storedSeen.add(bet.id));
      seenWinningBetIds.current = storedSeen;
      writeStoredSeenIds(storedSeen);
      hasInitializedWinTracking.current = true;
      return;
    }

    const unseen = winningBets.filter((bet) => !seenWinningBetIds.current.has(bet.id));
    if (unseen.length === 0) return;

    unseen.forEach((bet) => seenWinningBetIds.current.add(bet.id));
    writeStoredSeenIds(seenWinningBetIds.current);
    setCelebrationQueue((prev) => {
      const keys = new Set(prev.map((q) => q.key));
      const additions: QueuedCelebration[] = unseen
        .filter((bet) => !keys.has(`bet:${bet.id}`))
        .map((bet) => ({ key: `bet:${bet.id}`, payload: { kind: 'bet', bet } as const }));
      return [...prev, ...additions];
    });
  }, [props.activeBets, seenWinningBetsStorageKey, userUid]);

  useEffect(() => {
    if (activeCelebration || celebrationQueue.length === 0) return;
    const [next, ...rest] = celebrationQueue;
    setActiveCelebration(next);
    setCelebrationQueue(rest);
  }, [activeCelebration, celebrationQueue]);

  useEffect(() => {
    if (!userUid || !seenH2hWinCelebrationStorageKey) return;

    const persistH2hSeen = () => writeStringSetToLs(seenH2hWinCelebrationStorageKey, seenH2hWinCelebrationIds.current);

    const tryBootstrapH2h = () => {
      if (h2hBootstrapDone.current) return;
      if (!lastH2hOrigSnap.current || !lastH2hChallSnap.current) return;
      h2hBootstrapDone.current = true;
      const merged = new Map([...lastH2hOrigSnap.current.docs, ...lastH2hChallSnap.current.docs].map((d) => [d.id, d]));
      merged.forEach((d) => {
        const data = d.data() as Record<string, unknown>;
        if (userWonH2h(data, userUid)) seenH2hWinCelebrationIds.current.add(`h2h_win:${d.id}`);
      });
      persistH2hSeen();
    };

    const qOrig = query(collection(db, H2H_COL), where('originalUserId', '==', userUid));
    const qChall = query(collection(db, H2H_COL), where('challengerUserId', '==', userUid));

    const unsubOrig = onSnapshot(qOrig, (snap) => {
      lastH2hOrigSnap.current = snap;
      tryBootstrapH2h();
      if (!h2hBootstrapDone.current) return;
      snap.docChanges().forEach((ch) => {
        if (ch.type === 'removed') return;
        const data = ch.doc.data() as Record<string, unknown>;
        if (!userWonH2h(data, userUid)) return;
        const dedupe = `h2h_win:${ch.doc.id}`;
        if (seenH2hWinCelebrationIds.current.has(dedupe)) return;
        seenH2hWinCelebrationIds.current.add(dedupe);
        persistH2hSeen();
        const payload = h2hDocToWinPayload(data, userUid);
        setCelebrationQueue((prev) =>
          prev.some((q) => q.key === dedupe) ? prev : [...prev, { key: dedupe, payload }],
        );
      });
    });

    const unsubChall = onSnapshot(qChall, (snap) => {
      lastH2hChallSnap.current = snap;
      tryBootstrapH2h();
      if (!h2hBootstrapDone.current) return;
      snap.docChanges().forEach((ch) => {
        if (ch.type === 'removed') return;
        const data = ch.doc.data() as Record<string, unknown>;
        if (!userWonH2h(data, userUid)) return;
        const dedupe = `h2h_win:${ch.doc.id}`;
        if (seenH2hWinCelebrationIds.current.has(dedupe)) return;
        seenH2hWinCelebrationIds.current.add(dedupe);
        persistH2hSeen();
        const payload = h2hDocToWinPayload(data, userUid);
        setCelebrationQueue((prev) =>
          prev.some((q) => q.key === dedupe) ? prev : [...prev, { key: dedupe, payload }],
        );
      });
    });

    return () => {
      unsubOrig();
      unsubChall();
    };
  }, [userUid, seenH2hWinCelebrationStorageKey]);

  useEffect(() => {
    if (!userUid || !seenGcWinCelebrationStorageKey) return;

    const persistGcSeen = () => writeStringSetToLs(seenGcWinCelebrationStorageKey, seenGcWinCelebrationIds.current);

    const tryBootstrapGc = () => {
      if (gcBootstrapDone.current) return;
      if (!lastGcChallSnap.current || !lastGcOppSnap.current) return;
      gcBootstrapDone.current = true;
      const merged = new Map([...lastGcChallSnap.current.docs, ...lastGcOppSnap.current.docs].map((d) => [d.id, d]));
      merged.forEach((d) => {
        const data = d.data() as Record<string, unknown>;
        if (userWonGc(data, userUid)) seenGcWinCelebrationIds.current.add(`gc_win:${d.id}`);
      });
      persistGcSeen();
    };

    const qChall = query(collection(db, GC_COL), where('challengerUid', '==', userUid));
    const qOpp = query(collection(db, GC_COL), where('opponentUid', '==', userUid));

    const unsubChall = onSnapshot(qChall, (snap) => {
      lastGcChallSnap.current = snap;
      tryBootstrapGc();
      if (!gcBootstrapDone.current) return;
      snap.docChanges().forEach((ch) => {
        if (ch.type === 'removed') return;
        const data = ch.doc.data() as Record<string, unknown>;
        if (!userWonGc(data, userUid)) return;
        const dedupe = `gc_win:${ch.doc.id}`;
        if (seenGcWinCelebrationIds.current.has(dedupe)) return;
        seenGcWinCelebrationIds.current.add(dedupe);
        persistGcSeen();
        const payload = gcDocToWinPayload(data, userUid);
        setCelebrationQueue((prev) =>
          prev.some((q) => q.key === dedupe) ? prev : [...prev, { key: dedupe, payload }],
        );
      });
    });

    const unsubOpp = onSnapshot(qOpp, (snap) => {
      lastGcOppSnap.current = snap;
      tryBootstrapGc();
      if (!gcBootstrapDone.current) return;
      snap.docChanges().forEach((ch) => {
        if (ch.type === 'removed') return;
        const data = ch.doc.data() as Record<string, unknown>;
        if (!userWonGc(data, userUid)) return;
        const dedupe = `gc_win:${ch.doc.id}`;
        if (seenGcWinCelebrationIds.current.has(dedupe)) return;
        seenGcWinCelebrationIds.current.add(dedupe);
        persistGcSeen();
        const payload = gcDocToWinPayload(data, userUid);
        setCelebrationQueue((prev) =>
          prev.some((q) => q.key === dedupe) ? prev : [...prev, { key: dedupe, payload }],
        );
      });
    });

    return () => {
      unsubChall();
      unsubOpp();
    };
  }, [userUid, seenGcWinCelebrationStorageKey]);

  const handleCloseCelebration = async (opts?: { banter?: string }) => {
    const cur = activeCelebration;
    setActiveCelebration(null);
    const banter = opts?.banter?.trim();
    if (!cur || !banter || !userUid) return;
    if (cur.payload.kind !== 'h2h_win' && cur.payload.kind !== 'gc_win') return;
    const threadId = makeDmThreadId(userUid, cur.payload.opponentUid);
    await sendDirectMessage({
      threadId,
      messageId: `celebration_banter_${Date.now()}`,
      fromUserId: userUid,
      toUserId: cur.payload.opponentUid,
      text: banter,
      createdAtMs: Date.now(),
    });
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
    const rows = Array.from(seen.values()).sort((a, b) => a.league.localeCompare(b.league));
    const hasNflRow = rows.some((r) => r.sport === 'Football' && r.league.toLowerCase() === 'nfl');
    if (sportFilter === 'Football' && !hasNflRow) {
      rows.unshift({ sport: 'Football', league: 'NFL' });
    }
    return rows;
  })();
  const footballApiLeagues = leagueNavRows.filter((r) => r.sport === 'Football' && r.league.toLowerCase() !== 'nfl');

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
                onLogout={onLogout}
                isLightMode={isLightMode}
              />
            </div>
        );
      case 'LEADERBOARD':
        return <Leaderboard entries={leaderboardEntries} />;
      case 'SOCIAL':
        return (
          <SocialMessagingView
            friends={friends}
            activities={activity}
            onChallenge={(f) => setChallengeFriendTarget(f)}
            bets={betList}
            userPrivacy={userPrivacy}
            friendRequests={friendReqs}
            userName={userName}
          />
        );
        
      case 'PROFILE':
        return (
          <ProfileView
            userInitials={userInitials}
            userEmail={userEmail}
            balance={balance}
            activeBetsCount={props.activeBets.length}
            currentUserId={typeof localStorage !== 'undefined' ? localStorage.getItem('uid') : null}
            currentUserDisplayName={userName}
            markets={markets}
            nflMockChallengeMarkets={mockNflChallengeMarkets}
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
      case 'HISTORY': {
        // Filter pill renderer reused for the status row. Local to this case
        // so it can close over toggleHistoryStatus / historyStatusSet without
        // becoming yet another top-level helper.
        const StatusChip: React.FC<{ value: string; label: string; tone: string }> = ({ value, label, tone }) => {
          const isActive = historyStatusSet.has(value);
          return (
            <button
              type="button"
              onClick={() => toggleHistoryStatus(value)}
              className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border transition-colors ${
                isActive ? tone : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
              }`}
            >
              {label}
            </button>
          );
        };
        const totalBets = props.activeBets.length;
        const visibleBets = filteredHistoryBets.length;
        return (
            <div className="animate-in fade-in duration-500">
              <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Receipt className="text-blue-400" size={24} /> Betting History
                </h2>
                <p className="text-xs text-slate-400">
                  Showing <span className="font-bold text-slate-200">{visibleBets}</span>
                  {hasActiveHistoryFilters && totalBets > 0 ? ` of ${totalBets}` : ''} bets
                </p>
              </div>

              {/* Filter bar. Stake sliders mean "only show bets in this stake range." */}
              {totalBets > 0 ? (
                <div className="glass-card rounded-2xl border-slate-800 p-3 mb-6">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    {/* Status chips */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusChip value="won"       label="Won"       tone="bg-green-500/15 text-green-300 border-green-500/40" />
                      <StatusChip value="lost"      label="Lost"      tone="bg-red-500/15 text-red-300 border-red-500/40" />
                      <StatusChip value="push"      label="Push"      tone="bg-amber-500/15 text-amber-300 border-amber-500/40" />
                      <StatusChip value="void"      label="Void"      tone="bg-slate-500/20 text-slate-200 border-slate-500/40" />
                      <StatusChip value="cancelled" label="Cancelled" tone="bg-slate-500/20 text-slate-200 border-slate-500/40" />
                      <StatusChip value="pending"   label="Pending"   tone="bg-blue-500/15 text-blue-300 border-blue-500/40" />
                    </div>

                    <div className="hidden lg:block h-7 w-px bg-slate-700/70" aria-hidden />

                    {/* Sort dropdown — placeholder text is the current value so we
                        don't need a separate label above it. */}
                    <select
                      aria-label="Sort bets"
                      value={historySort}
                      onChange={(e) => setHistorySort(e.target.value as HistorySort)}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-200 outline-none focus:border-violet-500"
                    >
                      <option value="recent">Recent first</option>
                      <option value="oldest">Oldest first</option>
                      <option value="stake_desc">Largest stake</option>
                      <option value="payout_desc">Largest payout</option>
                    </select>

                    {/* Year dropdown */}
                    <select
                      aria-label="Filter by year"
                      value={historyYear === 'all' ? 'all' : String(historyYear)}
                      onChange={(e) => setHistoryYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-200 outline-none focus:border-violet-500"
                    >
                      <option value="all">All years</option>
                      {historyYears.map((y) => (
                        <option key={y} value={String(y)}>{y}</option>
                      ))}
                    </select>

                    <div className="hidden lg:block h-7 w-px bg-slate-700/70" aria-hidden />

                    <div className="rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Stake Amount
                        </span>
                        <span className="text-[11px] text-slate-200 font-semibold tabular-nums whitespace-nowrap">
                          ${historyMinStake.toLocaleString()} to ${(historyMaxStake ?? historyMaxStakeBound).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Min</span>
                          <input
                            type="range"
                            min={0}
                            max={historyMaxStakeBound}
                            step={1}
                            value={historyMinStake}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setHistoryMinStake(v);
                              if (historyMaxStake !== null && v > historyMaxStake) setHistoryMaxStake(v);
                            }}
                            className="w-28 accent-violet-500"
                            aria-label="Minimum stake to show"
                          />
                        </label>
                        <label className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Max</span>
                          <input
                            type="range"
                            min={0}
                            max={historyMaxStakeBound}
                            step={1}
                            value={historyMaxStake ?? historyMaxStakeBound}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setHistoryMaxStake(v >= historyMaxStakeBound ? null : v);
                              if (v < historyMinStake) setHistoryMinStake(v);
                            }}
                            className="w-28 accent-violet-500"
                            aria-label="Maximum stake to show"
                          />
                        </label>
                      </div>
                    </div>

                    {hasActiveHistoryFilters && (
                      <button
                        type="button"
                        onClick={resetHistoryFilters}
                        className="ml-auto rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="space-y-4">
                {totalBets > 0 && filteredHistoryBets.length === 0 ? (
                    <div className="py-12 text-center glass-card rounded-2xl border-dashed border-slate-700">
                      <p className="text-sm text-slate-400">No bets match your filters.</p>
                      <button
                        onClick={resetHistoryFilters}
                        className="mt-3 text-blue-400 hover:text-blue-300 font-semibold text-xs"
                      >
                        Clear filters
                      </button>
                    </div>
                ) : filteredHistoryBets.length > 0 ? (
                    filteredHistoryBets.map(bet => {
                      const s = (bet.status ?? 'PENDING').toLowerCase();
                      // Compute the actual amount returned to the wallet so reduced
                      // parlays don't overstate. Singles always pay potentialPayout
                      // when WON; parlays may have pushed legs and pay less.
                      const effectivePayout = (() => {
                        if (s === 'won' && bet.betType === 'parlay' && bet.parlayLegs?.length) {
                          const r = computeParlayRollup(bet.parlayLegs, bet.stake);
                          if (r.state === 'WON') return r.payout;
                        }
                        return bet.potentialPayout;
                      })();
                      // Red/green/amber widget styling, applied to the entire row
                      // (left border + tinted gradient) so settled outcomes are
                      // scannable at a glance, not just via the small status pill.
                      const rowAccent =
                        s === 'won'                            ? 'border-l-4 border-l-emerald-500' :
                        s === 'lost'                           ? 'border-l-4 border-l-red-500' :
                        s === 'push'                           ? 'border-l-4 border-l-amber-500' :
                        (s === 'void' || s === 'cancelled')    ? 'border-l-4 border-l-slate-500' :
                                                                 '';
                      const pillTone =
                        s === 'won'                            ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        s === 'lost'                           ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        s === 'push'                           ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                        (s === 'void' || s === 'cancelled')    ? 'bg-slate-500/10 text-slate-300 border-slate-500/20' :
                                                                 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                      const pillLabel =
                        s === 'won'       ? 'Won' :
                        s === 'lost'      ? 'Lost' :
                        s === 'push'      ? 'Push' :
                        s === 'void'      ? 'Void' :
                        s === 'cancelled' ? 'Cancelled' :
                                            'Pending';
                      // Right-side payout block changes meaning by status. Free bet
                      // claims and stake-refund cases are surfaced here too.
                      const payoutBlock =
                        s === 'won'                          ? { label: 'Payout',           value: `$${effectivePayout.toLocaleString()}`,   color: 'text-emerald-400' } :
                        s === 'lost'                         ? { label: 'Lost',             value: `-$${bet.stake.toLocaleString()}`,        color: 'text-red-400' } :
                        s === 'push'                         ? { label: 'Refund',           value: `$${bet.stake.toLocaleString()}`,         color: 'text-amber-300' } :
                        (s === 'void' || s === 'cancelled')  ? { label: 'Refund',           value: `$${bet.stake.toLocaleString()}`,         color: 'text-slate-300' } :
                                                               { label: 'Potential Payout', value: `$${bet.potentialPayout.toLocaleString()}`, color: 'text-blue-400' };
                      return (
                        <div key={bet.id} className={`glass-card rounded-2xl p-6 border-slate-800 hover:border-slate-700 transition-all ${rowAccent}`}>
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <p className="text-xs font-bold text-slate-500 uppercase mb-1">{bet.marketTitle}</p>
                              <h4 className="text-lg font-bold">Selected: {bet.optionLabel}</h4>
                              <p className="text-xs text-slate-500 mt-1">{bet.placedAt.toLocaleString()}</p>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${pillTone}`}>
                              {pillLabel}
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
                              <p className="text-[10px] font-bold text-slate-500 uppercase">{payoutBlock.label}</p>
                              <p className={`text-xl font-black ${payoutBlock.color}`}>{payoutBlock.value}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })
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
      }
      case 'MARKETS':
      default:
        const showMockNflBoard = sportFilter === 'Football' && leagueFilter.toLowerCase() === 'nfl';
        const showApiMarketsTable = !(sportFilter === 'Football' && leagueFilter.toLowerCase() === 'nfl');
        const showLoadingState = loading && !showMockNflBoard;
        const showErrorState = Boolean(error) && !showMockNflBoard;
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
                            onClick={() => {
                              if (tab === 'Football') {
                                onSelectLeagueInSport('Football', 'NFL');
                                return;
                              }
                              onSportFilter(tab);
                            }}
                            title={tab}
                            className={`market-top-pill rounded-lg border p-2 flex items-center justify-center text-[10px] font-black transition-all ${
                                sportPrimarySelected
                                    ? 'border-[#3FA9F5] bg-[#3FA9F5]/15 text-[#7dd3fc]'
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
                                ? 'border-[#3FA9F5] bg-[#3FA9F5]/15 text-[#7dd3fc]'
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
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-10 pr-3 outline-none focus:border-[#3FA9F5] transition-all text-sm disabled:opacity-60 disabled:cursor-not-allowed"
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
                                      onClick={() => {
                                        if (tab === 'Football') {
                                          onSelectLeagueInSport('Football', 'NFL');
                                          return;
                                        }
                                        onSportFilter(tab);
                                      }}
                                      className={`shrink-0 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition-all ${
                                          sportFilter === tab
                                              ? 'border-[#3FA9F5]/80 bg-[#3FA9F5]/15 text-[#7dd3fc]'
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
                            className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-300 hover:text-[#7dd3fc] transition-colors"
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
                  ) : showLoadingState ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="text-blue-400 animate-spin" size={48} />
                        <p className="text-slate-400">Loading live odds...</p>
                      </div>
                  ) : showErrorState ? (
                      <div className="glass-card rounded-2xl p-8 text-center border-red-500/20">
                        <AlertCircle className="mx-auto text-red-400 mb-4" size={48} />
                        <h3 className="text-xl font-bold text-slate-200 mb-2">Couldn&apos;t load odds</h3>
                        <p className="text-slate-400 mb-4">{error}</p>
                        <p className="text-xs text-slate-500 mb-4">Set ODDS_API_KEY in .env.local and restart the dev server.</p>
                        <button
                            onClick={onRetryMarkets}
                            disabled={!hasSelectedSport}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#3FA9F5] hover:bg-[#2e9ae8] text-slate-950 rounded-xl font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
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
                                <span className="text-xs text-slate-300">Simulated NFL games.</span>
                              </div>
                            </div>
                            {footballApiLeagues.length > 0 && (
                              <div className="mb-3 rounded-md border border-slate-700/80 bg-slate-900/70 px-2.5 py-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">NCAA Football (API)</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {footballApiLeagues.slice(0, 4).map((row) => (
                                    <button
                                      key={`ncaa-widget-${row.league}`}
                                      type="button"
                                      onClick={() => onSelectLeagueInSport('Football', row.league)}
                                      className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-200 hover:border-blue-500/70 hover:text-blue-200"
                                    >
                                      {row.league}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="space-y-2">
                              {mockNflGames.map((game) => (
                                <div key={game.id} className="grid grid-cols-[minmax(230px,1.2fr)_repeat(3,minmax(120px,0.62fr))] items-stretch gap-2 rounded-lg border border-amber-400/25 bg-slate-900/70 p-2.5">
                                  {(() => {
                                    const mockMarket = buildMockNflMarketFromGameState(game);
                                    const spreadAway = mockMarket.options[0];
                                    const spreadHome = mockMarket.options[1];
                                    const totalOver = mockMarket.options[2];
                                    const totalUnder = mockMarket.options[3];
                                    const mlAway = mockMarket.options[4];
                                    const mlHome = mockMarket.options[5];
                                    const bettable = game.status !== 'FINAL';
                                    const mockBetOutcome = resolveMockBetOutcome(game);
                                    const latestMockBet = getLatestUserMockBet(game.id);
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
                                      ML {formatAmericanOddsLine(game.awayOdds)} / {formatAmericanOddsLine(game.homeOdds)}
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
                                            {latestMockBet && (
                                              <p className={`mt-1 ${finalTextTone}`}>
                                                Spent: ${latestMockBet.stake.toFixed(2)} • To win: ${latestMockBet.potentialPayout.toFixed(2)}
                                              </p>
                                            )}
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
                                            ? 'border-[#3FA9F5] bg-[#3FA9F5]/15 shadow-[0_0_0_1px_rgba(63,169,245,0.45)]'
                                            : 'border-slate-700/90 bg-slate-900/95 hover:border-[#3FA9F5]/75 hover:bg-[#3FA9F5]/12'
                                        } ${!bettable ? 'cursor-not-allowed opacity-65' : ''}`}
                                      >
                                        <p className="text-[11px] text-slate-300 truncate">{opt.label}</p>
                                        <p className="text-lg leading-none font-semibold text-[#3FA9F5]">{formatAmericanOddsLine(opt.odds)}</p>
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
                                            ? 'border-[#3FA9F5] bg-[#3FA9F5]/15 shadow-[0_0_0_1px_rgba(63,169,245,0.45)]'
                                            : 'border-slate-700/90 bg-slate-900/95 hover:border-[#3FA9F5]/75 hover:bg-[#3FA9F5]/12'
                                        } ${!bettable ? 'cursor-not-allowed opacity-65' : ''}`}
                                      >
                                        <p className="text-[11px] text-slate-300 truncate">{opt.label}</p>
                                        <p className="text-lg leading-none font-semibold text-[#3FA9F5]">{formatAmericanOddsLine(opt.odds)}</p>
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
                                            ? 'border-[#3FA9F5] bg-[#3FA9F5]/15 shadow-[0_0_0_1px_rgba(63,169,245,0.45)]'
                                            : 'border-slate-700/90 bg-slate-900/95 hover:border-[#3FA9F5]/75 hover:bg-[#3FA9F5]/12'
                                        } ${!bettable ? 'cursor-not-allowed opacity-65' : ''}`}
                                      >
                                        <p className="text-[11px] text-slate-300 truncate">{opt.label}</p>
                                        <p className="text-lg leading-none font-semibold text-[#3FA9F5]">{formatAmericanOddsLine(opt.odds)}</p>
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
                        {showApiMarketsTable && (
                          <>
                        <div className="grid grid-cols-[minmax(230px,1.2fr)_repeat(3,minmax(120px,0.62fr))] bg-slate-900/75 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
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
                                      className="grid grid-cols-[minmax(230px,1.2fr)_repeat(3,minmax(120px,0.62fr))] items-stretch px-4 py-2.5 border-t border-slate-800/90 bg-slate-900/25 hover:bg-slate-800/35 transition-colors"
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
                                                              ? 'border-[#3FA9F5] bg-[#3FA9F5]/15 shadow-[0_0_0_1px_rgba(63,169,245,0.45)]'
                                                              : 'border-slate-700/90 bg-slate-900/95 hover:border-[#3FA9F5]/75 hover:bg-[#3FA9F5]/12'
                                                      }`}
                                                  >
                                                    <p className="text-[10px] text-slate-400 truncate">{opt.label}</p>
                                                    <p className={`text-sm font-semibold ${isOptionSelected(market, opt) ? 'text-[#7dd3fc]' : 'text-[#3FA9F5]'}`}>
                                                      {formatAmericanOddsLine(opt.odds)}
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
                          </>
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
              <Receipt size={24} />
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

        {view === 'MARKETS' && !isBetSlipCollapsed && (
            <BetSlip
                selection={betSelection}
                parlaySelections={parlaySelections}
                activeBets={props.activeBets}
                onClear={onClearBet}
                onPlaceBet={handlePlaceBetWithBoost}
                onClose={() => setIsBetSlipCollapsed(true)}
                onSelectBet={onSelectBet}
                onFocusSelection={onFocusQueuedSelection}
                balance={balance}
                activeBoost={activeBoost}
                limitError={null}
                parlayRuleError={parlayRuleError}
                isLightMode={isLightMode}
                onGoToHistory={() => {
                  setIsBetSlipCollapsed(true);
                  navigate('/history');
                }}
            />
        )}
        {view === 'MARKETS' && isBetSlipCollapsed && (
          <button
            type="button"
            onClick={() => setIsBetSlipCollapsed(false)}
            className="fixed top-4 right-4 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#3FA9F5]/50 bg-[#171427] text-[#7dd3fc] shadow-lg transition-colors hover:bg-[#221b3d]"
            title="Open bet slip"
            aria-label="Open bet slip"
          >
            <Ticket size={18} />
          </button>
        )}
        {challengeFriendTarget && (
          <CounterOpponentModal
            isOpen
            onClose={() => setChallengeFriendTarget(null)}
            opponentUserId={challengeFriendTarget.id}
            opponentDisplayName={challengeFriendTarget.name}
            opponentAvatarUrl={challengeFriendTarget.avatarUrl}
            backgroundImageUrl={
              challengeFriendTarget.profileBackgroundUrl
                ?? profileBackgroundForUid(challengeFriendTarget.id, challengeFriendTarget.name)
            }
            currentUserId={typeof localStorage !== 'undefined' ? localStorage.getItem('uid') : null}
            balance={balance}
          />
        )}
        <WinCelebrationModal
          payload={activeCelebration?.payload ?? null}
          open={Boolean(activeCelebration)}
          onClose={handleCloseCelebration}
        />
      </div>
  );
};
