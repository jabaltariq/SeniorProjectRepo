
import React, {useEffect, useState} from 'react';
import { NavLink } from 'react-router-dom';
import {Bet, Friend, SocialActivity} from '../models';
import {Users, Activity, Swords, Circle, ShieldCheck, ShieldOff, Search, UserPlus, UserPlus2} from 'lucide-react';
import {
  addFriend, FriendRequest,
  getFriends,
  getUserName,
  getUserPrivacy, handleFriendRequest,
  sendFriendRequest,
  setUserPrivacy
} from "@/services/dbOps.ts";
import {Timestamp} from "firebase/firestore";

interface SocialViewProps {
  friends: Friend[];
  activities: SocialActivity[];
  onChallenge: (friend: Friend) => void;
  bets: Bet[];
}

/*
Just a note to anyone looking at this code, if I see a single change or a single commit that changes THIS FILE I'm going to
delete the whole repository. signed aidan rodriguez at 2:04 am
 */
export const SocialView: React.FC<SocialViewProps> = ({ friends, friendRequests, activities, onChallenge, bets, userPrivacy, userName }) => {
  const [searchQuery, onSearchChange] = useState("")
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [privacy, togglePrivacy] = useState(userPrivacy);
  const betList : Bet[] = bets;
  const toggleDetails = (id : string) => {
    setExpandedId(prev => (prev === id  ? null: id));
  }
  const [visibleRequests, setVisibleRequests] = useState(friendRequests.filter(
      request => request.receiver === userName
  ))
  useEffect(() => {
    togglePrivacy(userPrivacy);
  }, [userPrivacy])
  return (

    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-in fade-in slide-in-from-right duration-500">
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
                  <NavLink to={`/profile/${friend.id}`} className="font-bold text-slate-200 hover:text-blue-300 transition-colors">
                    {friend.name}
                  </NavLink>
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
          <button
              onClick={() =>
                  sendFriendRequest(searchQuery, localStorage.getItem("uid")).then(() => onSearchChange(""))}
              className="w-full py-3 rounded-2xl border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-all text-xs font-bold uppercase tracking-widest">
            + Add Friend
          </button>
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
                type="text"
                placeholder="Add friend by username..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-10 pr-3 outline-none focus:border-blue-500 transition-all text-sm"
            />
          </div>
        </div>
        {visibleRequests.length > 0 &&
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <UserPlus2 className="text-blue-400" size={28} /> <p style={{ fontSize: '20px' }}>Friend Requests</p>
          </h2>
        </div>
        }
        <div className="space-y-3">
          {visibleRequests.map(friendRequest => (friendRequest.receiver == userName &&
              <div key={friendRequest.receiver} className="glass-card rounded-2xl p-4 flex items-center border border-dashed border-slate-800 justify-between group hover:border-blue-500/30 transition-all">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    Request from {friendRequest.sender}
                  </div>
                  <div className="space-y-3">
                    <button
                      onClick={() => {handleFriendRequest(friendRequest, true);
                        const newList = visibleRequests.filter((item) => item.id !== friendRequest.id);
                        setVisibleRequests(newList)
                        }}
                      className="w-full py-3 rounded-2xl border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-all text-xs font-bold uppercase tracking-widest">
                        Accept
                    </button>
                    <button
                        onClick={() => {handleFriendRequest(friendRequest, false);
                          const newList = visibleRequests.filter((item) => item.id !== friendRequest.id);
                          setVisibleRequests(newList)
                        }}
                        className="w-full py-3 rounded-2xl border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-all text-xs font-bold uppercase tracking-widest">
                      Refuse
                    </button>
                  </div>
                </div>

              </div>
          ))}
        </div>

        <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-indigo-400 uppercase flex items-center gap-1">
              <ShieldCheck size={12} /> Privacy Settings
            </p>
            {!privacy && (
                <div
                    onClick={() => {
                      setUserPrivacy(localStorage.getItem("uid"), !privacy)
                          .then(() => {
                            togglePrivacy(!privacy);

                          })}}
                    className="w-8 h-4 bg-slate-600 rounded-full relative cursor-pointer">
                  <div className="absolute left-1 top-1 w-2 h-2 bg-white rounded-full"/>
                </div>
                )}
            {privacy && (
                <div
                    onClick={() => {setUserPrivacy(localStorage.getItem("uid"), !privacy).then(() => togglePrivacy(!privacy))}}
                    className="w-8 h-4 bg-indigo-600 rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 w-2 h-2 bg-white rounded-full" />
                </div>
            )}



          </div>
          <p className="text-[10px] text-slate-500">{privacy ? "Your betting history is only visible to friends." : "Your betting history is public."}</p>
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
          {activities?.map(activity => (

            <div key={activity.id} className="glass-card rounded-2xl p-4 flex gap-4 border-slate-800 hover:bg-slate-800/20 transition-all">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex-shrink-0 flex items-center justify-center font-bold text-slate-400">
                {activity.userAvatar}

              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <p className="text-sm">
                    <NavLink to={`/profile/${activity.userId}`} className="font-bold text-slate-100 hover:text-blue-300 transition-colors">
                      {activity.userName}
                    </NavLink>{' '}
                    <span className="text-slate-400">{activity.action}</span>{' '}
                    <span className="font-bold text-blue-400">{activity.target}</span>
                  </p>
                  <span className="text-[10px] text-slate-600 font-bold uppercase">{activity.timestamp}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                      onClick={() => toggleDetails(activity.id)}
                      className="text-[10px] font-bold text-slate-500 hover:text-slate-300 flex items-center gap-1 uppercase tracking-tighter">
                    <Activity size={12} /> View Bet
                  </button>


                  <button className="text-[10px] font-bold text-slate-500 hover:text-blue-400 flex items-center gap-1 uppercase tracking-tighter">
                    <Swords size={12} /> Counter-Bet
                  </button>
                </div>
                {expandedId === activity.id && (
                    <div
                        style = {{padding: '15px'}}
                        className="">
                    <div className="p-4 rounded-2xl bg-slate-500/5 border border-slate-500/10">
                      <div
                          style = {{padding: '5px'}}
                          className={"text-sm"}>
                        <span className="font-bold text-slate-100">Stake: </span>
                        <span> ${betList.find(obj => obj.id === activity.id).stake} </span>
                      </div>
                      <div
                          style = {{padding: '5px'}}
                          className={"text-sm"}>
                        <span className="font-bold text-slate-100"> Odds: </span>
                        <span>{betList.find(obj => obj.id === activity.id).odds} </span>
                      </div>
                      <div
                          style = {{padding: '5px'}}
                          className={"text-sm"}>
                        <span className="font-bold text-slate-100"> Potential Payout: </span>
                        <span>{betList.find(obj => obj.id === activity.id).potentialPayout}</span>
                      </div>
                      <div
                          style = {{padding: '5px'}}
                          className={"text-sm"}>
                        <span className="font-bold text-slate-100"> Placed on: </span>
                        <span>{(betList.find(obj => obj.id === activity.id).placedAt as unknown as Timestamp).toDate().toLocaleString()}</span>
                      </div>
                    </div>
                    </div>
                )}
                </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
