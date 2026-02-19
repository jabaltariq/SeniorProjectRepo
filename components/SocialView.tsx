
import React from 'react';
import { Friend, SocialActivity } from '../models';
import { Users, Activity, Swords, Circle, ShieldCheck, ShieldOff } from 'lucide-react';

interface SocialViewProps {
  friends: Friend[];
  activities: SocialActivity[];
  onChallenge: (friend: Friend) => void;
}

export const SocialView: React.FC<SocialViewProps> = ({ friends, activities, onChallenge }) => {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* Friends List */}
      <div className="xl:col-span-1 space-y-6">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Users className="text-blue-400" size={28} /> Friends
          </h2>
          <p className="text-slate-400">Connect and compete.</p>
        </div>

        <div className="space-y-3">
          {friends.map(friend => (
            <div key={friend.id} className="glass-card rounded-2xl p-4 flex items-center justify-between border-slate-800 group hover:border-blue-500/30 transition-all">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-blue-400">
                    {friend.avatar}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-900 ${
                    friend.status === 'online' ? 'bg-green-500' : friend.status === 'away' ? 'bg-yellow-500' : 'bg-slate-600'
                  }`} />
                </div>
                <div>
                  <p className="font-bold text-slate-200">{friend.name}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">{friend.status} • {friend.lastActive}</p>
                </div>
              </div>
              <button 
                onClick={() => onChallenge(friend)}
                className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] font-bold uppercase"
              >
                <Swords size={14} /> Challenge
              </button>
            </div>
          ))}
          <button className="w-full py-3 rounded-2xl border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-all text-xs font-bold uppercase tracking-widest">
            + Add Friend
          </button>
        </div>

        <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-indigo-400 uppercase flex items-center gap-1">
              <ShieldCheck size={12} /> Privacy Settings
            </p>
            <div className="w-8 h-4 bg-indigo-600 rounded-full relative cursor-pointer">
              <div className="absolute right-1 top-1 w-2 h-2 bg-white rounded-full" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500">Your betting activity is currently visible to friends.</p>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="xl:col-span-2 space-y-6">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Activity className="text-green-400" size={28} /> Activity Feed
          </h2>
          <p className="text-slate-400">Real-time pulses from the community.</p>
        </div>

        <div className="space-y-4">
          {activities.map(activity => (
            <div key={activity.id} className="glass-card rounded-2xl p-4 flex gap-4 border-slate-800 hover:bg-slate-800/20 transition-all">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex-shrink-0 flex items-center justify-center font-bold text-slate-400">
                {activity.userAvatar}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <p className="text-sm">
                    <span className="font-bold text-slate-100">{activity.userName}</span>{' '}
                    <span className="text-slate-400">{activity.action}</span>{' '}
                    <span className="font-bold text-blue-400">{activity.target}</span>
                  </p>
                  <span className="text-[10px] text-slate-600 font-bold uppercase">{activity.timestamp}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button className="text-[10px] font-bold text-slate-500 hover:text-slate-300 flex items-center gap-1 uppercase tracking-tighter">
                    <Activity size={12} /> View Bet
                  </button>
                  <button className="text-[10px] font-bold text-slate-500 hover:text-blue-400 flex items-center gap-1 uppercase tracking-tighter">
                    <Swords size={12} /> Counter-Bet
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
