import { useState, useCallback } from 'react';
import type { Friend } from '../models';
import { useBettingViewModel } from './useBettingViewModel';
import { useMarketsViewModel } from './useMarketsViewModel';
import { MOCK_LEADERBOARD, MOCK_FRIENDS, MOCK_ACTIVITY } from '../models/constants';

/**
 * Composes betting + markets + auth for DashboardView.
 * view = which tab: MARKETS | HISTORY | LEADERBOARD | SOCIAL
 */
export type DashboardView = 'MARKETS' | 'HISTORY' | 'LEADERBOARD' | 'SOCIAL' | 'SETTINGS';

interface AuthViewModel {
  userInitials: string;
  logout: () => void;
}

export function useDashboardViewModel(auth: AuthViewModel) {
  const betting = useBettingViewModel();
  const markets = useMarketsViewModel();

  const [view, setView] = useState<DashboardView>('MARKETS');

  const handleChallenge = useCallback((friend: Friend) => {
    alert(`Challenge request sent to ${friend.name}! Head-to-head competition initiated.`);
  }, []);

  return {
    auth,
    betting,
    markets,
    view,
    setView,
    handleChallenge,
    leaderboardEntries: MOCK_LEADERBOARD,
    friends: MOCK_FRIENDS,
    activity: MOCK_ACTIVITY,
  };
}
