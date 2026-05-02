import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  User,
  Bell,
  Shield,
  Palette,
  Sun,
  Moon,
  Wallet,
  Lock,
  Globe,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Mail,
  Check,
} from 'lucide-react';
import { getSpendingLimits, setSpendingLimits, SpendingLimits } from '@/services/dbOps.ts';
import { sendPasswordResetEmail } from 'firebase/auth';
import { getAuth } from 'firebase/auth';
import { APP } from '@/models/constants.ts';

import type { UserThemeMode } from '@/services/dbOps';

interface SettingsViewProps {
  userEmail: string;
  embedded?: boolean;
  themeMode: UserThemeMode;
  themeSaving: boolean;
  onThemeModeChange: (mode: UserThemeMode) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ userEmail, embedded = false }) => {
  const [limitsExpanded, setLimitsExpanded] = useState(false);
  const [limits, setLimits]                 = useState<SpendingLimits | null>(null);
  const [dailyInput, setDailyInput]         = useState('');
  const [weeklyInput, setWeeklyInput]       = useState('');
  const [saving, setSaving]                 = useState(false);
  const [saved, setSaved]                   = useState(false);
  const [inputError, setInputError]         = useState<string | null>(null);
  const [resetSent, setResetSent]           = useState(false);
  const [resetError, setResetError]         = useState<string | null>(null);

  const uid = localStorage.getItem('uid') ?? '';

  useEffect(() => {
    if (!limitsExpanded || !uid) return;
    getSpendingLimits(uid).then((l) => {
      setLimits(l);
      setDailyInput(l.daily  != null ? String(l.daily)  : '');
      setWeeklyInput(l.weekly != null ? String(l.weekly) : '');
    });
  }, [limitsExpanded, uid]);

  const handleSaveLimits = async () => {
    if (!uid) return;
    setInputError(null);

    const daily  = dailyInput.trim()  === '' ? null : Number(dailyInput);
    const weekly = weeklyInput.trim() === '' ? null : Number(weeklyInput);

    if (daily  != null && (!Number.isFinite(daily)  || daily  <= 0)) {
      setInputError('Daily limit must be a positive number.');
      return;
    }
    if (weekly != null && (!Number.isFinite(weekly) || weekly <= 0)) {
      setInputError('Weekly limit must be a positive number.');
      return;
    }
    if (daily != null && weekly != null && daily > weekly) {
      setInputError('Daily limit cannot exceed weekly limit.');
      return;
    }

    setSaving(true);
    await setSpendingLimits(uid, daily, weekly);
    setLimits(prev => prev ? { ...prev, daily, weekly } : prev);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handlePasswordReset = async () => {
    setResetError(null);
    try {
      await sendPasswordResetEmail(getAuth(), userEmail);
      setResetSent(true);
      setTimeout(() => setResetSent(false), 4000);
    } catch (e) {
      setResetError('Failed to send reset email. Try again.');
      setTimeout(() => setResetError(null), 4000);
    }
  };

  const formatSpent = (spent: number, limit: number | null) => {
    if (limit == null) return null;
    return `$${spent.toFixed(0)} of $${limit.toFixed(0)} spent`;
  };
export const SettingsView: React.FC<SettingsViewProps> = ({
  userEmail,
  embedded = false,
  themeMode,
  themeSaving,
  onThemeModeChange,
}) => {
  const isLightMode = themeMode === 'light';

  return (
      <div className="animate-in fade-in duration-500 max-w-2xl">
        {!embedded && (
            <NavLink
                to="/profile"
                className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 mb-6 transition-colors"
            >
              <ChevronLeft size={18} /> Back to account
            </NavLink>
        )}
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <User className="text-blue-400" size={24} /> Settings
        </h2>
        <p className="text-slate-400 mb-8">Manage your account and preferences.</p>

        <div className="space-y-4">

          {/* Account */}
          <section className="glass-card rounded-2xl border-slate-800 overflow-hidden">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider px-6 py-3 border-b border-slate-800 flex items-center gap-2">
              <User size={14} /> Account
            </h3>
            <div className="divide-y divide-slate-800">
              <button className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center gap-3">
                  <Mail className="text-slate-500" size={18} />
                  <div>
                    <p className="font-medium text-slate-200">Email</p>
                    <p className="text-xs text-slate-500">{userEmail}</p>
                  </div>
                </div>
                <ChevronRight className="text-slate-500" size={18} />
              </button>

              {/* Password reset */}
              <button
                  onClick={handlePasswordReset}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Lock className="text-slate-500" size={18} />
                  <div>
                    <p className="font-medium text-slate-200">Password</p>
                    <p className={`text-xs ${resetSent ? 'text-emerald-400' : resetError ? 'text-red-400' : 'text-slate-500'}`}>
                      {resetSent
                          ? '✓ Reset email sent — check your inbox'
                          : resetError
                              ? resetError
                              : 'Send a password reset email'}
                    </p>
                  </div>
                </div>
                {resetSent
                    ? <Check className="text-emerald-400" size={18} />
                    : <ChevronRight className="text-slate-500" size={18} />
                }
              </button>
            </div>
          </section>

          {/* Notifications */}
          <section className="glass-card rounded-2xl border-slate-800 overflow-hidden">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider px-6 py-3 border-b border-slate-800 flex items-center gap-2">
              <Bell size={14} /> Notifications
            </h3>
            <div className="divide-y divide-slate-800">
              <div className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-200">Bet results</p>
                  <p className="text-xs text-slate-500">When your bets settle</p>
                </div>
                <div className="w-10 h-5 bg-blue-600 rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full shadow" />
                </div>
              </div>
              <div className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-200">Promotions</p>
                  <p className="text-xs text-slate-500">Bonuses and offers</p>
                </div>
                <div className="w-10 h-5 bg-slate-600 rounded-full relative cursor-pointer">
                  <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full shadow" />
                </div>
              </div>
              <div className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-200">Social & challenges</p>
                  <p className="text-xs text-slate-500">Friend activity and challenges</p>
                </div>
                <div className="w-10 h-5 bg-blue-600 rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full shadow" />
                </div>
              <ChevronRight className="text-slate-500" size={18} />
            </button>
            <div className="w-full px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Palette className="text-slate-500" size={18} />
                <div>
                  <p className="font-medium text-slate-200">Preferences - Light mode</p>
                  <p className="text-xs text-slate-500">Switch between Ocean and Light theme.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onThemeModeChange(isLightMode ? 'ocean' : 'light')}
                disabled={themeSaving}
                className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
                  isLightMode ? 'bg-amber-500' : 'bg-blue-600'
                } ${themeSaving ? 'cursor-wait opacity-70' : 'cursor-pointer'}`}
                aria-pressed={isLightMode}
                aria-label="Toggle light mode"
              >
                <span
                  className={`absolute inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-700 shadow transition-transform ${
                    isLightMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                >
                  {isLightMode ? <Sun size={12} /> : <Moon size={12} />}
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="glass-card rounded-2xl border-slate-800 overflow-hidden">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider px-6 py-3 border-b border-slate-800 flex items-center gap-2">
            <Bell size={14} /> Notifications
          </h3>
          <div className="divide-y divide-slate-800">
            <div className="px-6 py-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-200">Bet results</p>
                <p className="text-xs text-slate-500">When your bets settle</p>
              </div>
              <div className="w-10 h-5 bg-blue-600 rounded-full relative cursor-pointer">
                <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full shadow" />
              </div>
            </div>
            <div className="px-6 py-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-200">Promotions</p>
                <p className="text-xs text-slate-500">Bonuses and offers</p>
              </div>
              <div className="w-10 h-5 bg-slate-600 rounded-full relative cursor-pointer">
                <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full shadow" />
              </div>
            </div>
            <div className="px-6 py-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-200">Social & challenges</p>
                <p className="text-xs text-slate-500">Friend activity and challenges</p>
              </div>
              <div className="w-10 h-5 bg-blue-600 rounded-full relative cursor-pointer">
                <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full shadow" />
              </div>
            </div>
          </section>

          {/* Responsible gambling */}
          <section className="glass-card rounded-2xl border-slate-800 overflow-hidden">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider px-6 py-3 border-b border-slate-800 flex items-center gap-2">
              <Wallet size={14} /> Responsible Gambling
            </h3>
            <div className="divide-y divide-slate-800">

              {/* Spending Limits — expandable */}
              <div>
                <button
                    onClick={() => setLimitsExpanded(prev => !prev)}
                    className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
                >
                  <div>
                    <p className="font-medium text-slate-200">Spending limits</p>
                    <p className="text-xs text-slate-500">
                      {limits?.daily != null || limits?.weekly != null
                          ? [
                            limits?.daily  != null ? `Daily $${limits.daily}`  : null,
                            limits?.weekly != null ? `Weekly $${limits.weekly}` : null,
                          ].filter(Boolean).join(' · ')
                          : 'Set daily or weekly limits'}
                    </p>
                  </div>
                  {limitsExpanded
                      ? <ChevronUp className="text-slate-500" size={18} />
                      : <ChevronDown className="text-slate-500" size={18} />
                  }
                </button>

                {limitsExpanded && (
                    <div className="px-6 pb-5 space-y-4 bg-slate-900/30">
                      <p className="text-xs text-slate-500 pt-1">
                        Bets will be blocked once you hit your limit. Free bets don't count.
                        Leave a field blank to remove that limit.
                      </p>

                      {/* Daily limit */}
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                          Daily limit
                        </label>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 flex-1">
                            <span className="text-slate-400 text-sm mr-1">$</span>
                            <input
                                type="text"
                                inputMode="decimal"
                                placeholder="No limit"
                                value={dailyInput}
                                onChange={e => {
                                  setDailyInput(e.target.value.replace(/[^\d.]/g, ''));
                                  setInputError(null);
                                }}
                                className="bg-transparent text-sm font-semibold text-slate-100 outline-none w-full placeholder:text-slate-600"
                            />
                          </div>
                          {limits?.daily != null && (
                              <span className="text-[10px] text-slate-500 whitespace-nowrap">
                                {formatSpent(limits.dailySpent, limits.daily)}
                              </span>
                          )}
                        </div>
                      </div>

                      {/* Weekly limit */}
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                          Weekly limit
                        </label>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 flex-1">
                            <span className="text-slate-400 text-sm mr-1">$</span>
                            <input
                                type="text"
                                inputMode="decimal"
                                placeholder="No limit"
                                value={weeklyInput}
                                onChange={e => {
                                  setWeeklyInput(e.target.value.replace(/[^\d.]/g, ''));
                                  setInputError(null);
                                }}
                                className="bg-transparent text-sm font-semibold text-slate-100 outline-none w-full placeholder:text-slate-600"
                            />
                          </div>
                          {limits?.weekly != null && (
                              <span className="text-[10px] text-slate-500 whitespace-nowrap">
                                {formatSpent(limits.weeklySpent, limits.weekly)}
                              </span>
                          )}
                        </div>
                      </div>

                      {inputError && (
                          <p className="text-xs text-red-400">{inputError}</p>
                      )}

                      <button
                          onClick={handleSaveLimits}
                          disabled={saving}
                          className={`w-full py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-all active:scale-95 flex items-center justify-center gap-2 ${
                              saved
                                  ? 'bg-emerald-600 text-white'
                                  : saving
                                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                          }`}
                      >
                        {saved ? <><Check size={14} /> Saved</> : saving ? 'Saving...' : 'Save limits'}
                      </button>
                    </div>
                )}
              </div>

              <button className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors">
                <div>
                  <p className="font-medium text-slate-200">Session reminder</p>
                  <p className="text-xs text-slate-500">Get reminded after a set time</p>
                </div>
                <ChevronRight className="text-slate-500" size={18} />
              </button>
              <button className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors">
                <div>
                  <p className="font-medium text-slate-200">Self-exclusion</p>
                  <p className="text-xs text-slate-500">Take a break from betting</p>
                </div>
                <ChevronRight className="text-slate-500" size={18} />
              </button>
            </div>
          </section>

          {/* Privacy & preferences */}
          <section className="glass-card rounded-2xl border-slate-800 overflow-hidden">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider px-6 py-3 border-b border-slate-800 flex items-center gap-2">
              <Shield size={14} /> Privacy & preferences
            </h3>
            <div className="divide-y divide-slate-800">
              <div className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-200">Show activity to friends</p>
                  <p className="text-xs text-slate-500">Your bets visible on social feed</p>
                </div>
                <div className="w-10 h-5 bg-blue-600 rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full shadow" />
                </div>
              </div>
              <button className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center gap-3">
                  <Globe className="text-slate-500" size={18} />
                  <div>
                    <p className="font-medium text-slate-200">Currency & language</p>
                    <p className="text-xs text-slate-500">USD • English</p>
                  </div>
                </div>
                <ChevronRight className="text-slate-500" size={18} />
              </button>
            </div>
          </section>

        </div>
      </div>
  );
};