import React, { useState, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import {
  User,
  Settings,
  Trophy,
  BarChart3,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
} from 'lucide-react';

const PROFILE_SECTIONS_KEY = 'bethub_profile_sections';

type ProfileSection = 'achievements' | 'stats' | 'activity';

const DEFAULT_SECTIONS: ProfileSection[] = ['stats', 'achievements', 'activity'];

function getStoredSections(): ProfileSection[] {
  try {
    const stored = localStorage.getItem(PROFILE_SECTIONS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ProfileSection[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_SECTIONS;
}

function setStoredSections(sections: ProfileSection[]) {
  localStorage.setItem(PROFILE_SECTIONS_KEY, JSON.stringify(sections));
}

interface ProfileViewProps {
  userInitials: string;
  userEmail: string;
  balance: number;
  activeBetsCount: number;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  userInitials,
  userEmail,
  balance,
  activeBetsCount,
}) => {
  const [visibleSections, setVisibleSections] = useState<ProfileSection[]>(getStoredSections);
  const [showCustomize, setShowCustomize] = useState(false);

  const toggleSection = useCallback((section: ProfileSection) => {
    setVisibleSections((prev) => {
      const next = prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section];
      setStoredSections(next);
      return next;
    });
  }, []);

  const isVisible = (s: ProfileSection) => visibleSections.includes(s);

  return (
    <div className="animate-in fade-in duration-500 w-full">
      {/* Header with cog in top right */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-slate-700 border-2 border-slate-600 flex items-center justify-center">
            <span className="text-2xl font-bold text-blue-400">{userInitials}</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Profile</h2>
            <p className="text-slate-400 text-sm">{userEmail}</p>
          </div>
        </div>
        <NavLink
          to="/settings"
          className="p-3 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-slate-600 transition-all self-start shrink-0"
          title="Settings"
        >
          <Settings className="text-slate-400 hover:text-slate-200" size={24} />
        </NavLink>
      </div>

      {/* Customize display */}
      <div className="mb-8">
        <button
          onClick={() => setShowCustomize(!showCustomize)}
          className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          <LayoutGrid size={18} />
          Customize what you see
          {showCustomize ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {showCustomize && (
          <div className="mt-4 p-4 rounded-2xl bg-slate-800/50 border border-slate-700 space-y-3">
            {(['achievements', 'stats', 'activity'] as const).map((section) => (
              <label
                key={section}
                className="flex items-center gap-3 cursor-pointer text-slate-200"
              >
                <input
                  type="checkbox"
                  checked={isVisible(section)}
                  onChange={() => toggleSection(section)}
                  className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                />
                <span className="capitalize">{section}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {isVisible('stats') && (
          <section className="glass-card rounded-2xl p-6 border-slate-800">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-400">
              <BarChart3 size={20} /> Stats
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Balance</p>
                <p className="text-xl font-black text-green-400">${balance.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Active Bets</p>
                <p className="text-xl font-bold text-slate-200">{activeBetsCount}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Total Bets</p>
                <p className="text-xl font-bold text-slate-200">—</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Win Rate</p>
                <p className="text-xl font-bold text-slate-200">—</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">More stats coming as we track them.</p>
          </section>
        )}

        {isVisible('achievements') && (
          <section className="glass-card rounded-2xl p-6 border-slate-800">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-400">
              <Trophy size={20} /> Achievements
            </h3>
            <div className="py-8 text-center border border-dashed border-slate-700 rounded-xl">
              <Trophy className="mx-auto text-slate-600 mb-3" size={48} />
              <p className="text-slate-500 font-medium">Achievements coming soon</p>
              <p className="text-sm text-slate-600 mt-1">Earn badges and milestones as you bet.</p>
            </div>
          </section>
        )}

        {isVisible('activity') && (
          <section className="glass-card rounded-2xl p-6 border-slate-800">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-400">
              <BarChart3 size={20} /> Recent Activity
            </h3>
            <div className="py-8 text-center border border-dashed border-slate-700 rounded-xl">
              <User className="mx-auto text-slate-600 mb-3" size={48} />
              <p className="text-slate-500 font-medium">Activity feed coming soon</p>
              <p className="text-sm text-slate-600 mt-1">Your recent bets and results.</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
