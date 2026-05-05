
import React, { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LeaderboardEntry } from '../models';
import { Trophy, TrendingUp, Medal, ArrowUp, ArrowDown } from 'lucide-react';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

type SortKey = 'rank' | 'user' | 'netWorth' | 'winRate' | 'trend';
type SortDir = 'asc' | 'desc';

function trendScore(e: LeaderboardEntry): number {
  return e.netWorth * (e.winRate / 100);
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ entries }) => {
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'user' ? 'asc' : 'desc');
    }
  };

  const sortedEntries = useMemo(() => {
    if (entries.length === 0) return entries;
    const dir = sortDir === 'asc' ? 1 : -1;
    const cmp = (a: LeaderboardEntry, b: LeaderboardEntry): number => {
      switch (sortKey) {
        case 'rank':
          return (a.rank - b.rank) * dir;
        case 'user':
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) * dir;
        case 'netWorth':
          return (a.netWorth - b.netWorth) * dir;
        case 'winRate':
          return (a.winRate - b.winRate) * dir;
        case 'trend':
          return (trendScore(a) - trendScore(b)) * dir;
        default:
          return 0;
      }
    };
    return [...entries].sort(cmp);
  }, [entries, sortKey, sortDir]);

  const SortHeader: React.FC<{
    label: string;
    colKey: SortKey;
    align?: 'left' | 'right';
  }> = ({ label, colKey, align = 'left' }) => {
    const active = sortKey === colKey;
    return (
      <th className={`px-6 py-4 ${align === 'right' ? 'text-right' : 'text-left'}`}>
        <button
          type="button"
          onClick={() => toggleSort(colKey)}
          className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-widest transition-colors hover:text-slate-300 ${
            active ? 'text-blue-400' : 'text-slate-500'
          }`}
        >
          {label}
          {active &&
            (sortDir === 'asc' ? (
              <ArrowUp className="shrink-0" size={12} aria-hidden />
            ) : (
              <ArrowDown className="shrink-0" size={12} aria-hidden />
            ))}
        </button>
      </th>
    );
  };

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
            <tr className="bg-slate-900/50 text-[10px] border-b border-slate-800">
              <SortHeader label="Rank" colKey="rank" />
              <SortHeader label="User" colKey="user" />
              <SortHeader label="Net Worth" colKey="netWorth" />
              <SortHeader label="Win Rate" colKey="winRate" />
              <SortHeader label="Trend" colKey="trend" align="right" />
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
            sortedEntries.map((entry, idx) => {
              const displayRank = sortKey === 'rank' ? entry.rank : idx + 1;
              return (
              <tr 
                key={entry.id} 
                className={`hover:bg-blue-500/5 transition-colors ${entry.isCurrentUser ? 'bg-blue-600/10' : ''}`}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {displayRank === 1 && <Medal className="text-yellow-400" size={16} />}
                    {displayRank === 2 && <Medal className="text-slate-300" size={16} />}
                    {displayRank === 3 && <Medal className="text-amber-600" size={16} />}
                    <span className={`font-bold ${displayRank <= 3 ? 'text-lg' : 'text-slate-400'}`}>
                      #{displayRank}
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
            );
            })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
