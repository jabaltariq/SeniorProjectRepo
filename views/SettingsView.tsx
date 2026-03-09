import React from 'react';
import {
  User,
  Bell,
  Shield,
  Wallet,
  Lock,
  Globe,
  ChevronRight,
  Mail,
} from 'lucide-react';

interface SettingsViewProps {
  userEmail: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ userEmail }) => {
  return (
    <div className="animate-in fade-in duration-500 max-w-2xl">
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
            <button className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors">
              <div className="flex items-center gap-3">
                <Lock className="text-slate-500" size={18} />
                <div>
                  <p className="font-medium text-slate-200">Password</p>
                  <p className="text-xs text-slate-500">Change your password</p>
                </div>
              </div>
              <ChevronRight className="text-slate-500" size={18} />
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
            </div>
          </div>
        </section>

        {/* Responsible gambling */}
        <section className="glass-card rounded-2xl border-slate-800 overflow-hidden">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider px-6 py-3 border-b border-slate-800 flex items-center gap-2">
            <Wallet size={14} /> Responsible gambling
          </h3>
          <div className="divide-y divide-slate-800">
            <button className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors">
              <div>
                <p className="font-medium text-slate-200">Deposit limit</p>
                <p className="text-xs text-slate-500">Set daily or weekly limits</p>
              </div>
              <ChevronRight className="text-slate-500" size={18} />
            </button>
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
