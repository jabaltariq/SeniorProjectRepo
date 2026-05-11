import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import type { Bet, Friend, SocialActivity } from '../models';
import { Eye, Swords, Search, UserPlus2, UserPlus } from 'lucide-react';
import { ChatPane, type ChatMessage } from './chat/ChatPane';
import { PeerSettleDetailModal, type PeerSettleKind } from './PeerSettleDetailModal';
import { UserAvatar } from './UserAvatar';
import { ANONYMOUS_PROFILE_AVATAR_PATH, defaultAvatarForUid } from '@/models/defaultProfileAvatars';
import {
  deleteDirectMessage,
  getUidByUsername,
  getUserName,
  getUserProfileSummary,
  searchUsersByNamePrefix,
  sendDirectMessage,
  sendFriendRequest,
  setUserPrivacy,
  subscribeToDirectMessages,
  type DirectMessage,
  type FriendRequest,
  type UserSearchResult
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
  const navigate = useNavigate();
  const [searchQuery, onSearchChange] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [requestedUserIds, setRequestedUserIds] = useState<Set<string>>(() => new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [privacy, togglePrivacy] = useState(userPrivacy);
  const [peerSettleOpen, setPeerSettleOpen] = useState<{ kind: PeerSettleKind; id: string } | null>(null);

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

        const zoomSummary = await getUserProfileSummary(zoomId);
        const zoomName = zoomSummary?.name ?? (await getUserName(zoomId)) ?? 'ZoomerChud';
        if (cancelled) return;

        setInjectedZoomerChud({
          ...zoomSummary,
          id: zoomId,
          name: zoomName,
          avatar: zoomSummary?.avatar ?? zoomName.slice(0, 2).toUpperCase(),
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

    const activityUser = activities.find((a) => a.userId === activeChatUserId && a.userName !== 'Anonymous User');
    const inList =
      friendsForRail.find((f) => f.id === activeChatUserId) ??
      (activityUser
        ? {
            id: activityUser.userId,
            name: activityUser.userName,
            avatar: activityUser.userAvatar,
            avatarUrl: activityUser.userAvatarUrl,
            profileBackgroundUrl: activityUser.userProfileBackgroundUrl,
            status: 'online' as const,
            lastActive: 'Now',
            privacyEnabled: false,
          }
        : null);
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

    void getUserProfileSummary(activeChatUserId)
      .then((summary) => {
        if (!summary) return;
        setActiveFriend((prev) => {
          if (!prev) return prev;
          return { ...prev, ...summary };
        });
      })
      .catch(() => undefined);
  }, [activeChatUserId, friendsForRail, activities]);

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

  const isActiveChatNonFriend = useMemo(
    () =>
      Boolean(activeChatUserId && !friendsForRail.some((f) => f.id === activeChatUserId)),
    [activeChatUserId, friendsForRail],
  );

  const pinnedSearchUser: UserSearchResult | null = useMemo(() => {
    if (!isActiveChatNonFriend || !activeChatUserId || !activeFriend || activeFriend.name === 'Unknown') return null;
    return {
      uid: activeChatUserId,
      name: activeFriend.name,
      privacyEnabled: activeFriend.privacyEnabled,
      avatarUrl: activeFriend.avatarUrl,
      profileBackgroundUrl: activeFriend.profileBackgroundUrl,
    };
  }, [isActiveChatNonFriend, activeChatUserId, activeFriend]);

  const combinedSearchRows = useMemo(() => {
    const out: UserSearchResult[] = [];
    if (pinnedSearchUser) out.push(pinnedSearchUser);
    for (const r of searchResults) {
      if (pinnedSearchUser && r.uid === pinnedSearchUser.uid) continue;
      out.push(r);
    }
    return out;
  }, [pinnedSearchUser, searchResults]);

  useEffect(() => {
    if (!isActiveChatNonFriend || !activeChatUserId) return;
    const name = activeFriend?.name?.trim();
    if (!name || name === 'Unknown') return;
    onSearchChange(name);
  }, [isActiveChatNonFriend, activeChatUserId, activeFriend?.name]);

  useEffect(() => {
    togglePrivacy(userPrivacy);
  }, [userPrivacy]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    const t = setTimeout(() => {
      void searchUsersByNamePrefix(q, currentUid, 8)
        .then((rows) => {
          if (cancelled) return;
          setSearchResults(rows);
        })
        .catch((err) => {
          if (cancelled) return;
          console.error('User search failed', err);
          setSearchResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [searchQuery, currentUid]);

  const toggleDetails = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const expandedBetForActivity = (activity: SocialActivity) => bets.find((b) => b.id === activity.id) ?? null;
  const truncateTarget = (text: string, max = 72) => {
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1).trimEnd()}…`;
  };
  const activityAvatarUrl = (activity: SocialActivity) => {
    if (activity.userAvatarUrl) return activity.userAvatarUrl;
    if (activity.userName === 'Anonymous User' || activity.userAvatar === '?') {
      return `/bethub/${ANONYMOUS_PROFILE_AVATAR_PATH}`;
    }
    return `/bethub/${defaultAvatarForUid(activity.userId, activity.userName)}`;
  };
  const isMessageOpen = Boolean(activeFriend && threadId && currentUid);
  const messagesColClass = !isMessageOpen ? 'xl:col-span-1' : 'xl:col-span-4';
  const activityColClass = !isMessageOpen ? 'xl:col-span-8' : 'xl:col-span-5';
  const isProfilePublic = !privacy;
  const activityPreviewCount = 4;
  const visibleActivities = showAllActivity ? activities : activities.slice(0, activityPreviewCount);
  const canToggleActivity = activities.length > activityPreviewCount;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 animate-in fade-in slide-in-from-right duration-500">
      {/* Friends List */}
      <div className="xl:col-span-3 space-y-4 xl:pr-2 xl:border-r xl:border-slate-800/80">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-white">Friends</h2>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-2.5 py-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <Eye size={12} aria-hidden />
              Profile
            </span>
            <button
              type="button"
              onClick={() => {
                const uid = localStorage.getItem('uid');
                if (!uid) return;
                void setUserPrivacy(uid, !privacy).then(() => togglePrivacy(!privacy));
              }}
              className={`relative h-5 w-10 rounded-full border transition-colors ${
                isProfilePublic
                  ? 'border-blue-400/60 bg-blue-500/30'
                  : 'border-slate-700 bg-slate-800'
              }`}
              aria-label="Toggle public profile"
              title={isProfilePublic ? 'Public' : 'Friends only'}
            >
              <span
                className={`absolute top-[2px] h-3.5 w-3.5 rounded-full bg-white transition-all ${
                  isProfilePublic ? 'left-[20px]' : 'left-[2px]'
                }`}
              />
            </button>
          </div>
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
                  <UserAvatar
                    initials={friend.avatar}
                    imageUrl={friend.avatarUrl}
                    alt={`${friend.name}'s avatar`}
                    className="w-10 h-10 rounded-xl"
                  />
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

              <div className="ml-2 shrink-0 flex items-center gap-2">
                {friendUnreadById.get(friend.id) ? (
                  <span className="rounded-full bg-violet-600/20 border border-violet-400/40 px-2 py-0.5 text-[10px] font-bold text-violet-200">
                    {friendUnreadById.get(friend.id)}
                  </span>
                ) : null}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChallenge(friend);
                  }}
                  className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 items-center justify-center gap-1 text-[10px] font-bold uppercase pointer-events-auto"
                  aria-label={`Counter ${friend.name}`}
                >
                  <Swords size={14} />
                </button>
              </div>
            </div>
          ))}

          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-3 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-10 pr-3 outline-none focus:border-blue-500 transition-all text-sm"
            />
            {(searchLoading ||
              combinedSearchRows.length > 0 ||
              searchQuery.trim().length > 0 ||
              (isActiveChatNonFriend && Boolean(activeFriend?.name && activeFriend.name !== 'Unknown'))) && (
              <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950/80 p-1.5 max-h-56 overflow-y-auto custom-scrollbar">
                {searchLoading ? (
                  <p className="px-3 py-2 text-xs text-slate-500">Searching…</p>
                ) : combinedSearchRows.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-slate-500">No users found.</p>
                ) : (
                  <div className="space-y-1">
                    {combinedSearchRows.map((u) => {
                      const alreadyFriend = friendsForRail.some((f) => f.id === u.uid);
                      const alreadyRequested = requestedUserIds.has(u.uid);
                      return (
                        <div
                          key={u.uid}
                          className="flex items-center justify-between gap-2 rounded-lg border border-slate-800/90 bg-slate-900/60 px-2.5 py-2"
                        >
                          <button
                            type="button"
                            onClick={() => navigate(`/profile/${u.uid}`)}
                            className="min-w-0 flex items-center gap-2 text-left hover:opacity-90"
                          >
                            <UserAvatar
                              initials={u.name.slice(0, 2).toUpperCase()}
                              imageUrl={u.avatarUrl}
                              alt={`${u.name}'s avatar`}
                              className="h-8 w-8 shrink-0 rounded-lg"
                              textClassName="text-[11px] text-blue-300"
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-slate-100">{u.name}</span>
                              <span className="block text-[10px] text-slate-500">
                                {u.privacyEnabled ? 'Friends-only profile' : 'Public profile'}
                              </span>
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={alreadyFriend || alreadyRequested}
                            onClick={() => {
                              const uid = localStorage.getItem('uid');
                              if (!uid) return;
                              void sendFriendRequest(u.name, uid).then((result) => {
                                if (result?.success) {
                                  setRequestedUserIds((prev) => new Set(prev).add(u.uid));
                                }
                              });
                            }}
                            className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                              alreadyFriend
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                : alreadyRequested
                                  ? 'border-violet-500/30 bg-violet-500/10 text-violet-300'
                                  : 'border-blue-500/40 bg-blue-500/15 text-blue-200 hover:bg-blue-500/25'
                            }`}
                          >
                            {alreadyFriend ? 'Friend' : alreadyRequested ? 'Requested' : (
                              <span className="inline-flex items-center gap-1"><UserPlus size={11} /> Request</span>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages Pane (middle) */}
      <div className={`${messagesColClass} space-y-4 xl:px-2 xl:border-r xl:border-slate-800/80`}>
        {isMessageOpen ? (
          <>
            <div>
              <h2 className="text-2xl font-black text-white">Messages</h2>
            </div>

            <div className="glass-card rounded-2xl overflow-hidden border-slate-800/80 bg-slate-950/30">
              <ChatPane
                currentUserId={currentUid!}
                currentUserName={currentUserName}
                otherUser={activeFriend}
                messages={activeThreadMessages}
                composerValue={composerValue}
                onComposerValueChange={setComposerValue}
                onSend={handleSend}
                onDeleteMessage={handleDeleteMessage}
                onOpenProfile={(userId) => navigate(`/profile/${userId}`)}
                onClose={() => setActiveChatUserId(null)}
                onPeerSettleOpen={(p) => setPeerSettleOpen(p)}
              />
            </div>
          </>
        ) : (
          <div />
        )}
      </div>

      {/* Activity Feed (always right) */}
      <div className={`${activityColClass} space-y-6`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-black text-white">Activity Feed</h2>
          {canToggleActivity && (
            <button
              type="button"
              onClick={() => setShowAllActivity((prev) => !prev)}
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300 hover:border-slate-500 hover:text-white transition-colors"
            >
              {showAllActivity ? 'View Less' : `View All (${activities.length})`}
            </button>
          )}
        </div>

        <div className="space-y-4 max-h-[72vh] overflow-y-auto custom-scrollbar pr-1">
          {visibleActivities?.map((activity) => {
                const expandedBet = expandedBetForActivity(activity);
                const isPeer =
                  activity.activityKind === 'peer_counter' || activity.activityKind === 'peer_challenge';
                const placedAt =
                  expandedBet?.placedAt instanceof Date
                    ? expandedBet.placedAt
                    : expandedBet
                      ? new Date(expandedBet.placedAt as unknown as string)
                      : null;
                const peerAvatarSrc =
                  activity.peerUserAvatarUrl ??
                  (activity.peerUserId && activity.peerUserName
                    ? `/bethub/${defaultAvatarForUid(activity.peerUserId, activity.peerUserName)}`
                    : undefined);

            return (
              <div
                key={activity.id}
                className="glass-card rounded-2xl p-4 flex gap-4 border-slate-800 hover:bg-slate-800/20 transition-all"
              >
                <div className="relative h-10 w-10 flex-shrink-0">
                  <UserAvatar
                    initials={activity.userAvatar}
                    imageUrl={activityAvatarUrl(activity)}
                    alt={`${activity.userName}'s avatar`}
                    className="h-10 w-10 rounded-xl"
                    textClassName="text-slate-400"
                  />
                  {activity.peerUserId ? (
                    <UserAvatar
                      initials={activity.peerUserAvatar ?? '??'}
                      imageUrl={peerAvatarSrc}
                      alt={`${activity.peerUserName ?? 'Opponent'}'s avatar`}
                      className="absolute -bottom-1 -right-2 h-7 w-7 rounded-lg border-2 border-slate-900"
                      textClassName="text-[9px] text-violet-200"
                    />
                  ) : null}
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
                      <span className="font-bold text-blue-400" title={activity.target}>{truncateTarget(activity.target)}</span>
                      {activity.peerUserId ? (
                        <>
                          {' '}
                          <span className="text-slate-500">vs</span>{' '}
                          <NavLink
                            to={`/profile/${activity.peerUserId}`}
                            className="font-bold text-amber-200/95 hover:text-amber-100 transition-colors"
                          >
                            {activity.peerUserName ?? 'Opponent'}
                          </NavLink>
                        </>
                      ) : null}
                    </p>
                    <span className="text-[10px] text-slate-600 font-bold uppercase shrink-0">
                      {activity.timestamp}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {!isPeer ? (
                      <button
                        type="button"
                        onClick={() => toggleDetails(activity.id)}
                        className="text-[10px] font-bold text-slate-500 hover:text-slate-300 flex items-center gap-1 uppercase tracking-tighter"
                      >
                        <Eye size={12} /> View Bet
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleDetails(activity.id)}
                        className="text-[10px] font-bold text-slate-500 hover:text-slate-300 flex items-center gap-1 uppercase tracking-tighter"
                      >
                        <Eye size={12} /> Details
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setActiveChatUserId(activity.userId)}
                      className="text-[10px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1 uppercase tracking-tighter"
                    >
                      <Swords size={12} /> Message
                    </button>
                    {activity.peerUserId ? (
                      <button
                        type="button"
                        onClick={() => setActiveChatUserId(activity.peerUserId)}
                        className="text-[10px] font-bold text-amber-400/90 hover:text-amber-300 flex items-center gap-1 uppercase tracking-tighter"
                      >
                        <UserPlus size={12} /> Opponent
                      </button>
                    ) : null}
                  </div>

                  {expandedId === activity.id && isPeer ? (
                    <div className="mt-3 p-4 rounded-2xl bg-slate-500/5 border border-slate-500/10 text-sm text-slate-300">
                      <p className="font-semibold text-slate-200">
                        {activity.activityKind === 'peer_counter' ? 'Head-to-head counter' : 'Game challenge'}
                      </p>
                      <p className="mt-2 text-slate-400">
                        {activity.userName} {activity.action}{' '}
                        <span className="text-slate-200">{truncateTarget(activity.target, 120)}</span>
                      </p>
                    </div>
                  ) : expandedId === activity.id && expandedBet ? (
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
                  ) : expandedId === activity.id && !expandedBet && !isPeer ? (
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

      {currentUid && peerSettleOpen ? (
        <PeerSettleDetailModal
          open
          kind={peerSettleOpen.kind}
          docId={peerSettleOpen.id}
          currentUserId={currentUid}
          onClose={() => setPeerSettleOpen(null)}
        />
      ) : null}
    </div>
  );
};

