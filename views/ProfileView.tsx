import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Settings,
  Trophy,
  BarChart3,
  Wallet,
  Target,
  Clock3,
  Check,
  Swords,
} from 'lucide-react';
import { CounterBetModal } from '../components/CounterBetModal';
import { proposeHeadToHead } from '@/services/dbOps';
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
import type { Bet } from '../models';
import { SettingsView } from './SettingsView';

interface ProfileViewProps {
  userInitials: string;
  userEmail: string;
  balance: number;
  activeBetsCount: number;
  currentUserId?: string | null;
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
  themeMode,
  themeSaving,
  onThemeModeChange,
}) => {
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
    const status = bet.status ?? 'PENDING';
    if (status !== 'PENDING')      return { kind: 'disabled', reason: `This bet is already ${status.toLowerCase()}.` };
    if (bet.betType === 'parlay')  return { kind: 'disabled', reason: 'Parlays can\'t be faded yet.' };
    if (!bet.eventId || !bet.sportKey) {
      return { kind: 'disabled', reason: 'This bet is missing event info — too old to auto-settle a fade.' };
    }
    if (bet.odds <= 1)             return { kind: 'disabled', reason: 'Invalid odds — can\'t compute a fair fade.' };
    if (bet.eventStartsAt && bet.eventStartsAt.getTime() <= Date.now()) {
      return { kind: 'disabled', reason: 'Game has already started — too late to fade.' };
    }
    return { kind: 'enabled' };
  };

  useEffect(() => {
    let cancelled = false;

    async function loadAccount() {
      if (!profileUserId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [profile, bets, definitions] = await Promise.all([
          getAccountProfile(profileUserId),
          getBets(profileUserId),
          getAchievementDefinitions(),
        ]);

        if (cancelled) return;

        setAchievementDefinitions(definitions);

        if (profile) {
          setDisplayName(profile.name);
          setAvatarText(profile.avatar || userInitials || 'BH');
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
    return [
      { id: 'netWorth' as const, label: 'Net Worth', value: `$${netWorth.toLocaleString()}`, tone: 'text-green-400' },
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

  return (
    <div className="animate-in fade-in duration-500 w-full">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-6 flex-1 min-w-0">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-20 h-20 rounded-full bg-slate-700 border-2 border-slate-600 flex items-center justify-center shrink-0">
              <span className="text-2xl font-bold text-blue-400">{avatarText}</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-white">{isOwnProfile ? 'Account' : `${displayName}'s account`}</h2>
              <p className="text-slate-400 text-sm break-all">{isOwnProfile ? userEmail : `${displayName} on BetHub`}</p>
            </div>
          </div>
          <div className="flex-1 min-w-0 lg:max-w-md">
            <div className="glass-card rounded-2xl p-4 border-slate-800">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                {isOwnProfile ? 'Public account display' : 'Visible on this account'}
              </p>
              <p className="text-sm text-slate-400">
                {isOwnProfile
                  ? 'Choose which sections other BetHub users can see when they open your account page.'
                  : `${displayName} controls which account sections are public.`}
              </p>
            </div>
          </div>
        </div>
        {isOwnProfile && (
          <button
            onClick={() => setShowSettings((prev) => !prev)}
            className="p-3 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-slate-600 transition-all self-start shrink-0"
            title="Account settings"
          >
            <Settings className="text-slate-400 hover:text-slate-200" size={24} />
          </button>
        )}
      </div>

      {isOwnProfile && showSettings && (
        <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/35 p-5">
          <SettingsView
            userEmail={userEmail}
            embedded
            themeMode={themeMode}
            themeSaving={themeSaving}
            onThemeModeChange={onThemeModeChange}
          />
        </div>
      )}

      <div className="space-y-6">
        <div className="space-y-6">
          {loading ? (
            <div className="glass-card rounded-2xl p-10 border-slate-800 text-center text-slate-400">
              Loading account...
            </div>
          ) : (
            <div className="space-y-6">
              {(statsForSection.length > 0 || isOwnProfile) && (
                <section className="glass-card rounded-2xl p-6 border-slate-800">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-blue-400">
                      <BarChart3 size={20} /> Stats
                    </h3>
                    {isOwnProfile && (
                      <button
                        type="button"
                        onClick={() => setIsEditingStats((prev) => !prev)}
                        className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
                      >
                        {isEditingStats ? 'View' : 'Edit'}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {statsForSection.map((card) => {
                      const isSelected = profileDisplay.stats.includes(card.id);
                      const isClickable = isOwnProfile && isEditingStats;
                      return (
                      <button
                        type="button"
                        key={card.id}
                        onClick={isClickable ? () => toggleStat(card.id) : undefined}
                        disabled={!isClickable}
                        className={`p-4 rounded-xl border text-left transition-colors ${
                          isSelected
                            ? 'border-blue-500/60 bg-blue-500/10'
                            : 'border-slate-700 bg-slate-800/50'
                        } ${isClickable ? 'cursor-pointer hover:border-blue-400/70' : 'cursor-default'}`}
                      >
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">{card.label}</p>
                        <p className={`text-xl font-bold ${card.tone}`}>{card.value}</p>
                      </button>
                    );
                    })}
                  </div>
                  {isOwnProfile && !isEditingStats && statsForSection.length === 0 && (
                    <p className="mt-4 text-sm text-slate-500">
                      No stats are public yet. Switch to Edit to choose what others can see.
                    </p>
                  )}
                </section>
              )}

              {(achievementsForSection.length > 0 || (isOwnProfile && unlockedAchievementCards.length > 0)) && (
                <section className="glass-card rounded-2xl p-6 border-slate-800">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-blue-400">
                      <Trophy size={20} /> Achievements
                    </h3>
                    {isOwnProfile && unlockedAchievementCards.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsEditingAchievements((prev) => !prev)}
                        className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
                      >
                        {isEditingAchievements ? 'View' : 'Edit'}
                      </button>
                    )}
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {achievementsForSection.map((achievement) => {
                      const isSelected = profileDisplay.achievements.includes(achievement.id);
                      const isClickable = isOwnProfile && isEditingAchievements;
                      return (
                      <button
                        key={achievement.id}
                        type="button"
                        onClick={isClickable ? () => toggleAchievement(achievement.id) : undefined}
                        className={`rounded-xl border p-4 text-left transition-colors ${
                          isSelected
                            ? 'border-amber-400/40 bg-amber-500/10'
                            : 'border-slate-700 bg-slate-800/40'
                        } ${
                          isClickable ? 'cursor-pointer hover:border-amber-300/50' : 'cursor-default'
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
                  {isOwnProfile && !isEditingAchievements && achievementsForSection.length === 0 && (
                    <p className="mt-4 text-sm text-slate-500">
                      No achievements are public yet. Switch to Edit to choose what others can see.
                    </p>
                  )}
                  {isOwnProfile && isEditingAchievements && unlockedAchievementCards.length === 0 && (
                    <p className="mt-4 text-sm text-slate-500">
                      Unlock achievements to choose which ones appear publicly.
                    </p>
                  )}
                </section>
              )}

              {(betsForSection.length > 0 || isOwnProfile) && (
                <section className="glass-card rounded-2xl p-6 border-slate-800">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-blue-400">
                      <Target size={20} /> Featured Bets
                    </h3>
                    {isOwnProfile && (
                      <button
                        type="button"
                        onClick={() => setIsEditingBets((prev) => !prev)}
                        className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
                      >
                        {isEditingBets ? 'View' : 'Edit'}
                      </button>
                    )}
                  </div>
                  {betsForSection.length > 0 ? (
                    <div className="space-y-3">
                      {betsForSection.map((bet) => {
                        const isSelected = profileDisplay.bets.includes(bet.id);
                        const isClickable = isOwnProfile && isEditingBets;
                        const fade = fadeEligibility(bet);
                        const challengerStake = Math.round(bet.stake * (bet.odds - 1) * 100) / 100;
                        return (
                        <div
                          key={bet.id}
                          className={`rounded-xl border ${
                            isSelected
                              ? 'border-blue-500/60 bg-blue-500/10'
                              : 'border-slate-700 bg-slate-900/60'
                          }`}
                        >
                        <button
                          type="button"
                          onClick={isClickable ? () => toggleBet(bet.id) : undefined}
                          disabled={!isClickable}
                          className={`w-full px-4 py-3 text-left transition-colors ${
                            isClickable ? 'cursor-pointer hover:border-blue-400/70' : 'cursor-default'
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
                              {isClickable && isSelected && <Check size={16} className="text-blue-300" />}
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
                    <div className="py-8 text-center border border-dashed border-slate-700 rounded-xl">
                      <Target className="mx-auto text-slate-600 mb-3" size={48} />
                      <p className="text-slate-500 font-medium">No featured bets to show yet</p>
                      <p className="text-sm text-slate-600 mt-1">
                        {isOwnProfile && isEditingBets
                          ? 'Place a few bets to choose which ones appear here.'
                          : 'Once bets are placed, they can appear here on the account page.'}
                      </p>
                    </div>
                  )}
                  {isOwnProfile && !isEditingBets && betsForSection.length === 0 && recentBets.length > 0 && (
                    <p className="mt-4 text-sm text-slate-500">
                      No featured bets are public yet. Switch to Edit to choose which bets to show.
                    </p>
                  )}
                </section>
              )}
            </div>
          )}
        </div>

      </div>
      {counterBetTarget && currentUserId && (
        <CounterBetModal
          bet={counterBetTarget}
          ownerName={displayName}
          balance={balance}
          onConfirm={(originalBetId) => proposeHeadToHead(originalBetId, currentUserId)}
          onClose={() => setCounterBetTarget(null)}
        />
      )}
    </div>
  );
};
