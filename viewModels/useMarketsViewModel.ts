import { useState, useCallback, useRef, useEffect } from 'react';
import type { Market } from '../models';
import { fetchMarketsForSportTab } from '../services/oddsApiService';
import { SPORT_TABS } from '../models/constants';

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
  const fetchGeneration = useRef(0);
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

  // Filter by sport tab + search, then by league (league options depend on sport)
  const sportFilteredMarkets = markets.filter((m) => {
    if (!sportFilter) return false;
    const matchesSport = sportFilter === 'ALL' || m.category === sportFilter;
    const matchesSearch =
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.subtitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSport && matchesSearch;
  });

  const availableLeagues = Array.from(new Set(sportFilteredMarkets.map((m) => m.subtitle))).sort();
  const leagueFiltered = sportFilteredMarkets.filter(
    (m) => leagueFilter === 'ALL' || m.subtitle === leagueFilter
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
