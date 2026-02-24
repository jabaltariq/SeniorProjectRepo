import React from 'react';
import {
  Trophy,
  Flame,
  DollarSign,
  Settings,
  Award,
  ChevronRight,
} from 'lucide-react';

/** Mock profile data for frontend until backend is ready */
export interface MockProfileData {
  displayName: string;
  initials: string;
  bio: string;
  streak: number;
  biggestBet: {
    description: string;
    amount: string;
    odds: string;
    payout: string;
  } | null;
  achievements: { id: string; title: string; description: string; unlocked: boolean }[];
}

const MOCK_PROFILE: MockProfileData = {
  displayName: 'Player',
  initials: 'PL',
  bio: 'example of bio here',
  streak: 0,
  biggestBet: null,
  achievements: [
    { id: '1', title: 'First bet', description: 'Place your first bet', unlocked: false },
    { id: '2', title: 'Hot streak', description: 'Win 3 bets in a row', unlocked: false },
    { id: '3', title: 'High roller', description: 'Place a bet over $100', unlocked: false },
    { id: '4', title: 'Social butterfly', description: 'Add 5 friends', unlocked: false },
  ],
};

interface ProfileViewProps {
  userInitials: string;
  userEmail: string;
  isOwnProfile: boolean;
  onOpenSettings?: () => void;
  /** Optional override for viewing another user (future); omit for self */
  profile?: MockProfileData | null;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  userInitials,
  userEmail,
  isOwnProfile,
  onOpenSettings,
  profile: profileOverride,
}) => {
  const profile: MockProfileData = profileOverride ?? {
    ...MOCK_PROFILE,
    initials: userInitials,
    displayName: userEmail?.split('@')[0] ?? 'Player',
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-2xl mx-auto">
      {/* Header: title + settings (own profile only) */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold">Profile</h2>
        {isOwnProfile && onOpenSettings && (
          <button
            title="Settings"
            onClick={onOpenSettings}
            className="p-3 rounded-xl text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-all"
          >
            <Settings size={24} />
          </button>
        )}
      </div>

      {/* Center: profile image + name */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-28 h-28 rounded-full bg-slate-700 border-4 border-slate-600 flex items-center justify-center text-3xl font-black text-slate-300 shadow-lg">
          {profile.initials}
        </div>
        <h3 className="text-xl font-bold mt-4 text-slate-100">{profile.displayName}</h3>
        {isOwnProfile && (
          <p className="text-sm text-slate-500 mt-1">{userEmail}</p>
        )}
      </div>

      {/* Bio */}
      <section className="glass-card rounded-2xl p-6 border-slate-800 mb-6">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Bio</h4>
        <p className="text-slate-300 text-sm leading-relaxed">
          {profile.bio || 'No bio yet.'}
        </p>
      </section>

      {/* Stats row: streak + biggest bet */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="glass-card rounded-2xl p-6 border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="text-amber-400" size={18} />
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Streak</h4>
          </div>
          <p className="text-2xl font-black text-slate-100">{profile.streak}</p>
          <p className="text-xs text-slate-500 mt-1">consecutive wins</p>
        </div>
        <div className="glass-card rounded-2xl p-6 border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="text-green-400" size={18} />
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Biggest bet</h4>
          </div>
          {profile.biggestBet ? (
            <>
              <p className="text-sm font-bold text-slate-200">{profile.biggestBet.description}</p>
              <p className="text-xs text-slate-500 mt-1">
                ${profile.biggestBet.amount} @ {profile.biggestBet.odds} → ${profile.biggestBet.payout}
              </p>
            </>
          ) : (
            <p className="text-slate-500 text-sm">No big hit yet</p>
          )}
        </div>
      </div>

      {/* Achievements */}
      <section className="glass-card rounded-2xl border-slate-800 overflow-hidden">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-6 py-3 border-b border-slate-800 flex items-center gap-2">
          <Award size={14} /> Achievements
        </h4>
        <div className="divide-y divide-slate-800">
          {profile.achievements.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <Trophy className="mx-auto text-slate-600 mb-2" size={32} />
              <p className="text-slate-500 text-sm">No achievements yet. Place bets and hit streaks to unlock.</p>
            </div>
          ) : (
            profile.achievements.map((a) => (
              <div
                key={a.id}
                className={`px-6 py-4 flex items-center justify-between ${!a.unlocked ? 'opacity-70' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${a.unlocked ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-500'}`}>
                    <Trophy size={18} />
                  </div>
                  <div>
                    <p className="font-medium text-slate-200">{a.title}</p>
                    <p className="text-xs text-slate-500">{a.description}</p>
                  </div>
                </div>
                <ChevronRight className="text-slate-500 shrink-0" size={18} />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};
