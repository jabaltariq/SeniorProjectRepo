import { useState, useEffect, useCallback } from 'react';
import type { Market } from '../models';
import { fetchUpcomingOdds } from '../services/oddsApiService';
import { SPORT_TABS } from '../models/constants';

/**
 * Odds/markets from The Odds API. Filters: sport tab, league, search.
 * Used by DashboardView. Loads on mount and via loadMarkets (retry).
 */
export function useMarketsViewModel() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sportFilter, setSportFilter] = useState<string>('ALL');
  const [leagueFilter, setLeagueFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUpcomingOdds('us');
      setMarkets(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load odds');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMarkets();
  }, [loadMarkets]);

  // Filter by sport tab + search, then by league (league options depend on sport)
  const sportFilteredMarkets = markets.filter(m => {
    const matchesSport = sportFilter === 'ALL' || m.category === sportFilter;
    const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.subtitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSport && matchesSearch;
  });

  const availableLeagues = Array.from(new Set(sportFilteredMarkets.map(m => m.subtitle))).sort();
  const filteredMarkets = sportFilteredMarkets.filter(m =>
    leagueFilter === 'ALL' || m.subtitle === leagueFilter
  );

  const handleSportFilter = useCallback((sport: string) => {
    setSportFilter(sport);
    setLeagueFilter('ALL'); // reset league when sport changes
  }, []);

  return {
    markets: filteredMarkets,
    sportFilteredMarkets,
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
