import { useState, useCallback, useRef, useEffect, useReducer, useMemo } from 'react';
import type { Market } from '../models';
import { fetchMarketsForSportTab } from '../services/oddsApiService';
import { SPORT_TABS } from '../models/constants';
import { marketSearchHaystack, queryMatchesHaystack } from '@/lib/marketSearch';

/** Cap deduped events kept for instant search (memory + stale data tradeoff). */
const MAX_MARKET_SEARCH_CACHE = 1200;

/** Within this window, re-selecting the same tab uses cache only (no Odds API call). */
const TAB_CACHE_TTL_MS = 120_000;

function mergeIntoSearchCache(cache: Map<string, Market>, incoming: Market[]) {
  for (const m of incoming) {
    cache.set(m.id, m);
  }
  while (cache.size > MAX_MARKET_SEARCH_CACHE) {
    const first = cache.keys().next().value;
    if (first === undefined) break;
    cache.delete(first);
  }
}

function defaultSportTab(): string {
  return 'ALL';
}

type TabCacheEntry = { markets: Market[]; fetchedAt: number };

/**
 * Odds/markets from The Odds API. Filters: sport tab, league, search.
 * Per-tab response cache (TTL) avoids refetching on tab ping-pong; stale data revalidates in the background.
 * Search merges each successful load into a deduped cache (no extra API for search).
 */
export function useMarketsViewModel() {
  const MOCK_NFL_LEAGUE = 'NFL';
  const initialSport = defaultSportTab();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sportFilter, setSportFilter] = useState<string>(initialSport);
  const [leagueFilter, setLeagueFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const fetchGeneration = useRef(0);
  const didInitialFetch = useRef(false);
  const marketSearchCacheRef = useRef(new Map<string, Market>());
  const tabCacheRef = useRef(new Map<string, TabCacheEntry>());
  const [searchCacheTick, bumpSearchCache] = useReducer((n: number) => n + 1, 0);

  const applyMarketsToState = useCallback((data: Market[]) => {
    setMarkets(data);
    mergeIntoSearchCache(marketSearchCacheRef.current, data);
    bumpSearchCache();
  }, []);

  const loadMarkets = useCallback(
    async (sportTab?: string, opts?: { force?: boolean }) => {
      const tab = sportTab ?? sportFilter;
      if (!tab) return;
      const force = opts?.force === true;
      const gen = ++fetchGeneration.current;

      if (!force) {
        const cached = tabCacheRef.current.get(tab);
        if (cached && Date.now() - cached.fetchedAt < TAB_CACHE_TTL_MS) {
          if (gen !== fetchGeneration.current) return;
          applyMarketsToState(cached.markets);
          setError(null);
          setLoading(false);
          return;
        }
      }

      const staleEntry = !force ? tabCacheRef.current.get(tab) : undefined;
      const silentRevalidate = Boolean(
        staleEntry && Date.now() - staleEntry.fetchedAt >= TAB_CACHE_TTL_MS,
      );

      if (silentRevalidate && staleEntry) {
        applyMarketsToState(staleEntry.markets);
      }
      if (!silentRevalidate) setLoading(true);
      setError(null);

      try {
        const data = await fetchMarketsForSportTab(tab, 'us');
        if (gen !== fetchGeneration.current) return;
        tabCacheRef.current.set(tab, { markets: data, fetchedAt: Date.now() });
        applyMarketsToState(data);
      } catch (e) {
        if (gen !== fetchGeneration.current) return;
        setError(e instanceof Error ? e.message : 'Failed to load odds');
      } finally {
        if (gen === fetchGeneration.current) {
          setLoading(false);
        }
      }
    },
    [sportFilter, applyMarketsToState],
  );

  const handleSportFilter = useCallback(
    (sport: string) => {
      setSportFilter(sport);
      if (sport === 'Football') {
        setLeagueFilter(MOCK_NFL_LEAGUE);
      } else {
        setLeagueFilter('ALL');
      }
      void loadMarkets(sport);
    },
    [loadMarkets],
  );

  /** Sidebar / popular: jump to one sport + league without the sport handler resetting league to ALL. */
  const selectLeagueInSport = useCallback(
    (sport: string, league: string) => {
      if (sport === sportFilter) {
        setLeagueFilter(league);
        return;
      }
      setSportFilter(sport);
      setLeagueFilter(league);
      void loadMarkets(sport);
    },
    [loadMarkets, sportFilter],
  );

  useEffect(() => {
    if (didInitialFetch.current) return;
    didInitialFetch.current = true;
    void loadMarkets(initialSport);
  }, [initialSport, loadMarkets]);

  const searchTrimmed = searchQuery.trim();
  const searchPool = useMemo(() => {
    if (!searchTrimmed) return markets;
    return Array.from(marketSearchCacheRef.current.values());
  }, [searchTrimmed, markets, searchCacheTick]);

  // Filter by sport tab + search, then by league (league options depend on sport)
  const sportFilteredMarkets = searchPool.filter((m) => {
    if (!sportFilter) return false;
    const inSportScope = searchTrimmed
      ? true
      : sportFilter === 'ALL' || m.category === sportFilter;
    const matchesSearch = queryMatchesHaystack(marketSearchHaystack(m), searchQuery);
    return inSportScope && matchesSearch;
  });

  const availableLeagues = Array.from(new Set(sportFilteredMarkets.map((m) => m.subtitle))).sort();
  // While searching, do not hide games behind a league chip (e.g. NCAAF-only vs NFL team names).
  const effectiveLeagueFilter = searchTrimmed ? 'ALL' : leagueFilter;
  const leagueFiltered = sportFilteredMarkets.filter(
    (m) => effectiveLeagueFilter === 'ALL' || m.subtitle === effectiveLeagueFilter,
  );

  /** Drop events too far out to limit noise and match “soonest first” browsing. */
  const MAX_COMMENCE_MS = 30 * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const withinHorizon = leagueFiltered.filter((m) => {
    if (m.status === 'LIVE') return true;
    const t = new Date(m.startTime).getTime();
    if (Number.isNaN(t)) return true;
    return t <= nowMs + MAX_COMMENCE_MS;
  });

  const displayMarkets = [...withinHorizon].sort((a, b) => {
    if (a.status === 'LIVE' && b.status !== 'LIVE') return -1;
    if (b.status === 'LIVE' && a.status !== 'LIVE') return 1;
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });

  const allCachedMarkets = useMemo(
    () => Array.from(marketSearchCacheRef.current.values()),
    [searchCacheTick, markets],
  );

  return {
    markets: displayMarkets,
    allCachedMarkets,
    sportFilteredMarkets,
    hasSelectedSport: Boolean(sportFilter),
    loading,
    error,
    searchCacheMarketCount: marketSearchCacheRef.current.size,
    sportFilter,
    leagueFilter,
    searchQuery,
    sportTabs: SPORT_TABS,
    availableLeagues,
    setSearchQuery,
    setLeagueFilter,
    handleSportFilter,
    selectLeagueInSport,
    loadMarkets,
  };
}
