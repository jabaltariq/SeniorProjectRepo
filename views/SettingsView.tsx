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
  Clock,
  Ban,
} from 'lucide-react';
import { getSpendingLimits, setSpendingLimits, SpendingLimits } from '@/services/dbOps.ts';
import { sendPasswordResetEmail, getAuth } from 'firebase/auth';
import type { UserThemeMode } from '@/services/dbOps';

interface SettingsViewProps {
  userEmail: string;
  embedded?: boolean;
  themeMode: UserThemeMode;
  themeSaving: boolean;
  onThemeModeChange: (mode: UserThemeMode) => void;
}

const RowIcon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800/40 text-slate-400 ring-1 ring-white/[0.04]">
    {children}
  </span>
);

export const SettingsView: React.FC<SettingsViewProps> = ({
  userEmail,
  embedded = false,
  themeMode,
  themeSaving,
  onThemeModeChange,
}) => {
  const [limitsExpanded, setLimitsExpanded] = useState(false);
  const [limits, setLimits] = useState<SpendingLimits | null>(null);
  const [dailyInput, setDailyInput] = useState('');
  const [weeklyInput, setWeeklyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const uid = localStorage.getItem('uid') ?? '';
  const isLightMode = themeMode === 'light';

  useEffect(() => {
    if (!limitsExpanded || !uid) return;
    getSpendingLimits(uid).then((l) => {
      setLimits(l);
      setDailyInput(l.daily != null ? String(l.daily) : '');
      setWeeklyInput(l.weekly != null ? String(l.weekly) : '');
    });
  }, [limitsExpanded, uid]);

  const handleSaveLimits = async () => {
    if (!uid) return;
    setInputError(null);
    const daily = dailyInput.trim() === '' ? null : Number(dailyInput);
    const weekly = weeklyInput.trim() === '' ? null : Number(weeklyInput);
    if (daily != null && (!Number.isFinite(daily) || daily <= 0)) {
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
    setLimits((prev) => (prev ? { ...prev, daily, weekly } : prev));
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

  const sectionShell = 'rounded-2xl border border-slate-800/50 bg-slate-950/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] overflow-hidden';
  const rowBase =
    'w-full flex items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03] sm:px-5 sm:py-4';
  const rowDivider = 'border-t border-slate-800/40';

  return (
    <div className={`animate-in fade-in duration-500 ${embedded ? 'max-w-xl' : 'max-w-2xl'}`}>
      {!embedded && (
        <NavLink
          to="/profile"
          className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-300"
        >
          <ChevronLeft size={16} strokeWidth={2} />
          Back to account
        </NavLink>
      )}

      <header className="mb-10 border-b border-slate-800/60 pb-8">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20">
            <User size={20} strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">Settings</h2>
            <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-500">
              Manage your account and preferences.
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-10">
        {/* Account */}
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            <User size={12} className="text-slate-600" aria-hidden />
            Account
          </h3>
          <div className={sectionShell}>
            <button type="button" className={rowBase}>
              <RowIcon>
                <Mail size={18} strokeWidth={2} />
              </RowIcon>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-200">Email</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{userEmail}</p>
              </div>
              <ChevronRight className="shrink-0 text-slate-600" size={18} strokeWidth={2} />
            </button>

            <button type="button" onClick={handlePasswordReset} className={`${rowBase} ${rowDivider}`}>
              <RowIcon>
                <Lock size={18} strokeWidth={2} />
              </RowIcon>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-200">Password</p>
                <p
                  className={`mt-0.5 text-xs leading-snug ${
                    resetSent ? 'text-emerald-400/90' : resetError ? 'text-red-400/90' : 'text-slate-500'
                  }`}
                >
                  {resetSent ? '✓ Reset email sent — check your inbox' : resetError ?? 'Send a password reset email'}
                </p>
              </div>
              {resetSent ? (
                <Check className="shrink-0 text-emerald-400" size={18} strokeWidth={2} />
              ) : (
                <ChevronRight className="shrink-0 text-slate-600" size={18} strokeWidth={2} />
              )}
            </button>

            <div className={`${rowBase} ${rowDivider} gap-4`}>
              <RowIcon>
                <Palette size={18} strokeWidth={2} />
              </RowIcon>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-200">Preferences - Light mode</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">Switch between Ocean and Light theme.</p>
              </div>
              <button
                type="button"
                onClick={() => onThemeModeChange(isLightMode ? 'ocean' : 'light')}
                disabled={themeSaving}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                  isLightMode ? 'bg-amber-500/90' : 'bg-blue-600'
                } ${themeSaving ? 'cursor-wait opacity-70' : 'cursor-pointer'}`}
                aria-pressed={isLightMode}
                aria-label="Toggle light mode"
              >
                <span
                  className={`absolute inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-700 shadow-md transition-transform ${
                    isLightMode ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                >
                  {isLightMode ? <Sun size={12} /> : <Moon size={12} />}
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            <Bell size={12} className="text-slate-600" aria-hidden />
            Notifications
          </h3>
          <div className={sectionShell}>
            <div className={rowBase}>
              <div className="min-w-0 flex-1 pl-1 sm:pl-0">
                <p className="text-sm font-medium text-slate-200">Bet results</p>
                <p className="mt-0.5 text-xs text-slate-500">When your bets settle</p>
              </div>
              <div className="relative h-7 w-12 shrink-0 cursor-pointer rounded-full bg-blue-600">
                <div className="absolute right-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-sm ring-1 ring-black/5" />
              </div>
            </div>
            <div className={`${rowBase} ${rowDivider}`}>
              <div className="min-w-0 flex-1 pl-1 sm:pl-0">
                <p className="text-sm font-medium text-slate-200">Promotions</p>
                <p className="mt-0.5 text-xs text-slate-500">Bonuses and offers</p>
              </div>
              <div className="relative h-7 w-12 shrink-0 cursor-pointer rounded-full bg-slate-600">
                <div className="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-sm ring-1 ring-black/5" />
              </div>
            </div>
            <div className={`${rowBase} ${rowDivider}`}>
              <div className="min-w-0 flex-1 pl-1 sm:pl-0">
                <p className="text-sm font-medium text-slate-200">Social & challenges</p>
                <p className="mt-0.5 text-xs text-slate-500">Friend activity and challenges</p>
              </div>
              <div className="relative h-7 w-12 shrink-0 cursor-pointer rounded-full bg-blue-600">
                <div className="absolute right-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-sm ring-1 ring-black/5" />
              </div>
            </div>
          </div>
        </section>

        {/* Responsible Gambling */}
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            <Wallet size={12} className="text-slate-600" aria-hidden />
            Responsible Gambling
          </h3>
          <div className={sectionShell}>
            <div>
              <button
                type="button"
                onClick={() => setLimitsExpanded((prev) => !prev)}
                className={rowBase}
              >
                <RowIcon>
                  <Wallet size={18} strokeWidth={2} />
                </RowIcon>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-200">Spending limits</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                    {limits?.daily != null || limits?.weekly != null
                      ? [limits?.daily != null ? `Daily $${limits.daily}` : null, limits?.weekly != null ? `Weekly $${limits.weekly}` : null]
                          .filter(Boolean)
                          .join(' · ')
                      : 'Set daily or weekly limits'}
                  </p>
                </div>
                {limitsExpanded ? (
                  <ChevronUp className="shrink-0 text-slate-500" size={18} strokeWidth={2} />
                ) : (
                  <ChevronDown className="shrink-0 text-slate-500" size={18} strokeWidth={2} />
                )}
              </button>

              {limitsExpanded && (
                <div className="border-t border-slate-800/40 bg-slate-950/60 px-4 py-5 sm:px-5">
                  <p className="mb-4 text-xs leading-relaxed text-slate-500">
                    Bets will be blocked once you hit your limit. Free bets don&apos;t count. Leave a field blank to
                    remove that limit.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Daily limit
                      </label>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex min-w-0 flex-1 items-center rounded-xl border border-slate-700/80 bg-slate-900/60 px-3 py-2.5 ring-1 ring-white/[0.02]">
                          <span className="mr-1 text-sm text-slate-500">$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="No limit"
                            value={dailyInput}
                            onChange={(e) => {
                              setDailyInput(e.target.value.replace(/[^\d.]/g, ''));
                              setInputError(null);
                            }}
                            className="w-full bg-transparent text-sm font-medium text-slate-100 outline-none placeholder:text-slate-600"
                          />
                        </div>
                        {limits?.daily != null && (
                          <span className="text-[10px] text-slate-500">{formatSpent(limits.dailySpent, limits.daily)}</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Weekly limit
                      </label>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex min-w-0 flex-1 items-center rounded-xl border border-slate-700/80 bg-slate-900/60 px-3 py-2.5 ring-1 ring-white/[0.02]">
                          <span className="mr-1 text-sm text-slate-500">$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="No limit"
                            value={weeklyInput}
                            onChange={(e) => {
                              setWeeklyInput(e.target.value.replace(/[^\d.]/g, ''));
                              setInputError(null);
                            }}
                            className="w-full bg-transparent text-sm font-medium text-slate-100 outline-none placeholder:text-slate-600"
                          />
                        </div>
                        {limits?.weekly != null && (
                          <span className="text-[10px] text-slate-500">{formatSpent(limits.weeklySpent, limits.weekly)}</span>
                        )}
                      </div>
                    </div>
                    {inputError && <p className="text-xs text-red-400/90">{inputError}</p>}
                    <button
                      type="button"
                      onClick={handleSaveLimits}
                      disabled={saving}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold tracking-wide transition-all active:scale-[0.99] ${
                        saved
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
                          : saving
                            ? 'cursor-not-allowed bg-slate-800 text-slate-500'
                            : 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/30 hover:bg-indigo-500'
                      }`}
                    >
                      {saved ? (
                        <>
                          <Check size={16} strokeWidth={2.5} /> Saved
                        </>
                      ) : saving ? (
                        'Saving...'
                      ) : (
                        'Save limits'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button type="button" className={`${rowBase} ${rowDivider}`}>
              <RowIcon>
                <Clock size={18} strokeWidth={2} />
              </RowIcon>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-200">Session reminder</p>
                <p className="mt-0.5 text-xs text-slate-500">Get reminded after a set time</p>
              </div>
              <ChevronRight className="shrink-0 text-slate-600" size={18} strokeWidth={2} />
            </button>
            <button type="button" className={`${rowBase} ${rowDivider}`}>
              <RowIcon>
                <Ban size={18} strokeWidth={2} />
              </RowIcon>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-200">Self-exclusion</p>
                <p className="mt-0.5 text-xs text-slate-500">Take a break from betting</p>
              </div>
              <ChevronRight className="shrink-0 text-slate-600" size={18} strokeWidth={2} />
            </button>
          </div>
        </section>

        {/* Privacy & preferences */}
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            <Shield size={12} className="text-slate-600" aria-hidden />
            Privacy & preferences
          </h3>
          <div className={sectionShell}>
            <div className={rowBase}>
              <div className="min-w-0 flex-1 pl-1 sm:pl-0">
                <p className="text-sm font-medium text-slate-200">Show activity to friends</p>
                <p className="mt-0.5 text-xs text-slate-500">Your bets visible on social feed</p>
              </div>
              <div className="relative h-7 w-12 shrink-0 cursor-pointer rounded-full bg-blue-600">
                <div className="absolute right-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-sm ring-1 ring-black/5" />
              </div>
            </div>
            <button type="button" className={`${rowBase} ${rowDivider}`}>
              <RowIcon>
                <Globe size={18} strokeWidth={2} />
              </RowIcon>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-200">Currency & language</p>
                <p className="mt-0.5 text-xs text-slate-500">USD • English</p>
              </div>
              <ChevronRight className="shrink-0 text-slate-600" size={18} strokeWidth={2} />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
