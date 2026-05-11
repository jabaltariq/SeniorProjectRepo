import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Settings,
  Eye,
  Trophy,
  BarChart3,
  Wallet,
  Target,
  Clock3,
  Swords,
  MessageSquare,
} from 'lucide-react';
import { CounterBetModal } from '../components/CounterBetModal';
import { CounterOpponentModal } from '@/components/CounterOpponentModal';
import { GameChallengeModal } from '@/components/GameChallengeModal';
import { challengeBetEligibility } from '@/lib/challengeBetEligibility';
import { proposeHeadToHead, sendFriendRequest } from '@/services/dbOps';
import {
  getAccountProfile,
  getBets,
  getAchievementDefinitions,
  setAccountDisplay,
  setUnlockedAchievements,
  type UserThemeMode,
  type AccountAchievementKey,
  type AccountDisplayConfig,
  type AccountStatKey,
  type AchievementDefinition,
} from '@/services/dbOps';
import type { Bet, Market } from '../models';
import { SettingsView } from './SettingsView';
import { getUserStoreState } from '@/services/storeOps';
import { findStoreAvatar } from '@/models/storeItems';
import { profileBackgroundForUid } from '@/models/profileBackgrounds';
import { defaultAvatarForUid } from '@/models/defaultProfileAvatars';

interface ProfileViewProps {
  userInitials: string;
  userEmail: string;
  balance: number;
  activeBetsCount: number;
  currentUserId?: string | null;
  /** Display name for DM / game challenges (BetHub username). */
  currentUserDisplayName?: string;
  /** Markets list for picking a game to challenge someone on. */
  markets?: Market[];
  /** Live NFL sim board (three games) for profile game challenges. */
  nflMockChallengeMarkets?: Market[];
  themeMode: UserThemeMode;
  themeSaving: boolean;
  onThemeModeChange: (mode: UserThemeMode) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  userInitials,
  userEmail,
  balance,
  activeBetsCount,
  currentUserId,
  currentUserDisplayName,
  markets = [],
  nflMockChallengeMarkets = [],
  themeMode,
  themeSaving,
  onThemeModeChange,
}) => {
  const navigate = useNavigate();
  // The app does not declare any <Route path="profile/:userId"> elements,
  // so useParams() returns an empty object. Parse the uid out of the pathname
  // ourselves so links like /profile/<uid> from the leaderboard, friends list,
  // and activity feed actually resolve to that user.
  const { pathname } = useLocation();
  const routeUserId = (() => {
    const segments = pathname
      .replace(/^\/bethub\/?/, '')
      .replace(/^\//, '')
      .split('/')
      .filter(Boolean);
    return segments[0] === 'profile' && segments[1] ? segments[1] : undefined;
  })();
  const profileUserId = routeUserId ?? currentUserId ?? null;
  const isOwnProfile = !routeUserId || routeUserId === currentUserId;

  const [displayName, setDisplayName] = useState(isOwnProfile ? userEmail.split('@')[0] || 'My account' : 'Account');
  const [avatarText, setAvatarText] = useState(userInitials || 'BH');
  // Equipped store avatar image URL — null means we fall back to initials.
  // Loaded by the same loadAccount() effect below so we don't add another
  // request lifecycle to keep track of.
  const [equippedAvatarUrl, setEquippedAvatarUrl] = useState<string | null>(null);
  const [defaultAvatarPath, setDefaultAvatarPath] = useState<string | null>(null);
  const [profileBackgroundUrl, setProfileBackgroundUrl] = useState<string | null>(null);
  const [netWorth, setNetWorth] = useState(balance);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [totalBets, setTotalBets] = useState(activeBetsCount);
  const [profileDisplay, setProfileDisplay] = useState<AccountDisplayConfig>({
    stats: ['netWorth', 'wins', 'winRate', 'totalBets'],
    achievements: [],
    bets: [],
  });
  const [recentBets, setRecentBets] = useState<Bet[]>([]);
  const [achievementDefinitions, setAchievementDefinitions] = useState<AchievementDefinition[]>([]);
  const [unlockedAchievementIds, setUnlockedAchievementIds] = useState<AccountAchievementKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingStats, setIsEditingStats] = useState(false);
  const [isEditingAchievements, setIsEditingAchievements] = useState(false);
  const [isEditingBets, setIsEditingBets] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [publicPreview, setPublicPreview] = useState(false);
  const [friendRequestState, setFriendRequestState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [showGameChallengeModal, setShowGameChallengeModal] = useState(false);
  const [challengeBets, setChallengeBets] = useState<Bet[]>([]);

  // Counter-Bet (head-to-head) modal target.
  const [counterBetTarget, setCounterBetTarget] = useState<Bet | null>(null);

  // Decide whether to render the Counter-Bet button on a given bet, and if
  // the button shows but isn't actually fadeable, explain why. We deliberately
  // distinguish:
  //   - 'hidden':   the button shouldn't even render (own profile)
  //   - 'disabled': render the button greyed out + show the reason inline so
  //                 the viewer understands why they can't fade
  //   - 'enabled':  full Counter-Bet flow available
  type FadeEligibility =
    | { kind: 'hidden' }
    | { kind: 'disabled'; reason: string }
    | { kind: 'enabled' };
  const fadeEligibility = (bet: Bet): FadeEligibility => {
    if (isOwnProfile) return { kind: 'hidden' };
    const r = challengeBetEligibility(bet);
    if (r.kind === 'enabled') return { kind: 'enabled' };
    return { kind: 'disabled', reason: r.reason };
  };

  useEffect(() => {
    let cancelled = false;
    setFriendRequestState('idle');
    setShowCounterModal(false);
    setShowGameChallengeModal(false);

    async function loadAccount() {
      if (!profileUserId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [profile, bets, definitions, storeState] = await Promise.all([
          getAccountProfile(profileUserId),
          getBets(profileUserId),
          getAchievementDefinitions(),
          getUserStoreState(profileUserId),
        ]);

        if (cancelled) return;

        // Resolve equipped avatar to an image URL. If no avatar is equipped
        // (or the id is stale), this falls back to null and the existing
        // initials span renders.
        const equipped = findStoreAvatar(storeState.equippedAvatar);
        setEquippedAvatarUrl(equipped?.imageUrl ?? null);

        setAchievementDefinitions(definitions);

        if (profile) {
          setDisplayName(profile.name);
          setAvatarText(profile.avatar || userInitials || 'BH');
          setDefaultAvatarPath(profile.defaultAvatarPath ?? null);
          setProfileBackgroundUrl(profile.profileBackgroundUrl ?? null);
          setNetWorth(isOwnProfile ? balance : profile.netWorth);
          setWins(profile.wins);
          setLosses(profile.losses);
          setTotalBets(Math.max(profile.totalBets, bets.length));
          const fallbackBetIds = [...bets]
            .sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime())
            .slice(0, 3)
            .map((bet) => bet.id);
          setProfileDisplay({
            ...profile.profileDisplay,
            achievements: profile.profileDisplay.achievements,
            bets: profile.profileDisplay.bets.length ? profile.profileDisplay.bets : fallbackBetIds,
          });
          setUnlockedAchievementIds(profile.unlockedAchievements);
        } else {
          setDisplayName(isOwnProfile ? userEmail.split('@')[0] || 'My account' : 'Account not found');
          setAvatarText(userInitials || 'BH');
          setDefaultAvatarPath(null);
          setProfileBackgroundUrl(null);
          setNetWorth(balance);
          setWins(0);
          setLosses(0);
          setTotalBets(bets.length);
          setProfileDisplay({
            stats: ['netWorth', 'wins', 'winRate', 'totalBets'],
            achievements: [],
            bets: [...bets].sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime()).slice(0, 3).map((bet) => bet.id),
          });
          setUnlockedAchievementIds([]);
        }

        setChallengeBets([...bets].sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime()));
        setRecentBets(
          [...bets]
            .sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime())
            .slice(0, 5)
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadAccount();
    return () => {
      cancelled = true;
    };
  }, [profileUserId, currentUserId, isOwnProfile, balance, activeBetsCount, userEmail, userInitials]);

  const updateProfileDisplay = useCallback((updater: (current: AccountDisplayConfig) => AccountDisplayConfig) => {
    if (!currentUserId || !isOwnProfile) return;
    setProfileDisplay((prev) => {
      const next = updater(prev);
      void setAccountDisplay(currentUserId, next);
      return next;
    });
  }, [currentUserId, isOwnProfile]);

  const toggleStat = useCallback((stat: AccountStatKey) => {
    updateProfileDisplay((prev) => ({
      ...prev,
      stats: prev.stats.includes(stat)
        ? prev.stats.filter((item) => item !== stat)
        : [...prev.stats, stat],
    }));
  }, [updateProfileDisplay]);

  const toggleAchievement = useCallback((achievement: AccountAchievementKey) => {
    updateProfileDisplay((prev) => ({
      ...prev,
      achievements: prev.achievements.includes(achievement)
        ? prev.achievements.filter((item) => item !== achievement)
        : [...prev.achievements, achievement],
    }));
  }, [updateProfileDisplay]);

  const toggleBet = useCallback((betId: string) => {
    updateProfileDisplay((prev) => ({
      ...prev,
      bets: prev.bets.includes(betId)
        ? prev.bets.filter((item) => item !== betId)
        : [...prev.bets, betId],
    }));
  }, [updateProfileDisplay]);

  const handleSendFriendRequest = async () => {
    if (!currentUserId || isOwnProfile || !displayName || friendRequestState !== 'idle') return;

    setFriendRequestState('sending');
    try {
      const result = await sendFriendRequest(displayName, currentUserId);
      setFriendRequestState(result?.success ? 'sent' : 'idle');
      if (!result?.success && result?.error) {
        console.warn('Friend request rejected:', result.error);
      }
    } catch (error) {
      console.error('sendFriendRequest failed', error);
      setFriendRequestState('idle');
    }
  };

  const winRate = totalBets > 0 ? Math.round((wins / totalBets) * 100) : 0;
  const achievementCards = useMemo(() => {
    return achievementDefinitions.map((achievement) => {
      let unlocked = false;

      if (achievement.rule.type === 'metric_gte') {
        if (achievement.rule.metric === 'betsPlaced') unlocked = totalBets >= achievement.rule.value;
        if (achievement.rule.metric === 'wins') unlocked = wins >= achievement.rule.value;
        if (achievement.rule.metric === 'losses') unlocked = losses >= achievement.rule.value;
        if (achievement.rule.metric === 'money') unlocked = netWorth >= achievement.rule.value;
      }

      if (achievement.rule.type === 'metric_lte') {
        if (achievement.rule.metric === 'betsPlaced') unlocked = totalBets <= achievement.rule.value;
        if (achievement.rule.metric === 'wins') unlocked = wins <= achievement.rule.value;
        if (achievement.rule.metric === 'losses') unlocked = losses <= achievement.rule.value;
        if (achievement.rule.metric === 'money') unlocked = netWorth <= achievement.rule.value;
      }

      return {
        id: achievement.id,
        title: achievement.title,
        unlocked,
        detail: achievement.description,
      };
    });
  }, [achievementDefinitions, totalBets, wins, losses, netWorth]);

  const computedUnlockedAchievementIds = useMemo(() => {
    return achievementCards
      .filter((achievement) => achievement.unlocked)
      .map((achievement) => achievement.id);
  }, [achievementCards]);

  useEffect(() => {
    if (!isOwnProfile || !currentUserId) return;

    const current = [...unlockedAchievementIds].sort().join('|');
    const computed = [...computedUnlockedAchievementIds].sort().join('|');
    if (current === computed) return;

    setUnlockedAchievementIds(computedUnlockedAchievementIds);
    void setUnlockedAchievements(currentUserId, computedUnlockedAchievementIds);
    setProfileDisplay((prev) => ({
      ...prev,
      achievements: prev.achievements.filter((id) => computedUnlockedAchievementIds.includes(id)),
    }));
  }, [computedUnlockedAchievementIds, unlockedAchievementIds, currentUserId, isOwnProfile]);

  const statCards = useMemo(() => {
    const roundedNetWorth = Math.round(netWorth);
    return [
      { id: 'netWorth' as const, label: 'Net Worth', value: `$${roundedNetWorth.toLocaleString()}`, tone: 'text-emerald-300' },
      { id: 'wins' as const, label: 'Wins', value: String(wins), tone: 'text-slate-200' },
      { id: 'losses' as const, label: 'Losses', value: String(losses), tone: 'text-slate-200' },
      { id: 'winRate' as const, label: 'Win Rate', value: `${winRate}%`, tone: 'text-slate-200' },
      { id: 'totalBets' as const, label: 'Total Bets', value: String(totalBets), tone: 'text-slate-200' },
      {
        id: 'openBets' as const,
        label: 'Open Bets',
        value: String(isOwnProfile ? activeBetsCount : recentBets.filter((bet) => (bet.status ?? 'PENDING') === 'PENDING').length),
        tone: 'text-slate-200',
      },
    ];
  }, [netWorth, wins, losses, winRate, totalBets, isOwnProfile, activeBetsCount, recentBets]);

  const displayedStats = statCards.filter((card) => profileDisplay.stats.includes(card.id));
  const statsForSection = isOwnProfile && isEditingStats ? statCards : displayedStats;
  const unlockedAchievementCards = achievementCards.filter((card) => unlockedAchievementIds.includes(card.id));
  const displayedAchievements = achievementCards.filter(
    (card) => unlockedAchievementIds.includes(card.id) && profileDisplay.achievements.includes(card.id)
  );
  const achievementsForSection = isOwnProfile && isEditingAchievements
    ? unlockedAchievementCards
    : displayedAchievements;
  const displayedBets = recentBets.filter((bet) => profileDisplay.bets.includes(bet.id));
  const betsForSection = isOwnProfile && isEditingBets ? recentBets : displayedBets;

  const viewingAsPublic = Boolean(isOwnProfile && publicPreview);
  const showEditUi = isOwnProfile && !viewingAsPublic;
  const resolvedDefaultAvatarPath = defaultAvatarPath ?? defaultAvatarForUid(profileUserId, displayName);
  const defaultAvatarUrl = `/bethub/${resolvedDefaultAvatarPath}`;
  const profileAvatarUrl = equippedAvatarUrl ?? defaultAvatarUrl;
  const coverImageUrl = profileBackgroundUrl ?? profileBackgroundForUid(profileUserId, displayName);
  const statsForDisplay = !isOwnProfile || viewingAsPublic ? displayedStats : statsForSection;
  const achievementsForDisplay = !isOwnProfile || viewingAsPublic ? displayedAchievements : achievementsForSection;
  const betsForDisplay = !isOwnProfile || viewingAsPublic ? displayedBets : betsForSection;

  const sectionShell =
    'rounded-2xl border border-slate-800/50 bg-slate-950/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]';
  const sectionLabel = 'text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500';

  return (
    <div className="animate-in fade-in duration-500 mx-auto w-full max-w-5xl">
      {loading ? (
        <div
          className={`${sectionShell} py-16 text-center text-sm text-slate-500`}
        >
          Loading account...
        </div>
      ) : (
        <div className="space-y-8">
          <section className={`${sectionShell} relative overflow-hidden bg-slate-950`}>
            {viewingAsPublic && (
              <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/25 bg-amber-500/[0.07] px-4 py-2.5 text-xs text-amber-100 sm:px-5">
                <span className="font-medium">You&apos;re viewing your public profile.</span>
                <button
                  type="button"
                  onClick={() => setPublicPreview(false)}
                  className="rounded-md border border-amber-400/35 bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-50 hover:bg-amber-500/25"
                >
                  Exit preview
                </button>
              </div>
            )}
            <div
              className="absolute inset-0 bg-cover bg-center opacity-85"
              style={{ backgroundImage: `url("${coverImageUrl}")` }}
              aria-hidden
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/68 to-slate-950/10" aria-hidden />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/38 to-transparent" aria-hidden />
            <div className="absolute inset-0 backdrop-blur-[1px]" aria-hidden />
            <div className={`relative z-10 px-5 pb-6 sm:px-8 sm:pb-8 ${viewingAsPublic ? 'pt-7 sm:pt-9' : 'pt-9 sm:pt-12'}`}>
              <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
                <div className="flex min-w-0 flex-1 gap-4 sm:gap-5">
                  <div className="relative shrink-0">
                    <div className="h-24 w-24 rounded-full bg-gradient-to-br from-white/45 via-blue-400/40 to-slate-900 p-[3px] shadow-2xl shadow-black/40 ring-1 ring-white/20 sm:h-28 sm:w-28">
                      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-slate-950">
                        {profileAvatarUrl ? (
                          <img
                            src={profileAvatarUrl}
                            alt={`${displayName}'s avatar`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={() => {
                              setEquippedAvatarUrl(null);
                            }}
                          />
                        ) : (
                          <span className="text-2xl font-semibold tracking-tight text-blue-300 sm:text-3xl">
                            {avatarText}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em] text-blue-200/80">
                      {isOwnProfile ? 'BetHub Profile' : 'Profile'}
                    </p>
                    <h2 className="text-2xl font-black tracking-tight text-white drop-shadow sm:text-4xl">
                      {displayName}
                    </h2>
                    <p className="mt-1 break-words text-sm leading-relaxed text-slate-300/85">
                      {isOwnProfile ? userEmail : `${displayName} on BetHub`}
                    </p>
                    {isOwnProfile && (
                      <p className="mt-3 text-[10px] font-bold tracking-[0.22em] text-slate-400">
                        PUBLIC PREVIEW READY
                      </p>
                    )}
                    {!isOwnProfile && profileUserId && (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => navigate('/friends', { state: { openChatWithUserId: profileUserId } })}
                          className="inline-flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-200 hover:border-blue-400/60 hover:bg-blue-500/20 transition-colors"
                        >
                          <MessageSquare size={14} aria-hidden />
                          Message
                        </button>
                        {currentUserId && currentUserId !== profileUserId && (
                          <>
                            <button
                              type="button"
                              onClick={() => setShowCounterModal(true)}
                              className="inline-flex items-center gap-2 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 transition-colors hover:border-red-400/55 hover:bg-red-500/20"
                            >
                              <Swords size={14} aria-hidden />
                              Counter
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowGameChallengeModal(true)}
                              className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-100 transition-colors hover:border-amber-400/60 hover:bg-amber-500/20"
                            >
                              <Trophy size={14} aria-hidden />
                              Challenge
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleSendFriendRequest()}
                          disabled={friendRequestState !== 'idle'}
                          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            friendRequestState === 'sent'
                              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                              : 'border-slate-500/40 bg-slate-950/45 text-slate-200 hover:border-blue-400/50 hover:bg-blue-500/15'
                          } ${friendRequestState === 'sending' ? 'cursor-wait opacity-75' : ''}`}
                        >
                          {friendRequestState === 'sent'
                            ? 'Request Sent'
                            : friendRequestState === 'sending'
                              ? 'Sending...'
                              : 'Send Friend Request'}
                        </button>
                      </div>
                    )}
                    {showEditUi && !publicPreview && (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPublicPreview(true);
                            setIsEditingStats(false);
                            setIsEditingAchievements(false);
                            setIsEditingBets(false);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-blue-500/40 hover:bg-slate-800"
                        >
                          <Eye size={14} strokeWidth={2} aria-hidden />
                          Preview public profile
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowSettings((prev) => !prev)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                            showSettings
                              ? 'border-blue-500/50 bg-blue-500/15 text-blue-200'
                              : 'border-slate-600 bg-slate-800/50 text-slate-400 hover:border-slate-500 hover:bg-slate-800 hover:text-slate-200'
                          }`}
                          title="Advanced settings"
                          aria-expanded={showSettings}
                        >
                          Settings
                          <Settings size={16} strokeWidth={2} aria-hidden />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {(statsForDisplay.length > 0 || isOwnProfile) && (
                  <div className="min-w-0 flex-1">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h3 className={`${sectionLabel} flex items-center gap-2 text-slate-300/80`}>
                        <BarChart3 size={14} className="text-blue-400/90" aria-hidden />
                        Stats
                      </h3>
                      {showEditUi && (
                        <button
                          type="button"
                          onClick={() => setIsEditingStats((prev) => !prev)}
                          className="rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-white"
                        >
                          {isEditingStats ? 'View' : 'Edit'}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
                      {statsForDisplay.map((card) => {
                        const isSelected = profileDisplay.stats.includes(card.id);
                        const isClickable = showEditUi && isEditingStats;
                        const cardStyle = isClickable
                          ? isSelected
                            ? 'border-white/20 bg-white/[0.08] ring-1 ring-white/10'
                            : 'border-white/10 bg-slate-950/30 opacity-60'
                          : 'border-white/10 bg-white/[0.06]';
                        return (
                          <button
                            type="button"
                            key={card.id}
                            onClick={isClickable ? () => toggleStat(card.id) : undefined}
                            disabled={!isClickable}
                            className={`rounded-xl border px-3 py-3 text-left shadow-inner shadow-white/[0.02] transition-colors ${cardStyle} ${
                              isClickable ? 'cursor-pointer hover:border-white/25 hover:bg-white/[0.1]' : 'cursor-default'
                            }`}
                          >
                            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">{card.label}</p>
                            <p className={`mt-1 text-xl font-black tabular-nums ${card.tone}`}>{card.value}</p>
                          </button>
                        );
                      })}
                    </div>
                    {showEditUi && !isEditingStats && statsForDisplay.length === 0 && (
                      <p className="mt-4 text-sm text-slate-500">
                        No stats are public yet. Switch to Edit to choose what others can see.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {showEditUi && showSettings && (
            <div className={`${sectionShell} p-5 sm:p-6`}>
              <SettingsView
                userEmail={userEmail}
                embedded
                themeMode={themeMode}
                themeSaving={themeSaving}
                onThemeModeChange={onThemeModeChange}
              />
            </div>
          )}

              {(achievementsForDisplay.length > 0 || (showEditUi && unlockedAchievementCards.length > 0)) && (
                <section className={`${sectionShell} p-6 sm:p-8`}>
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <h3 className={`${sectionLabel} flex items-center gap-2 text-slate-400`}>
                      <Trophy size={14} className="text-amber-400/90" aria-hidden />
                      Achievements
                    </h3>
                    {showEditUi && unlockedAchievementCards.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsEditingAchievements((prev) => !prev)}
                        className="rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-white"
                      >
                        {isEditingAchievements ? 'View' : 'Edit'}
                      </button>
                    )}
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {achievementsForDisplay.map((achievement) => {
                      const isSelected = profileDisplay.achievements.includes(achievement.id);
                      const isClickable = showEditUi && isEditingAchievements;
                      return (
                      <button
                        key={achievement.id}
                        type="button"
                        onClick={isClickable ? () => toggleAchievement(achievement.id) : undefined}
                        className={`rounded-xl border p-4 text-left transition-colors ${
                          isSelected
                            ? 'border-amber-400/45 bg-amber-500/10 ring-1 ring-amber-400/15'
                            : 'border-slate-800/80 bg-slate-900/35'
                        } ${
                          isClickable ? 'cursor-pointer hover:border-amber-400/40 hover:bg-slate-800/30' : 'cursor-default'
                        }`}
                        disabled={!isClickable}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Trophy
                            size={18}
                            className={isSelected ? 'text-amber-300' : 'text-slate-500'}
                          />
                          <p className={`font-semibold ${isSelected ? 'text-amber-100' : 'text-slate-200'}`}>
                            {achievement.title}
                          </p>
                        </div>
                        <p className={`${isSelected ? 'text-amber-200/80' : 'text-slate-400'} text-sm`}>
                          {achievement.detail}
                        </p>
                      </button>
                    );
                    })}
                  </div>
                  {showEditUi && !isEditingAchievements && achievementsForDisplay.length === 0 && (
                    <p className="mt-4 text-sm text-slate-500">
                      No achievements are public yet. Switch to Edit to choose what others can see.
                    </p>
                  )}
                  {showEditUi && isEditingAchievements && unlockedAchievementCards.length === 0 && (
                    <p className="mt-4 text-sm text-slate-500">
                      Unlock achievements to choose which ones appear publicly.
                    </p>
                  )}
                </section>
              )}

              {(betsForDisplay.length > 0 || isOwnProfile) && (
                <section className={`${sectionShell} p-6 sm:p-8`}>
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <h3 className={`${sectionLabel} flex items-center gap-2 text-slate-400`}>
                      Featured Bets
                    </h3>
                    {showEditUi && (
                      <button
                        type="button"
                        onClick={() => setIsEditingBets((prev) => !prev)}
                        className="rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-white"
                      >
                        {isEditingBets ? 'View' : 'Edit'}
                      </button>
                    )}
                  </div>
                  {betsForDisplay.length > 0 ? (
                    <div className="space-y-3">
                      {betsForDisplay.map((bet) => {
                        const isSelected = profileDisplay.bets.includes(bet.id);
                        const isClickable = showEditUi && isEditingBets;
                        const fade = fadeEligibility(bet);
                        const challengerStake = Math.round(bet.stake * (bet.odds - 1) * 100) / 100;
                        const betCardStyle = isClickable
                          ? isSelected
                            ? 'border-white/20 bg-white/[0.06] ring-1 ring-white/10'
                            : 'border-slate-800/80 bg-slate-950/25 opacity-60'
                          : 'border-slate-800/80 bg-slate-950/30';
                        return (
                        <div
                          key={bet.id}
                          className={`overflow-hidden rounded-xl border shadow-inner shadow-white/[0.02] ${betCardStyle}`}
                        >
                        <button
                          type="button"
                          onClick={isClickable ? () => toggleBet(bet.id) : undefined}
                          disabled={!isClickable}
                          className={`w-full px-4 py-3 text-left transition-colors ${
                            isClickable ? 'cursor-pointer hover:bg-white/[0.04]' : 'cursor-default'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-semibold text-slate-100">{bet.marketTitle}</p>
                              <p className="text-sm text-slate-400">{bet.optionLabel}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-300">
                                {(bet.status ?? 'PENDING').toLowerCase()}
                              </span>
                              {isClickable && isSelected && (
                                <Eye size={16} className="text-slate-200" aria-label="Shown on public profile" />
                              )}
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
                            <span className="inline-flex items-center gap-1"><Wallet size={12} /> ${bet.stake.toLocaleString()} stake</span>
                            <span className="inline-flex items-center gap-1"><Target size={12} /> {bet.odds.toFixed(2)} odds</span>
                            <span className="inline-flex items-center gap-1"><Clock3 size={12} /> {bet.placedAt.toLocaleString()}</span>
                          </div>
                        </button>
                        {fade.kind === 'enabled' && (
                          <div className="border-t border-slate-700/60 px-4 py-2 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => setCounterBetTarget(bet)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-red-300 hover:bg-red-500/20 transition-colors"
                            >
                              <Swords size={12} /> Counter-Bet ${challengerStake.toFixed(2)}
                            </button>
                          </div>
                        )}
                        {fade.kind === 'disabled' && (
                          <div className="border-t border-slate-700/60 px-4 py-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500">{fade.reason}</p>
                            <button
                              type="button"
                              disabled
                              title={fade.reason}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 cursor-not-allowed"
                            >
                              <Swords size={12} /> Counter-Bet
                            </button>
                          </div>
                        )}
                        </div>
                      );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-800/70 bg-slate-950/25 py-10 text-center">
                      <Target className="mx-auto mb-3 text-slate-600" size={40} strokeWidth={1.5} />
                      <p className="font-medium text-slate-500">No featured bets to show yet</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {showEditUi && isEditingBets
                          ? 'Place a few bets to choose which ones appear here.'
                          : 'Once bets are placed, they can appear here on the account page.'}
                      </p>
                    </div>
                  )}
                  {showEditUi && !isEditingBets && betsForDisplay.length === 0 && recentBets.length > 0 && (
                    <p className="mt-4 text-sm text-slate-500">
                      No featured bets are public yet. Switch to Edit to choose which bets to show.
                    </p>
                  )}
                </section>
              )}
        </div>
      )}
      {showCounterModal && profileUserId && currentUserId && currentUserId !== profileUserId && (
        <CounterOpponentModal
          isOpen
          onClose={() => setShowCounterModal(false)}
          opponentUserId={profileUserId}
          opponentDisplayName={displayName}
          opponentAvatarUrl={profileAvatarUrl}
          backgroundImageUrl={coverImageUrl}
          currentUserId={currentUserId}
          balance={balance}
          prefetchedBets={challengeBets}
        />
      )}
      {showGameChallengeModal && profileUserId && currentUserId && currentUserId !== profileUserId && (
        <GameChallengeModal
          isOpen
          onClose={() => setShowGameChallengeModal(false)}
          mockNflMarkets={nflMockChallengeMarkets}
          opponentUserId={profileUserId}
          opponentDisplayName={displayName}
          opponentAvatarUrl={profileAvatarUrl}
          backgroundImageUrl={coverImageUrl}
          currentUserId={currentUserId}
          challengerDisplayName={currentUserDisplayName?.trim() || userEmail.split('@')[0] || 'Player'}
          onSent={() => navigate('/friends', { state: { openChatWithUserId: profileUserId } })}
        />
      )}
      {counterBetTarget && currentUserId && (
        <CounterBetModal
          bet={counterBetTarget}
          ownerName={displayName}
          balance={balance}
          counterDm={
            profileUserId && currentUserId !== profileUserId
              ? { messagingFromUserId: currentUserId, opponentUserId: profileUserId }
              : undefined
          }
          onConfirm={(originalBetId) => proposeHeadToHead(originalBetId, currentUserId)}
          onClose={() => setCounterBetTarget(null)}
        />
      )}
    </div>
  );
};
