import { useState, useCallback, useRef, useEffect } from 'react';
import type { Market } from '../models';
import { fetchMarketsForSportTab } from '../services/oddsApiService';
import { SPORT_TABS } from '../models/constants';

const GLOBAL_SEARCH_DEBOUNCE_MS = 400;

/** Text used for substring search (teams often appear only on spread/h2h option labels). */
function marketSearchHaystack(m: Market): string {
  const parts = [
    m.title,
    m.subtitle,
    m.category,
    m.sport_key ?? '',
    ...m.options.map((o) => o.label),
  ];
  return parts.join(' ').toLowerCase().replace(/@/g, ' ');
}

function queryMatchesHaystack(haystack: string, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((t) => haystack.includes(t));
}

function defaultSportTab(): string {
  const tab = SPORT_TABS.find((t) => t !== 'ALL');
  return tab ?? 'Football';
}

/**
 * Odds/markets from The Odds API. Filters: sport tab, league, search.
 * Defaults to the first sport tab and loads odds on mount; league filter defaults to ALL.
 * Sport filter `ALL` = all sports (single upcoming odds request). With league ALL, boards list
 * games soonest-first and hide kickoffs beyond 30 days (LIVE always kept).
 */
export function useMarketsViewModel() {
  const initialSport = defaultSportTab();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sportFilter, setSportFilter] = useState<string>(initialSport);
  const [leagueFilter, setLeagueFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [globalSearchMarkets, setGlobalSearchMarkets] = useState<Market[]>([]);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [globalSearchError, setGlobalSearchError] = useState<string | null>(null);
  const fetchGeneration = useRef(0);
  const globalSearchFetchGen = useRef(0);
  const globalSearchPoolReadyRef = useRef(false);
  const didInitialFetch = useRef(false);

  const loadMarkets = useCallback(async (sportTab?: string) => {
    const tab = sportTab ?? sportFilter;
    if (!tab) return;

    const gen = ++fetchGeneration.current;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMarketsForSportTab(tab, 'us');
      if (gen !== fetchGeneration.current) return;
      setMarkets(data);
    } catch (e) {
      if (gen !== fetchGeneration.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load odds');
    } finally {
      if (gen === fetchGeneration.current) {
        setLoading(false);
      }
    }
  }, [sportFilter]);

  const handleSportFilter = useCallback(
    (sport: string) => {
      setSportFilter(sport);
      setLeagueFilter('ALL');
      void loadMarkets(sport);
    },
    [loadMarkets]
  );

  /** Sidebar / popular: jump to one sport + league without the sport handler resetting league to ALL. */
  const selectLeagueInSport = useCallback(
    (sport: string, league: string) => {
      setSportFilter(sport);
      setLeagueFilter(league);
      void loadMarkets(sport);
    },
    [loadMarkets]
  );

  useEffect(() => {
    if (didInitialFetch.current) return;
    didInitialFetch.current = true;
    void loadMarkets(initialSport);
  }, [initialSport, loadMarkets]);

  /** When searching from a single-sport tab, load the upcoming “all sports” feed once; reuse until search cleared or user picks ALL. */
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || sportFilter === 'ALL') {
      globalSearchFetchGen.current += 1;
      globalSearchPoolReadyRef.current = false;
      setGlobalSearchLoading(false);
      setGlobalSearchError(null);
      setGlobalSearchMarkets([]);
      return;
    }

    if (globalSearchPoolReadyRef.current) {
      setGlobalSearchLoading(false);
      return;
    }

    let cancelled = false;
    const gen = ++globalSearchFetchGen.current;
    setGlobalSearchLoading(true);
    setGlobalSearchError(null);

    const t = window.setTimeout(async () => {
      if (cancelled) return;
      try {
        const data = await fetchMarketsForSportTab('ALL', 'us');
        if (cancelled || gen !== globalSearchFetchGen.current) return;
        setGlobalSearchMarkets(data);
        setGlobalSearchError(null);
        globalSearchPoolReadyRef.current = true;
      } catch (e) {
        if (cancelled || gen !== globalSearchFetchGen.current) return;
        setGlobalSearchError(e instanceof Error ? e.message : 'Failed to load odds');
        globalSearchPoolReadyRef.current = false;
      } finally {
        if (!cancelled && gen === globalSearchFetchGen.current) {
          setGlobalSearchLoading(false);
        }
      }
    }, GLOBAL_SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [searchQuery, sportFilter]);

  const searchTrimmed = searchQuery.trim();
  /** Single-sport tab + active search uses the global upcoming pool; ALL tab or no search uses the tab’s `markets`. */
  const searchPool =
    searchTrimmed && sportFilter !== 'ALL' ? globalSearchMarkets : markets;

  // Filter by sport tab + search, then by league (league options depend on sport)
  const sportFilteredMarkets = searchPool.filter((m) => {
    if (!sportFilter) return false;
    const inSportScope =
      searchTrimmed && sportFilter !== 'ALL'
        ? true
        : sportFilter === 'ALL' || m.category === sportFilter;
    const matchesSearch = queryMatchesHaystack(marketSearchHaystack(m), searchQuery);
    return inSportScope && matchesSearch;
  });

  const availableLeagues = Array.from(new Set(sportFilteredMarkets.map((m) => m.subtitle))).sort();
  // While searching, do not hide games behind a league chip (e.g. NCAAF-only vs NFL team names).
  const effectiveLeagueFilter = searchTrimmed ? 'ALL' : leagueFilter;
  const leagueFiltered = sportFilteredMarkets.filter(
    (m) => effectiveLeagueFilter === 'ALL' || m.subtitle === effectiveLeagueFilter
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

  return {
    markets: displayMarkets,
    sportFilteredMarkets,
    hasSelectedSport: Boolean(sportFilter),
    loading,
    error,
    globalSearchLoading: Boolean(searchTrimmed && sportFilter !== 'ALL' && globalSearchLoading),
    globalSearchError: searchTrimmed && sportFilter !== 'ALL' ? globalSearchError : null,
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
