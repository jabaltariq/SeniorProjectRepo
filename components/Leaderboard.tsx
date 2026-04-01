
import React from 'react';
import { NavLink } from 'react-router-dom';
import { LeaderboardEntry } from '../models';
import { Trophy, TrendingUp, Medal } from 'lucide-react';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ entries }) => {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Trophy className="text-yellow-400" size={28} /> Global Leaderboard
          </h2>
          <p className="text-slate-400">The top net worths in the BetHub arena.</p>
        </div>
        <div className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-widest">
          Season 1
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden border-slate-800">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-900/50 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800">
              <th className="px-6 py-4">Rank</th>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Net Worth</th>
              <th className="px-6 py-4">Win Rate</th>
              <th className="px-6 py-4 text-right">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center">
                  <Trophy className="mx-auto text-slate-600 mb-3" size={40} />
                  <p className="text-slate-300 font-bold text-lg mb-1">No players on the board yet</p>
                  <p className="text-slate-500 text-sm max-w-md mx-auto">
                    Rankings come from your Firestore <code className="text-slate-400">userInfo</code> collection.
                    Create an account (or add documents with <code className="text-slate-400">name</code> and{' '}
                    <code className="text-slate-400">money</code>) to see users here.
                  </p>
                </td>
              </tr>
            ) : (
            entries.map((entry) => (
              <tr 
                key={entry.id} 
                className={`hover:bg-blue-500/5 transition-colors ${entry.isCurrentUser ? 'bg-blue-600/10' : ''}`}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {entry.rank === 1 && <Medal className="text-yellow-400" size={16} />}
                    {entry.rank === 2 && <Medal className="text-slate-300" size={16} />}
                    {entry.rank === 3 && <Medal className="text-amber-600" size={16} />}
                    <span className={`font-bold ${entry.rank <= 3 ? 'text-lg' : 'text-slate-400'}`}>
                      #{entry.rank}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-blue-400">
                      {entry.avatar}
                    </div>
                    <div>
                      <NavLink
                        to={`/profile/${entry.id}`}
                        className={`font-bold transition-colors hover:text-blue-300 ${entry.isCurrentUser ? 'text-blue-400' : 'text-slate-200'}`}
                      >
                        {entry.name}
                        {entry.isCurrentUser && <span className="ml-2 text-[8px] bg-blue-500 text-white px-1 rounded">YOU</span>}
                      </NavLink>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="font-black text-slate-100">${entry.netWorth.toLocaleString()}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${entry.winRate}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-400">{entry.winRate}%</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <TrendingUp className="inline text-green-400" size={16} />
                </td>
              </tr>
            ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
