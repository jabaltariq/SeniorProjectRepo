import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import type { Bet, Friend, SocialActivity } from '../models';
import { Eye, Swords, Search, UserPlus2, ShieldCheck } from 'lucide-react';
import { ChatPane, type ChatMessage } from './chat/ChatPane';
import {
  deleteDirectMessage,
  getUidByUsername,
  getUserName,
  sendDirectMessage,
  sendFriendRequest,
  setUserPrivacy,
  subscribeToDirectMessages,
  type DirectMessage,
  type FriendRequest
} from '@/services/dbOps';

interface SocialMessagingViewProps {
  friends: Friend[];
  friendRequests: FriendRequest[];
  activities: SocialActivity[];
  onChallenge: (friend: Friend) => void;
  bets: Bet[];
  userPrivacy: boolean;
  userName?: string;
}

export const SocialMessagingView: React.FC<SocialMessagingViewProps> = ({
  friends,
  friendRequests: _friendRequests,
  activities,
  onChallenge,
  bets,
  userPrivacy,
  userName,
}) => {
  const [searchQuery, onSearchChange] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [privacy, togglePrivacy] = useState(userPrivacy);

  const location = useLocation();

  const currentUid = typeof localStorage !== 'undefined' ? localStorage.getItem('uid') : null;
  const currentUserName = userName ?? 'You';

  const initialOpenChatWithUserId = (() => {
    const s = location.state as { openChatWithUserId?: unknown } | null | undefined;
    const v = s?.openChatWithUserId;
    return typeof v === 'string' && v.length > 0 ? v : null;
  })();

  const [activeChatUserId, setActiveChatUserId] = useState<string | null>(() => {
    if (initialOpenChatWithUserId) return initialOpenChatWithUserId;
    const saved =
      typeof localStorage !== 'undefined' ? localStorage.getItem('chatUiActiveUserId') : null;
    return typeof saved === 'string' && saved.length > 0 ? saved : null;
  });

  useEffect(() => {
    // If we arrive via navigation with state, keep active chat in sync even
    // when this component doesn't remount.
    if (!initialOpenChatWithUserId) return;
    setActiveChatUserId((prev) => (prev === initialOpenChatWithUserId ? prev : initialOpenChatWithUserId));
  }, [initialOpenChatWithUserId]);

  useEffect(() => {
    if (!activeChatUserId) {
      localStorage.removeItem('chatUiActiveUserId');
      return;
    }
    localStorage.setItem('chatUiActiveUserId', activeChatUserId);
  }, [activeChatUserId]);

  const [injectedZoomerChud, setInjectedZoomerChud] = useState<Friend | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!currentUid) return;

    (async () => {
      try {
        // UI-only: some dev environments don't seed ZoomerChud into the
        // Firestore `friends` array. We inject him visually so the rail isn't empty.
        const candidates = ['ZoomerChud', 'zoomerchud'];
        let zoomId: string | null = null;
        for (const name of candidates) {
          const id = await getUidByUsername(name);
          if (id) {
            zoomId = id;
            break;
          }
        }
        if (!zoomId || cancelled) return;

        const zoomName = (await getUserName(zoomId)) ?? 'ZoomerChud';
        if (cancelled) return;

        setInjectedZoomerChud({
          id: zoomId,
          name: zoomName,
          avatar: zoomName.slice(0, 2),
          status: 'online',
          lastActive: 'Now',
          privacyEnabled: false,
        });
      } catch (e) {
        console.warn('ZoomerChud injection failed', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUid]);

  const friendsForRail = useMemo(() => {
    if (!injectedZoomerChud) return friends;
    if (friends.some((f) => f.id === injectedZoomerChud.id)) return friends;
    return [injectedZoomerChud, ...friends];
  }, [friends, injectedZoomerChud]);

  const [activeFriend, setActiveFriend] = useState<Friend | null>(null);

  useEffect(() => {
    if (!activeChatUserId) {
      setActiveFriend(null);
      return;
    }

    const inList = friendsForRail.find((f) => f.id === activeChatUserId) ?? null;
    if (inList) {
      setActiveFriend(inList);
      return;
    }

    // Placeholder so the Message action always opens a thread pane.
    setActiveFriend({
      id: activeChatUserId,
      name: 'Unknown',
      avatar: 'UK',
      status: 'online',
      lastActive: 'Now',
      privacyEnabled: false,
    });

    void getUserName(activeChatUserId)
      .then((name) => {
        if (!name) return;
        setActiveFriend((prev) => {
          if (!prev) return prev;
          return { ...prev, name, avatar: name.slice(0, 2) };
        });
      })
      .catch(() => undefined);
  }, [activeChatUserId, friendsForRail]);

  const makeThreadId = (uidA: string, uidB: string) => {
    const [a, b] = [uidA, uidB].sort((x, y) => x.localeCompare(y));
    return `dm:${a}:${b}`;
  };

  const threadId = useMemo(() => {
    if (!currentUid || !activeChatUserId) return null;
    return makeThreadId(currentUid, activeChatUserId);
  }, [currentUid, activeChatUserId]);

  const [activeThreadMessages, setActiveThreadMessages] = useState<ChatMessage[]>([]);
  const [composerValue, setComposerValue] = useState('');

  useEffect(() => {
    if (!threadId || !activeFriend || !currentUid) {
      setActiveThreadMessages([]);
      setComposerValue('');
      return;
    }
    const unsub = subscribeToDirectMessages(
      threadId,
      (rows: DirectMessage[]) => {
        const mapped: ChatMessage[] = rows.map((m) => ({
          id: m.id,
          threadId: m.threadId,
          fromUserId: m.fromUserId,
          toUserId: m.toUserId,
          text: m.text,
          createdAt: m.createdAtMs,
        }));
        setActiveThreadMessages(mapped);
      },
      (err) => console.error('subscribeToDirectMessages failed', err),
    );
    setComposerValue('');
    return () => unsub();
  }, [threadId, activeFriend, currentUid]);

  const handleSend = () => {
    if (!threadId || !activeFriend || !currentUid) return;
    const text = composerValue.trim();
    if (!text) return;

    const createdAtMs = Date.now();
    const messageId = `m_${createdAtMs}_${Math.random().toString(36).slice(2, 9)}`;
    setComposerValue('');
    void sendDirectMessage({
      threadId,
      messageId,
      fromUserId: currentUid,
      toUserId: activeFriend.id,
      text,
      createdAtMs,
    }).then((res) => {
      if (!res.success) console.error('sendDirectMessage failed', 'error' in res ? res.error : 'UNKNOWN');
    });
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!threadId || !currentUid) return;
    const target = activeThreadMessages.find((m) => m.id === messageId);
    if (!target || target.fromUserId !== currentUid) return;
    const ok = typeof window !== 'undefined' ? window.confirm('Delete this message?') : true;
    if (!ok) return;
    void deleteDirectMessage(threadId, messageId, currentUid).then((res) => {
      if (!res.success) console.error('deleteDirectMessage failed', 'error' in res ? res.error : 'UNKNOWN');
    });
  };

  const friendUnreadById = useMemo(() => {
    if (!currentUid) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const f of friendsForRail) {
      if (f.id === currentUid) continue;
      const tId = makeThreadId(currentUid, f.id);
      const raw = localStorage.getItem(`chatUiUnread:${tId}`);
      const n = raw ? Number(raw) : 0;
      if (Number.isFinite(n) && n > 0) m.set(f.id, n);
    }
    return m;
  }, [friendsForRail, currentUid]);

  useEffect(() => {
    togglePrivacy(userPrivacy);
  }, [userPrivacy]);

  const toggleDetails = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const expandedBetForActivity = (activity: SocialActivity) => bets.find((b) => b.id === activity.id) ?? null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-in fade-in slide-in-from-right duration-500">
      {/* Friends List */}
      <div className="xl:col-span-1 space-y-6">
        <div>
          <h2 className="text-2xl font-black text-white">Friends</h2>
          <p className="text-slate-400">Connect and compete.</p>
        </div>

        <div className="space-y-3">
          {friendsForRail.map((friend) => (
            <div
              key={friend.id}
              role="button"
              tabIndex={0}
              onClick={() => setActiveChatUserId(friend.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setActiveChatUserId(friend.id);
              }}
              className={`glass-card rounded-2xl p-4 flex items-center justify-between border-slate-800 group hover:border-blue-500/30 transition-all cursor-pointer ${
                activeChatUserId === friend.id ? 'ring-2 ring-blue-500/30 border-blue-400/40' : ''
              }`}
              aria-label={`Open chat with ${friend.name}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-blue-400">
                    {friend.avatar}
                  </div>
                  <div
                    className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-900 ${
                      friend.status === 'online'
                        ? 'bg-green-500'
                        : friend.status === 'away'
                          ? 'bg-yellow-500'
                          : 'bg-slate-600'
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <NavLink
                    to={`/profile/${friend.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="block font-bold text-slate-200 hover:text-blue-300 transition-colors truncate"
                  >
                    {friend.name}
                  </NavLink>
                  <p className="text-[10px] text-slate-500 uppercase font-bold truncate">
                    {friend.status} • {friend.lastActive}
                  </p>
                </div>
              </div>

              {friendUnreadById.get(friend.id) ? (
                <span className="ml-2 shrink-0 rounded-full bg-violet-600/20 border border-violet-400/40 px-2 py-0.5 text-[10px] font-bold text-violet-200">
                  {friendUnreadById.get(friend.id)}
                </span>
              ) : null}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChallenge(friend);
                }}
                className="hidden sm:flex p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all opacity-0 group-hover:opacity-100 items-center justify-center gap-1 text-[10px] font-bold uppercase"
                aria-label={`Challenge ${friend.name}`}
              >
                <Swords size={14} /> Challenge
              </button>
            </div>
          ))}

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

          <button
            type="button"
            onClick={() => {
              const uid = localStorage.getItem('uid');
              if (!uid) return;
              void sendFriendRequest(searchQuery, uid).then((result) => {
                if (result?.success) onSearchChange('');
              });
            }}
            className="w-full py-3 rounded-2xl border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-all text-xs font-bold uppercase tracking-widest"
          >
            <UserPlus2 className="inline mr-2" size={14} /> Add Friend
          </button>
        </div>

        {/* Privacy Settings */}
        <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-indigo-400 uppercase flex items-center gap-1">
              <ShieldCheck size={12} /> Privacy Settings
            </p>
          </div>
          <p className="text-[10px] text-slate-500">{privacy ? 'Your betting history is only visible to friends.' : 'Your betting history is public.'}</p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const uid = localStorage.getItem('uid');
                if (!uid) return;
                void setUserPrivacy(uid, !privacy).then(() => togglePrivacy(!privacy));
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                privacy
                  ? 'border-slate-700/80 bg-slate-900/50 text-slate-200 hover:border-blue-500/40 hover:bg-slate-800/40'
                  : 'border-blue-500/50 bg-blue-500/15 text-blue-200 hover:border-blue-400/60 hover:bg-blue-500/20'
              }`}
            >
              {privacy ? 'Friends only' : 'Public'}
            </button>
          </div>
        </div>
      </div>

      {/* Right Pane */}
      <div className="xl:col-span-2 space-y-6">
        {activeFriend && threadId && currentUid ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-black text-white">Messages</h2>
              <p className="text-slate-400">Chat thread with {activeFriend.name}.</p>
            </div>

            <div className="glass-card rounded-2xl overflow-hidden border-slate-800/80 bg-slate-950/30">
              <ChatPane
                currentUserId={currentUid}
                currentUserName={currentUserName}
                otherUser={activeFriend}
                messages={activeThreadMessages}
                composerValue={composerValue}
                onComposerValueChange={setComposerValue}
                onSend={handleSend}
                onDeleteMessage={handleDeleteMessage}
                onClose={() => setActiveChatUserId(null)}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-black text-white">Activity Feed</h2>
              <p className="text-slate-400">Real-time pulses from the community.</p>
            </div>

            <div className="space-y-4">
              {activities?.map((activity) => {
                const expandedBet = expandedBetForActivity(activity);
                const placedAt =
                  expandedBet?.placedAt instanceof Date
                    ? expandedBet.placedAt
                    : expandedBet
                      ? new Date(expandedBet.placedAt as unknown as string)
                      : null;

                return (
                  <div
                    key={activity.id}
                    className="glass-card rounded-2xl p-4 flex gap-4 border-slate-800 hover:bg-slate-800/20 transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex-shrink-0 flex items-center justify-center font-bold text-slate-400">
                      {activity.userAvatar}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start gap-3">
                        <p className="text-sm min-w-0">
                          <NavLink
                            to={`/profile/${activity.userId}`}
                            className="font-bold text-slate-100 hover:text-blue-300 transition-colors"
                          >
                            {activity.userName}
                          </NavLink>{' '}
                          <span className="text-slate-400">{activity.action}</span>{' '}
                          <span className="font-bold text-blue-400">{activity.target}</span>
                        </p>
                        <span className="text-[10px] text-slate-600 font-bold uppercase shrink-0">
                          {activity.timestamp}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleDetails(activity.id)}
                          className="text-[10px] font-bold text-slate-500 hover:text-slate-300 flex items-center gap-1 uppercase tracking-tighter"
                        >
                          <Eye size={12} /> View Bet
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveChatUserId(activity.userId)}
                          className="text-[10px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1 uppercase tracking-tighter"
                        >
                          <Swords size={12} /> Message
                        </button>
                      </div>

                      {expandedId === activity.id && expandedBet ? (
                        <div className="mt-3 p-4 rounded-2xl bg-slate-500/5 border border-slate-500/10">
                          <div className="text-sm">
                            <span className="font-bold text-slate-100">Stake: </span>
                            <span>${expandedBet.stake}</span>
                          </div>
                          <div className="text-sm">
                            <span className="font-bold text-slate-100">Odds: </span>
                            <span>{expandedBet.odds}</span>
                          </div>
                          <div className="text-sm">
                            <span className="font-bold text-slate-100">Potential Payout: </span>
                            <span>{expandedBet.potentialPayout}</span>
                          </div>
                          <div className="text-sm">
                            <span className="font-bold text-slate-100">Placed on: </span>
                            <span>
                              {placedAt && Number.isFinite(placedAt.getTime()) ? placedAt.toLocaleString() : 'Unknown'}
                            </span>
                          </div>
                        </div>
                      ) : expandedId === activity.id && !expandedBet ? (
                        <div className="mt-3 p-4 rounded-2xl bg-slate-500/5 border border-slate-500/10 text-sm text-slate-400">
                          Bet details unavailable.
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

