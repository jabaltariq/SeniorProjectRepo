
import React, {useEffect, useMemo, useState} from 'react';
import { NavLink } from 'react-router-dom';
import {Bet, Friend, SocialActivity} from '../models';
import {Users, Radio, Eye, Swords, Circle, ShieldCheck, ShieldOff, Search, UserPlus, UserPlus2} from 'lucide-react';
import {
  addFriend, FriendRequest,
  getFriends,
  getUserName,
  getUserPrivacy, handleFriendRequest,
  proposeHeadToHead,
  sendFriendRequest,
  setUserPrivacy
} from "@/services/dbOps.ts";
import { CounterBetModal } from './CounterBetModal';
import { UserAvatar } from './UserAvatar';
import { ANONYMOUS_PROFILE_AVATAR_PATH, defaultAvatarForUid } from '@/models/defaultProfileAvatars';

interface SocialViewProps {
  friends: Friend[];
  friendRequests: FriendRequest[];
  activities: SocialActivity[];
  onChallenge: (friend: Friend) => void;
  bets: Bet[];
  userPrivacy: boolean;
  userName?: string;
}

/*
Just a note to anyone looking at this code, if I see a single change or a single commit that changes THIS FILE I'm going to
delete the whole repository. signed aidan rodriguez at 2:04 am
 */
export const SocialView: React.FC<SocialViewProps> = ({ friends, friendRequests, activities, onChallenge, bets, userPrivacy, userName }) => {
  const [searchQuery, onSearchChange] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [privacy, togglePrivacy] = useState(userPrivacy);
  const betList : Bet[] = bets;
  const toggleDetails = (id : string) => {
    setExpandedId(prev => (prev === id  ? null: id));
  }

  const activityAvatarUrl = (activity: SocialActivity) => {
    if (activity.userAvatarUrl) return activity.userAvatarUrl;
    if (activity.userName === 'Anonymous User' || activity.userAvatar === '?') {
      return `/bethub/${ANONYMOUS_PROFILE_AVATAR_PATH}`;
    }
    return `/bethub/${defaultAvatarForUid(activity.userId, activity.userName)}`;
  };

  // ── Counter-Bet (head-to-head) wiring ────────────────────────────
  // Each activity row carries the bet doc id, so we can look up the full Bet
  // off the `bets` prop and either open a CounterBetModal (fadeable) or show
  // the user a disabled button with a reason (not fadeable). We deliberately
  // skip own bets and parlays so the activity feed isn't cluttered with
  // useless buttons.
  const currentUid = typeof localStorage !== 'undefined' ? localStorage.getItem('uid') : null;
  const currentBalance = typeof localStorage !== 'undefined'
    ? Number(localStorage.getItem('userMoney') ?? 0)
    : 0;
  const [counterBetTarget, setCounterBetTarget] = useState<{ bet: Bet; ownerName: string } | null>(null);

  type FadeEligibility =
    | { kind: 'hidden' }
    | { kind: 'disabled'; reason: string }
    | { kind: 'enabled'; bet: Bet };

  const fadeEligibilityFor = (activity: SocialActivity): FadeEligibility => {
    if (currentUid && activity.userId === currentUid) return { kind: 'hidden' };
    const bet = betList.find((b) => b.id === activity.id);
    if (!bet)                          return { kind: 'disabled', reason: 'Bet details unavailable.' };
    const status = bet.status ?? 'PENDING';
    if (status !== 'PENDING')          return { kind: 'disabled', reason: `Already ${status.toLowerCase()}.` };
    if (bet.betType === 'parlay')      return { kind: 'disabled', reason: 'Parlays can\'t be faded yet.' };
    if (!bet.eventId || !bet.sportKey) return { kind: 'disabled', reason: 'Missing event info.' };
    if (bet.odds <= 1)                 return { kind: 'disabled', reason: 'Invalid odds.' };
    if (bet.eventStartsAt && bet.eventStartsAt.getTime() <= Date.now()) {
      return { kind: 'disabled', reason: 'Game already started.' };
    }
    return { kind: 'enabled', bet };
  };

  // Optimistically hide a request the moment the user clicks Accept/Refuse,
  // before the Firestore delete round-trips. The realtime subscription will
  // catch up and the dismissed entry naturally falls out of `friendRequests`,
  // at which point we drop it from the dismissed set so memory doesn't grow.
  const [dismissedRequestIds, setDismissedRequestIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setDismissedRequestIds((prev) => {
      if (prev.size === 0) return prev;
      const live = new Set(friendRequests.map((r) => r.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (live.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [friendRequests]);

  // Use the current user's UID — not their username — to filter the inbox.
  // The previous name-based filter let two `undefined` values match each
  // other, which surfaced ghost requests on freshly created accounts.
  const visibleRequests = useMemo(
    () =>
      friendRequests.filter(
        (request) =>
          (!currentUid || request.receiver === currentUid) &&
          !dismissedRequestIds.has(request.id),
      ),
    [friendRequests, currentUid, dismissedRequestIds],
  );

  const respondToRequest = (request: FriendRequest, accepted: boolean) => {
    setDismissedRequestIds((prev) => {
      const next = new Set(prev);
      next.add(request.id);
      return next;
    });
    handleFriendRequest(request, accepted).catch((err) => {
      console.error('Failed to handle friend request', err);
      setDismissedRequestIds((prev) => {
        const next = new Set(prev);
        next.delete(request.id);
        return next;
      });
    });
  };

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
                  <UserAvatar
                    initials={friend.avatar}
                    imageUrl={friend.avatarUrl}
                    alt={`${friend.name}'s avatar`}
                    className="w-10 h-10 rounded-xl"
                  />
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
                <Swords size={14} /> Counter
              </button>
            </div>
          ))}
          <button
              onClick={() => {
                sendFriendRequest(searchQuery, localStorage.getItem("uid"))
                  .then((result) => {
                    if (result?.success) {
                      onSearchChange("");
                    } else if (result?.error) {
                      console.warn('Friend request rejected:', result.error);
                    }
                  })
                  .catch((err) => console.error('sendFriendRequest failed', err));
              }}
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
          {visibleRequests.map(friendRequest => (
              <div key={friendRequest.id} className="glass-card rounded-2xl p-4 flex items-center border border-dashed border-slate-800 justify-between group hover:border-blue-500/30 transition-all">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    Request from {friendRequest.senderName ?? 'Unknown user'}
                  </div>
                  <div className="space-y-3">
                    <button
                      onClick={() => respondToRequest(friendRequest, true)}
                      className="w-full py-3 rounded-2xl border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-all text-xs font-bold uppercase tracking-widest">
                        Accept
                    </button>
                    <button
                        onClick={() => respondToRequest(friendRequest, false)}
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
            <Radio className="text-green-400" size={28} strokeWidth={2.5} /> Activity Feed
          </h2>
          <p className="text-slate-400">Real-time pulses from the community.</p>
        </div>

        <div className="space-y-4">
          {activities?.map(activity => (

            <div key={activity.id} className="glass-card rounded-2xl p-4 flex gap-4 border-slate-800 hover:bg-slate-800/20 transition-all">
              <UserAvatar
                initials={activity.userAvatar}
                imageUrl={activityAvatarUrl(activity)}
                alt={`${activity.userName}'s avatar`}
                className="w-10 h-10 rounded-xl flex-shrink-0"
                textClassName="text-slate-400"
              />
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
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                      onClick={() => toggleDetails(activity.id)}
                      className="text-[10px] font-bold text-slate-500 hover:text-slate-300 flex items-center gap-1 uppercase tracking-tighter">
                    <Eye size={12} /> View Bet
                  </button>

                  {(() => {
                    const fade = fadeEligibilityFor(activity);
                    if (fade.kind === 'hidden') return null;
                    if (fade.kind === 'enabled') {
                      const challengerStake = Math.round(fade.bet.stake * (fade.bet.odds - 1) * 100) / 100;
                      return (
                        <button
                          type="button"
                          onClick={() => setCounterBetTarget({ bet: fade.bet, ownerName: activity.userName })}
                          className="text-[10px] font-bold text-red-400 hover:text-red-300 flex items-center gap-1 uppercase tracking-tighter"
                        >
                          <Swords size={12} /> Counter-Bet ${challengerStake.toFixed(2)}
                        </button>
                      );
                    }
                    return (
                      <button
                        type="button"
                        disabled
                        title={fade.reason}
                        className="text-[10px] font-bold text-slate-600 cursor-not-allowed flex items-center gap-1 uppercase tracking-tighter"
                      >
                        <Swords size={12} /> Counter-Bet · {fade.reason}
                      </button>
                    );
                  })()}
                </div>
                {expandedId === activity.id && (() => {
                  // Resolve the bet once instead of running .find() four
                  // times and crashing if the row is missing from betList
                  // (e.g. a freshly-streamed bet whose author doc was
                  // dropped). placedAt is already a Date by the time it
                  // reaches us — render it directly instead of calling
                  // .toDate() on a Date.
                  const expandedBet = betList.find(obj => obj.id === activity.id);
                  if (!expandedBet) {
                    return (
                      <div style={{padding: '15px'}}>
                        <div className="p-4 rounded-2xl bg-slate-500/5 border border-slate-500/10 text-sm text-slate-400">
                          Bet details unavailable.
                        </div>
                      </div>
                    );
                  }
                  const placedAt = expandedBet.placedAt instanceof Date
                    ? expandedBet.placedAt
                    : new Date(expandedBet.placedAt as unknown as string);
                  return (
                    <div style={{padding: '15px'}} className="">
                      <div className="p-4 rounded-2xl bg-slate-500/5 border border-slate-500/10">
                        <div style={{padding: '5px'}} className={"text-sm"}>
                          <span className="font-bold text-slate-100">Stake: </span>
                          <span> ${expandedBet.stake} </span>
                        </div>
                        <div style={{padding: '5px'}} className={"text-sm"}>
                          <span className="font-bold text-slate-100"> Odds: </span>
                          <span>{expandedBet.odds} </span>
                        </div>
                        <div style={{padding: '5px'}} className={"text-sm"}>
                          <span className="font-bold text-slate-100"> Potential Payout: </span>
                          <span>{expandedBet.potentialPayout}</span>
                        </div>
                        <div style={{padding: '5px'}} className={"text-sm"}>
                          <span className="font-bold text-slate-100"> Placed on: </span>
                          <span>{Number.isFinite(placedAt.getTime()) ? placedAt.toLocaleString() : 'Unknown'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                </div>
            </div>
          ))}
        </div>
      </div>
      {counterBetTarget && currentUid && (
        <CounterBetModal
          bet={counterBetTarget.bet}
          ownerName={counterBetTarget.ownerName}
          balance={currentBalance}
          onConfirm={(originalBetId) => proposeHeadToHead(originalBetId, currentUid)}
          onClose={() => setCounterBetTarget(null)}
        />
      )}
    </div>
  );
};
