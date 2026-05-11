import React, { useMemo, useState } from 'react';
import { Swords, Check, X as XIcon, RefreshCw, AlertCircle, Clock3 } from 'lucide-react';
import type { HeadToHead, HeadToHeadStatus } from '../models';
import { useHeadToHeadViewModel, type HeadToHeadBucket } from '../viewModels/useHeadToHeadViewModel';
import { useGameChallengesInboxViewModel } from '../viewModels/useGameChallengesInboxViewModel';
import type { GameChallengeDoc, GameChallengeStatus } from '@/services/gameChallenges';

interface HeadToHeadViewProps {
  currentUserId: string | null;
}

type InboxRow =
  | { kind: 'h2h'; sortMs: number; h2h: HeadToHead }
  | { kind: 'gc'; sortMs: number; gc: GameChallengeDoc };

function mergeBucket(tab: HeadToHeadBucket, h2hList: HeadToHead[], gcList: GameChallengeDoc[]): InboxRow[] {
  const rows: InboxRow[] = [
    ...h2hList.map((h2h) => ({
      kind: 'h2h' as const,
      sortMs: h2h.createdAt.getTime(),
      h2h,
    })),
    ...gcList.map((gc) => ({
      kind: 'gc' as const,
      sortMs: gc.createdAt.toMillis(),
      gc,
    })),
  ];
  rows.sort((a, b) => b.sortMs - a.sortMs);
  return rows;
}

/**
 * "Head-to-Head" inbox + history page.
 *
 * Counter-bets (fade) and game challenges share the same four buckets.
 * The current user can accept/decline/cancel pending items; lists stay in
 * sync via Firestore listeners.
 */
export const HeadToHeadView: React.FC<HeadToHeadViewProps> = ({ currentUserId }) => {
  const h2h = useHeadToHeadViewModel(currentUserId);
  const gc = useGameChallengesInboxViewModel(currentUserId);

  const [activeTab, setActiveTab] = useState<HeadToHeadBucket>('incoming');
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [errorByKey, setErrorByKey] = useState<Record<string, string>>({});

  const tabs = useMemo(
    () => [
      {
        id: 'incoming' as const,
        label: 'Your turn',
        count: h2h.buckets.incoming.length + gc.buckets.incoming.length,
      },
      {
        id: 'outgoing' as const,
        label: 'Their turn',
        count: h2h.buckets.outgoing.length + gc.buckets.outgoing.length,
      },
      {
        id: 'active' as const,
        label: 'Live',
        count: h2h.buckets.active.length + gc.buckets.active.length,
      },
      {
        id: 'history' as const,
        label: 'Past',
        count: h2h.buckets.history.length + gc.buckets.history.length,
      },
    ],
    [h2h.buckets, gc.buckets],
  );

  const list = useMemo(
    () => mergeBucket(activeTab, h2h.buckets[activeTab], gc.buckets[activeTab]),
    [activeTab, h2h.buckets, gc.buckets],
  );

  const combinedError = [h2h.error, gc.error].filter(Boolean).join(' · ');
  const loading = h2h.loading || gc.loading;

  const clearRowError = (key: string) => {
    setErrorByKey((prev) => {
      const n = { ...prev };
      delete n[key];
      return n;
    });
  };

  const handleH2hAction = async (h2hRow: HeadToHead, action: 'accept' | 'decline' | 'cancel') => {
    const key = `h2h:${h2hRow.id}`;
    if (actingKey) return;
    setActingKey(key);
    clearRowError(key);
    let result: { success: boolean; error?: string };
    if (action === 'accept') result = await h2h.accept(h2hRow.id);
    else if (action === 'decline') result = await h2h.decline(h2hRow.id);
    else result = await h2h.cancel(h2hRow.id);
    if (!result.success) {
      setErrorByKey((prev) => ({ ...prev, [key]: friendlyH2hError(result.error ?? 'UNKNOWN') }));
    } else {
      if (action === 'accept') setActiveTab('active');
      if (action === 'decline' || action === 'cancel') setActiveTab('history');
    }
    setActingKey(null);
  };

  const handleGcAction = async (gcRow: GameChallengeDoc, action: 'accept' | 'decline' | 'cancel') => {
    const key = `gc:${gcRow.id}`;
    if (actingKey) return;
    setActingKey(key);
    clearRowError(key);
    let result: { success: boolean; error?: string };
    if (action === 'accept') result = await gc.accept(gcRow.id);
    else if (action === 'decline') result = await gc.decline(gcRow.id);
    else result = await gc.cancel(gcRow.id);
    if (!result.success) {
      setErrorByKey((prev) => ({ ...prev, [key]: result.error ?? 'Something went wrong.' }));
    } else {
      if (action === 'accept') setActiveTab('active');
      if (action === 'decline' || action === 'cancel') setActiveTab('history');
    }
    setActingKey(null);
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-4xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Swords className="text-red-400" size={28} /> Head-to-Head
          </h2>
          <p className="text-slate-400 mt-1 text-sm">
            Fade other users&apos; bets — odds-matched, peer-to-peer. Game challenges land here too.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void h2h.refresh()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
                isActive
                  ? 'border-slate-600 bg-slate-800 text-white'
                  : 'border-slate-800 bg-slate-900/50 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    isActive ? 'bg-slate-700 text-slate-200' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {combinedError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 mb-4 text-sm text-red-300 flex items-center gap-2">
          <AlertCircle size={16} /> Failed to load: {combinedError}
        </div>
      )}

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 py-16 text-center">
          <Swords className="mx-auto text-slate-700 mb-3" size={40} />
          <p className="text-slate-400 font-medium">{emptyCopy(activeTab)}</p>
          <p className="text-slate-600 text-xs mt-1">{emptyHint(activeTab)}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((row) =>
            row.kind === 'h2h' ? (
              <HeadToHeadCard
                key={`h2h-${row.h2h.id}`}
                h2h={row.h2h}
                perspective={activeTab === 'outgoing' ? 'challenger' : activeTab === 'incoming' ? 'original' : 'auto'}
                currentUserId={currentUserId}
                opponentName={h2h.opponentNameFor(row.h2h)}
                isActing={actingKey === `h2h:${row.h2h.id}`}
                errorMsg={errorByKey[`h2h:${row.h2h.id}`]}
                onAccept={activeTab === 'incoming' ? () => void handleH2hAction(row.h2h, 'accept') : undefined}
                onDecline={activeTab === 'incoming' ? () => void handleH2hAction(row.h2h, 'decline') : undefined}
                onCancel={activeTab === 'outgoing' ? () => void handleH2hAction(row.h2h, 'cancel') : undefined}
              />
            ) : (
              <GameChallengeInboxCard
                key={`gc-${row.gc.id}`}
                gc={row.gc}
                currentUserId={currentUserId}
                opponentName={gc.opponentLabel(row.gc)}
                isActing={actingKey === `gc:${row.gc.id}`}
                errorMsg={errorByKey[`gc:${row.gc.id}`]}
                onAccept={activeTab === 'incoming' ? () => void handleGcAction(row.gc, 'accept') : undefined}
                onDecline={activeTab === 'incoming' ? () => void handleGcAction(row.gc, 'decline') : undefined}
                onCancel={activeTab === 'outgoing' ? () => void handleGcAction(row.gc, 'cancel') : undefined}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
};

interface HeadToHeadCardProps {
  h2h: HeadToHead;
  perspective: 'original' | 'challenger' | 'auto';
  currentUserId: string | null;
  opponentName: string;
  isActing: boolean;
  errorMsg?: string;
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
}

const HeadToHeadCard: React.FC<HeadToHeadCardProps> = ({
  h2h,
  perspective,
  currentUserId,
  opponentName,
  isActing,
  errorMsg,
  onAccept,
  onDecline,
  onCancel,
}) => {
  const resolvedPerspective: 'original' | 'challenger' =
    perspective !== 'auto'
      ? perspective
      : h2h.originalUserId === currentUserId
        ? 'original'
        : 'challenger';

  const totalEscrow = h2h.originalStake + h2h.challengerStake;
  const myStake = resolvedPerspective === 'original' ? h2h.originalStake : h2h.challengerStake;
  const myProfit = resolvedPerspective === 'original' ? h2h.challengerStake : h2h.originalStake;
  const winsIf = resolvedPerspective === 'original' ? 'pick wins' : 'pick loses';

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Counter-bet · vs. {opponentName} · {h2h.marketTitle}
          </p>
          <p className="font-semibold text-slate-100 truncate">
            <span className="text-blue-300">{h2h.originalSide}</span> @ {h2h.originalOdds.toFixed(2)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 inline-flex items-center gap-1">
            <Clock3 size={10} />
            {h2h.createdAt.toLocaleString()}
          </p>
        </div>
        <H2hStatusBadge status={h2h.status} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <Stat label="Your stake" value={`$${myStake.toFixed(2)}`} tone="neutral" />
        <Stat label={`Win if ${winsIf}`} value={`$${myProfit.toFixed(2)}`} tone="positive" />
        <Stat label="Total pot" value={`$${totalEscrow.toFixed(2)}`} tone="muted" />
      </div>

      {errorMsg && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-300">
          <AlertCircle size={12} className="mt-0.5 shrink-0" /> {errorMsg}
        </div>
      )}

      {(onAccept || onDecline || onCancel) && (
        <div className="mt-3 flex items-center justify-end gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isActing}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <XIcon size={12} /> Cancel challenge
            </button>
          )}
          {onDecline && (
            <button
              type="button"
              onClick={onDecline}
              disabled={isActing}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <XIcon size={12} /> Deny
            </button>
          )}
          {onAccept && (
            <button
              type="button"
              onClick={onAccept}
              disabled={isActing}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/90 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
            >
              <Check size={12} /> Accept (${h2h.originalStake.toFixed(2)})
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const H2hStatusBadge: React.FC<{ status: HeadToHeadStatus }> = ({ status }) => {
  const map: Record<HeadToHeadStatus, { label: string; cls: string }> = {
    PENDING_ACCEPT: { label: 'Awaiting accept', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
    ACCEPTED: { label: 'Locked in', cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
    DECLINED: { label: 'Denied', cls: 'border-slate-700 bg-slate-800 text-slate-400' },
    CANCELLED: { label: 'Cancelled', cls: 'border-slate-700 bg-slate-800 text-slate-400' },
    WON_BY_ORIGINAL: { label: 'Original won', cls: 'border-blue-500/30 bg-blue-500/10 text-blue-300' },
    WON_BY_CHALLENGER: { label: 'Challenger won', cls: 'border-red-500/30 bg-red-500/10 text-red-300' },
    PUSH: { label: 'Push', cls: 'border-slate-700 bg-slate-800 text-slate-400' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
};

interface GameChallengeInboxCardProps {
  gc: GameChallengeDoc;
  currentUserId: string | null;
  opponentName: string;
  isActing: boolean;
  errorMsg?: string;
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
}

const GameChallengeInboxCard: React.FC<GameChallengeInboxCardProps> = ({
  gc,
  currentUserId,
  opponentName,
  isActing,
  errorMsg,
  onAccept,
  onDecline,
  onCancel,
}) => {
  const youAreChallenger = currentUserId === gc.challengerUid;
  const yourPick = youAreChallenger ? gc.challengerPickLabel : gc.opponentPickLabel;
  const theirPick = youAreChallenger ? gc.opponentPickLabel : gc.challengerPickLabel;

  return (
    <div className="rounded-2xl border border-amber-900/40 bg-amber-950/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90">
            Game challenge · vs. {opponentName}
          </p>
          <p className="font-semibold text-slate-100 line-clamp-2 mt-0.5">{gc.marketTitle}</p>
          <p className="text-[11px] text-slate-400 mt-1">
            You: <span className="text-emerald-300/95">{yourPick}</span>
            {' · '}
            Them: <span className="text-slate-300">{theirPick}</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1 inline-flex items-center gap-1">
            <Clock3 size={10} />
            {gc.createdAt.toDate().toLocaleString()}
          </p>
        </div>
        <GcStatusBadge status={gc.status} />
      </div>

      {errorMsg && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-300">
          <AlertCircle size={12} className="mt-0.5 shrink-0" /> {errorMsg}
        </div>
      )}

      {(onAccept || onDecline || onCancel) && (
        <div className="mt-3 flex items-center justify-end gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isActing}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <XIcon size={12} /> Cancel invite
            </button>
          )}
          {onDecline && (
            <button
              type="button"
              onClick={onDecline}
              disabled={isActing}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <XIcon size={12} /> Deny
            </button>
          )}
          {onAccept && (
            <button
              type="button"
              onClick={onAccept}
              disabled={isActing}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/90 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
            >
              <Check size={12} /> Accept
            </button>
          )}
        </div>
      )}

      {gc.status === 'ACTIVE' && (
        <p className="mt-3 text-[11px] text-slate-500">
          Locks when the sim or scores grade — winner gets the tally on the leaderboard.
        </p>
      )}
    </div>
  );
};

const GcStatusBadge: React.FC<{ status: GameChallengeStatus }> = ({ status }) => {
  const map: Record<GameChallengeStatus, { label: string; cls: string }> = {
    PENDING_ACCEPT: { label: 'Awaiting accept', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
    ACTIVE: { label: 'Live', cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
    DECLINED: { label: 'Denied', cls: 'border-slate-700 bg-slate-800 text-slate-400' },
    CANCELLED: { label: 'Cancelled', cls: 'border-slate-700 bg-slate-800 text-slate-400' },
    EXPIRED: { label: 'Expired', cls: 'border-slate-700 bg-slate-800 text-slate-400' },
    COMPLETED_CHALLENGER: { label: 'Challenger won', cls: 'border-blue-500/30 bg-blue-500/10 text-blue-300' },
    COMPLETED_OPPONENT: { label: 'Opponent won', cls: 'border-red-500/30 bg-red-500/10 text-red-300' },
    PUSH: { label: 'Push', cls: 'border-slate-700 bg-slate-800 text-slate-400' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
};

const Stat: React.FC<{ label: string; value: string; tone: 'neutral' | 'positive' | 'muted' }> = ({ label, value, tone }) => {
  const valueClass = {
    neutral: 'text-slate-100',
    positive: 'text-emerald-300',
    muted: 'text-slate-400',
  }[tone];
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-0.5 font-bold ${valueClass}`}>{value}</p>
    </div>
  );
};

function emptyCopy(bucket: HeadToHeadBucket): string {
  switch (bucket) {
    case 'incoming':
      return 'Nothing needs your OK yet.';
    case 'outgoing':
      return 'No invites waiting on them.';
    case 'active':
      return 'No live counters or challenges.';
    case 'history':
      return 'No past peer matchups yet.';
  }
}

function emptyHint(bucket: HeadToHeadBucket): string {
  switch (bucket) {
    case 'incoming':
      return 'Send a counter or game challenge to someone.';
    case 'outgoing':
      return 'Wait for them to accept.';
    case 'active':
      return 'The game is in progress.';
    case 'history':
      return 'The game has ended.';
  }
}

function friendlyH2hError(code: string): string {
  switch (code) {
    case 'H2H_NOT_FOUND':
      return 'This challenge no longer exists.';
    case 'WRONG_USER':
      return "You can't take this action on this challenge.";
    case 'WRONG_STATUS':
      return 'This challenge has already been resolved.';
    case 'EVENT_STARTED':
      return 'The game already started — this challenge is locked.';
    case 'INSUFFICIENT_FUNDS':
      return "You don't have enough funds to accept.";
    case 'USER_NOT_FOUND':
      return 'Account not found. Try signing in again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
