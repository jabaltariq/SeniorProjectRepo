import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  User,
  Settings,
  Trophy,
  BarChart3,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Wallet,
  Target,
  Clock3,
  Check,
} from 'lucide-react';
import {
  getAccountProfile,
  getBets,
  getAchievementDefinitions,
  setAccountDisplay,
  setUnlockedAchievements,
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
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  userInitials,
  userEmail,
  balance,
  activeBetsCount,
  currentUserId,
}) => {
  const { userId: routeUserId } = useParams<{ userId?: string }>();
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
  const [showCustomize, setShowCustomize] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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
  const displayedAchievements = achievementCards.filter(
    (card) => unlockedAchievementIds.includes(card.id) && profileDisplay.achievements.includes(card.id)
  );
  const displayedBets = recentBets.filter((bet) => profileDisplay.bets.includes(bet.id));

  return (
    <div className="animate-in fade-in duration-500 w-full">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-slate-700 border-2 border-slate-600 flex items-center justify-center">
            <span className="text-2xl font-bold text-blue-400">{avatarText}</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{isOwnProfile ? 'Account' : `${displayName}'s account`}</h2>
            <p className="text-slate-400 text-sm">{isOwnProfile ? userEmail : `${displayName} on BetHub`}</p>
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
          <SettingsView userEmail={userEmail} embedded />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {loading ? (
            <div className="glass-card rounded-2xl p-10 border-slate-800 text-center text-slate-400">
              Loading account...
            </div>
          ) : (
            <div className="space-y-6">
              {displayedStats.length > 0 && (
                <section className="glass-card rounded-2xl p-6 border-slate-800">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-400">
                    <BarChart3 size={20} /> Stats
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {displayedStats.map((card) => (
                      <div key={card.id} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">{card.label}</p>
                        <p className={`text-xl font-bold ${card.tone}`}>{card.value}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {displayedAchievements.length > 0 && (
                <section className="glass-card rounded-2xl p-6 border-slate-800">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-400">
                    <Trophy size={20} /> Achievements
                  </h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    {displayedAchievements.map((achievement) => (
                      <div
                        key={achievement.id}
                        className={`rounded-xl border p-4 ${
                          achievement.unlocked
                            ? 'border-amber-400/30 bg-amber-500/10'
                            : 'border-slate-700 bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Trophy
                            size={18}
                            className={achievement.unlocked ? 'text-amber-300' : 'text-slate-500'}
                          />
                          <p className="font-semibold text-slate-100">{achievement.title}</p>
                        </div>
                        <p className="text-sm text-slate-400">{achievement.detail}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {displayedBets.length > 0 && (
                <section className="glass-card rounded-2xl p-6 border-slate-800">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-400">
                    <Target size={20} /> Featured Bets
                  </h3>
                  {displayedBets.length > 0 ? (
                    <div className="space-y-3">
                      {displayedBets.map((bet) => (
                        <div
                          key={bet.id}
                          className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-semibold text-slate-100">{bet.marketTitle}</p>
                              <p className="text-sm text-slate-400">{bet.optionLabel}</p>
                            </div>
                            <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-300">
                              {(bet.status ?? 'PENDING').toLowerCase()}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
                            <span className="inline-flex items-center gap-1"><Wallet size={12} /> ${bet.stake.toLocaleString()} stake</span>
                            <span className="inline-flex items-center gap-1"><Target size={12} /> {bet.odds.toFixed(2)} odds</span>
                            <span className="inline-flex items-center gap-1"><Clock3 size={12} /> {bet.placedAt.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center border border-dashed border-slate-700 rounded-xl">
                      <Target className="mx-auto text-slate-600 mb-3" size={48} />
                      <p className="text-slate-500 font-medium">No featured bets to show yet</p>
                      <p className="text-sm text-slate-600 mt-1">Once bets are placed, they can appear here on the account page.</p>
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="glass-card rounded-2xl p-5 border-slate-800">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              {isOwnProfile ? 'Public account display' : 'Visible on this account'}
            </p>
            <p className="text-sm text-slate-400">
              {isOwnProfile
                ? 'Choose which sections other BetHub users can see when they open your account page.'
                : `${displayName} controls which account sections are public.`}
            </p>
          </div>

          {isOwnProfile && (
            <div className="glass-card rounded-2xl p-5 border-slate-800">
              <button
                onClick={() => setShowCustomize(!showCustomize)}
                className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                <LayoutGrid size={18} />
                Customize public account
                {showCustomize ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {showCustomize && (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-3">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Stats</p>
                    <div className="space-y-2">
                      {statCards.map((card) => (
                        <label
                          key={card.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2 cursor-pointer text-slate-200"
                        >
                          <span>{card.label}</span>
                          <input
                            type="checkbox"
                            checked={profileDisplay.stats.includes(card.id)}
                            onChange={() => toggleStat(card.id)}
                            className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-3">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Achievements</p>
                    <div className="space-y-2">
                      {achievementCards
                        .filter((achievement) => unlockedAchievementIds.includes(achievement.id))
                        .map((achievement) => (
                        <label
                          key={achievement.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2 cursor-pointer text-slate-200"
                        >
                          <span>{achievement.title}</span>
                          <input
                            type="checkbox"
                            checked={profileDisplay.achievements.includes(achievement.id)}
                            onChange={() => toggleAchievement(achievement.id)}
                            className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                          />
                        </label>
                      ))}
                      {unlockedAchievementIds.length === 0 && (
                        <p className="text-sm text-slate-500">Unlocked achievements will appear here once you earn them.</p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-3">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Featured Bets</p>
                    <div className="space-y-2">
                      {recentBets.length > 0 ? recentBets.map((bet) => (
                        <button
                          key={bet.id}
                          type="button"
                          onClick={() => toggleBet(bet.id)}
                          className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left ${
                            profileDisplay.bets.includes(bet.id)
                              ? 'border-blue-500/60 bg-blue-500/10 text-slate-100'
                              : 'border-slate-700 bg-slate-800/40 text-slate-300'
                          }`}
                        >
                          <div>
                            <p className="text-sm font-medium">{bet.marketTitle}</p>
                            <p className="text-xs text-slate-400">{bet.optionLabel}</p>
                          </div>
                          {profileDisplay.bets.includes(bet.id) && <Check size={16} className="text-blue-300" />}
                        </button>
                      )) : (
                        <p className="text-sm text-slate-500">Place a few bets to choose which ones appear here.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
