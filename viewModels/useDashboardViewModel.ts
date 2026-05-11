import { useState, useCallback, useEffect } from 'react';
import type {Bet, Friend, LeaderboardEntry, SocialActivity} from '../models';
import { useBettingViewModel } from './useBettingViewModel';
import { useMarketsViewModel } from './useMarketsViewModel';
import { MOCK_FRIENDS, MOCK_ACTIVITY } from '../models/constants';
import {
  FriendRequest,
  getTopUsers, getUserName,
  getUserPrivacy,
  getUserTheme,
  setUserTheme,
  type UserThemeMode,
  subscribeToCommunityActivity,
  subscribeToFriendRequests,
  subscribeToFriends,
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
  // The community activity feed is global (not user-scoped), so its
  // subscription is mounted once for the lifetime of the dashboard.
  useEffect(() => {
    const unsubActivity = subscribeToCommunityActivity(
      ({ activities, bets }) => {
        setActivities(activities);
        setBetList(bets);
      },
      (err) => {
        console.error('Activity feed subscription failed', err);
      },
    );
    return () => {
      unsubActivity();
    };
  }, []);

  // Everything below depends on the *current* user (friend requests inbox,
  // profile fields, friends list, theme, leaderboard "isCurrentUser" flag).
  // Re-running on `auth.userEmail` change means logging in, signing up, or
  // switching accounts immediately re-subscribes with the new UID instead of
  // requiring a hard reload to pick up the change.
  useEffect(() => {
    const uid = typeof localStorage !== 'undefined' ? localStorage.getItem('uid') : null;

    if (!uid) {
      // Signed out: clear stale per-user state so the next viewer doesn't
      // briefly see the previous account's data.
      setFriendRequests([]);
      setFriends([]);
      setUserName(undefined);
      setUserPrivacy(false);
      setLeaderboardEntries([]);
      return;
    }

    let cancelled = false;

    const unsubFriendRequests = subscribeToFriendRequests(
      uid,
      (rows) => { if (!cancelled) setFriendRequests(rows); },
      (err) => console.error('Friend request subscription failed', err),
    );

    const unsubFriends = subscribeToFriends(
      uid,
      (list) => { if (!cancelled) setFriends(list); },
      (err) => console.error('Friends subscription failed', err),
    );

    getUserName(uid).then((value) => {
      if (!cancelled) setUserName(value);
    }).catch((err) => console.error('Failed to load user name', err));

    getUserPrivacy(uid).then((privacy) => {
      if (!cancelled) setUserPrivacy(privacy === true);
    }).catch((err) => console.error('Failed to load privacy', err));

    getUserTheme(uid).then((theme) => {
      if (!cancelled) setThemeMode(theme);
    }).catch((err) => console.error('Failed to load user theme', err));

    getTopUsers().then((rows) => {
      if (cancelled) return;
      setLeaderboardEntries(
        rows.map((r) => ({ ...r, isCurrentUser: r.id === uid })),
      );
    }).catch((err) => console.error('Failed to load leaderboard', err));

    return () => {
      cancelled = true;
      unsubFriendRequests();
      unsubFriends();
    };
  }, [auth.userEmail]);

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
