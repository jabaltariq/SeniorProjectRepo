import { useState, useCallback, useEffect } from 'react';
import type {Bet, Friend, LeaderboardEntry, SocialActivity} from '../models';
import { useBettingViewModel } from './useBettingViewModel';
import { useMarketsViewModel } from './useMarketsViewModel';
import { MOCK_FRIENDS, MOCK_ACTIVITY } from '../models/constants';
import {
  FriendRequest,
  getFriendRequests, getFriendRequestsAsName,
  getFriends,
  getTopUsers, getUserName,
  getUserPrivacy,
  getUserTheme,
  setUserTheme,
  type UserThemeMode,
  loadCommunityActivity
} from '../services/dbOps';

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
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [userName, setUserName] = useState<string>();
  let [userPrivacy, setUserPrivacy] = useState<boolean>(false);
  const [themeMode, setThemeMode] = useState<UserThemeMode>('ocean');
  const [themeSaving, setThemeSaving] = useState(false);
  useEffect(() => {
    getFriendRequests(localStorage.uid).then((friendRequests) => {
      getFriendRequestsAsName(friendRequests).then((value) => {
        setFriendRequests(value)
      })
    })
    getUserName(localStorage.uid).then((value) => {
      setUserName(value)
    })
    getUserPrivacy(localStorage.uid).then((privacy) => {
      if (privacy == true) {
        setUserPrivacy(userPrivacy = true)
      }
      else {
        setUserPrivacy(userPrivacy = false)
      }
    })
    getFriends(localStorage.uid).then((list) => {
      setFriends(list)
    })
    getUserTheme(localStorage.uid).then((theme) => {
      setThemeMode(theme);
    }).catch((err) => {
      console.error('Failed to load user theme', err);
    });
    loadCommunityActivity().then(({ activities, bets }) => {
      setActivities(activities);
      setBetList(bets);
    })
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

  const updateThemeMode = useCallback(async (nextThemeMode: UserThemeMode) => {
    if (themeMode === nextThemeMode) return;
    const uid = typeof localStorage !== 'undefined' ? localStorage.getItem('uid') : null;
    if (!uid) return;

    setThemeMode(nextThemeMode);
    setThemeSaving(true);
    try {
      await setUserTheme(uid, nextThemeMode);
    } catch (err) {
      console.error('Failed to save user theme', err);
      setThemeMode((prev) => (prev === 'light' ? 'ocean' : 'light'));
    } finally {
      setThemeSaving(false);
    }
  }, [themeMode]);



  return {
    userPrivacy,
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
    friendReqs: friendRequests,
    userName: userName,
    themeMode,
    themeSaving,
    updateThemeMode,
  };
}
