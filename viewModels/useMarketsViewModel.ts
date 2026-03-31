import { useState, useCallback, useRef } from 'react';
import type { Market } from '../models';
import { fetchMarketsForSportTab } from '../services/oddsApiService';
import { SPORT_TABS } from '../models/constants';

/**
 * Odds/markets from The Odds API. Filters: sport tab, league, search.
 * API runs only after the user selects a sport tab (no fetch on mount).
 */
export function useMarketsViewModel() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sportFilter, setSportFilter] = useState<string>('');
  const [leagueFilter, setLeagueFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const fetchGeneration = useRef(0);

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
  const filteredMarkets = sportFilteredMarkets.filter(
    (m) => leagueFilter === 'ALL' || m.subtitle === leagueFilter
  );

  return {
    markets: filteredMarkets,
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
    loadMarkets,
  };
}
