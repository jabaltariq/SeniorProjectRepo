import { useState, useCallback, useEffect } from 'react';
import type {Bet, Friend, LeaderboardEntry, SocialActivity} from '../models';
import { useBettingViewModel } from './useBettingViewModel';
import { useMarketsViewModel } from './useMarketsViewModel';
import { MOCK_FRIENDS, MOCK_ACTIVITY } from '../models/constants';
import {getFriends, getTopUsers, loadCommunityActivity} from '../services/dbOps';

/**
 * Composes betting + markets + auth for DashboardView.
 * view = which tab: MARKETS | HISTORY | LEADERBOARD | SOCIAL
 */
export type DashboardView = 'MARKETS' | 'HISTORY' | 'LEADERBOARD' | 'SOCIAL' | 'PROFILE' | 'SETTINGS';

interface AuthViewModel {
  userInitials: string;
  userEmail?: string | null;
  logout: () => void;
}

export function useDashboardViewModel(auth: AuthViewModel) {
  const betting = useBettingViewModel(auth.userEmail ?? null);
  const markets = useMarketsViewModel();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [betList, setBetList] = useState<Bet[]>([]);
  const [activities, setActivities] = useState<SocialActivity[]>([])
  const [view, setView] = useState<DashboardView>('MARKETS');
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    getFriends(localStorage.uid).then((list) => {
      setFriends(list)
    })
    loadCommunityActivity().then((list) => {
      setActivities(list)
      setBetList(betList)
    })
    console.log(friends)
    let cancelled = false;
    getTopUsers()
        .then((rows) => {
          if (cancelled) return;
          const uid = typeof localStorage !== 'undefined' ? localStorage.getItem('uid') : null;
          setLeaderboardEntries(
              rows.map((r) => ({...r, isCurrentUser: uid != null && r.id === uid}))
          );
        })
        .catch((err) => {
          console.error('Failed to load leaderboard', err);
        });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChallenge = useCallback((friend: Friend) => {
    alert(`Challenge request sent to ${friend.name}! Head-to-head competition initiated.`);
  }, []);

  return {
    betList,
    auth,
    betting,
    markets,
    view,
    setView,
    handleChallenge,
    leaderboardEntries,
    friends: friends,
    activity: activities,
  };
}
