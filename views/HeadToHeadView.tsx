import React, { useMemo, useState } from 'react';
import { Swords, Inbox, Send, Activity, History as HistoryIcon, Check, X as XIcon, RefreshCw, AlertCircle, Clock3 } from 'lucide-react';
import type { HeadToHead, HeadToHeadStatus } from '../models';
import { useHeadToHeadViewModel, type HeadToHeadBucket } from '../viewModels/useHeadToHeadViewModel';

interface HeadToHeadViewProps {
  currentUserId: string | null;
}

/**
 * "Head-to-Head" inbox + history page.
 *
 * Lays out the four buckets (incoming / outgoing / active / history) as tabs,
 * each rendering a list of HeadToHead cards. The current user can:
 *   - Accept/Decline an incoming proposal
 *   - Cancel an outgoing proposal (refunds them)
 *   - Just view active and historical H2Hs
 *
 * @author Cursor (head-to-head feature)
 */
export const HeadToHeadView: React.FC<HeadToHeadViewProps> = ({ currentUserId }) => {
  const {
    loading,
    error,
    buckets,
    refresh,
    accept,
    decline,
    cancel,
    opponentNameFor,
  } = useHeadToHeadViewModel(currentUserId);

  const [activeTab, setActiveTab] = useState<HeadToHeadBucket>('incoming');
  const [actingId, setActingId] = useState<string | null>(null);
  const [errorByH2H, setErrorByH2H] = useState<Record<string, string>>({});

  const tabs = useMemo(
    () => ([
      { id: 'incoming' as const, label: 'Incoming', icon: Inbox,        count: buckets.incoming.length, accent: 'text-amber-300'   },
      { id: 'outgoing' as const, label: 'Outgoing', icon: Send,         count: buckets.outgoing.length, accent: 'text-blue-300'    },
      { id: 'active'   as const, label: 'Active',   icon: Activity,     count: buckets.active.length,   accent: 'text-emerald-300' },
      { id: 'history'  as const, label: 'History',  icon: HistoryIcon,  count: buckets.history.length,  accent: 'text-slate-400'   },
    ]),
    [buckets],
  );

  const list = buckets[activeTab];

  const handleAction = async (
    h2h: HeadToHead,
    action: 'accept' | 'decline' | 'cancel',
  ) => {
    if (actingId) return;
    setActingId(h2h.id);
    setErrorByH2H((prev) => { const n = { ...prev }; delete n[h2h.id]; return n; });
    let result: { success: boolean; error?: string };
    if      (action === 'accept')  result = await accept(h2h.id);
    else if (action === 'decline') result = await decline(h2h.id);
    else                           result = await cancel(h2h.id);
    if (!result.success) {
      setErrorByH2H((prev) => ({ ...prev, [h2h.id]: friendlyError(result.error ?? 'UNKNOWN') }));
    }
    setActingId(null);
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-4xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Swords className="text-red-400" size={28} /> Head-to-Head
          </h2>
          <p className="text-slate-400 mt-1 text-sm">
            Fade other users&apos; bets — odds-matched, peer-to-peer.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </header>

      {/* Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
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
              <Icon size={14} className={isActive ? tab.accent : ''} />
              {tab.label}
              {tab.count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  isActive ? 'bg-slate-700 text-slate-200' : 'bg-slate-800 text-slate-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 mb-4 text-sm text-red-300 flex items-center gap-2">
          <AlertCircle size={16} /> Failed to load: {error}
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
          {list.map((h2h) => (
            <HeadToHeadCard
              key={h2h.id}
              h2h={h2h}
              perspective={activeTab === 'outgoing' ? 'challenger' : activeTab === 'incoming' ? 'original' : 'auto'}
              currentUserId={currentUserId}
              opponentName={opponentNameFor(h2h)}
              isActing={actingId === h2h.id}
              errorMsg={errorByH2H[h2h.id]}
              onAccept={activeTab === 'incoming'  ? () => handleAction(h2h, 'accept')  : undefined}
              onDecline={activeTab === 'incoming' ? () => handleAction(h2h, 'decline') : undefined}
              onCancel={activeTab === 'outgoing'  ? () => handleAction(h2h, 'cancel')  : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
//  Card
// ─────────────────────────────────────────────────────────────────

interface HeadToHeadCardProps {
  h2h: HeadToHead;
  /** Which seat the current user is in. 'auto' lets the card decide for active/history. */
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
      : h2h.originalUserId === currentUserId ? 'original' : 'challenger';

  const totalEscrow = h2h.originalStake + h2h.challengerStake;

  // What the current user stands to win (gross, not counting their own escrow).
  const myStake   = resolvedPerspective === 'original' ? h2h.originalStake   : h2h.challengerStake;
  const myProfit  = resolvedPerspective === 'original' ? h2h.challengerStake : h2h.originalStake;
  const winsIf    = resolvedPerspective === 'original' ? 'pick wins' : 'pick loses';

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            vs. {opponentName} · {h2h.marketTitle}
          </p>
          <p className="font-semibold text-slate-100 truncate">
            <span className="text-blue-300">{h2h.originalSide}</span>
            {' '}@ {h2h.originalOdds.toFixed(2)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 inline-flex items-center gap-1">
            <Clock3 size={10} />
            {h2h.createdAt.toLocaleString()}
          </p>
        </div>
        <StatusBadge status={h2h.status} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <Stat label="Your stake"  value={`$${myStake.toFixed(2)}`}  tone="neutral" />
        <Stat label={`Win if ${winsIf}`} value={`$${myProfit.toFixed(2)}`} tone="positive" />
        <Stat label="Total pot"   value={`$${totalEscrow.toFixed(2)}`} tone="muted" />
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
              <XIcon size={12} /> Decline
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

const StatusBadge: React.FC<{ status: HeadToHeadStatus }> = ({ status }) => {
  const map: Record<HeadToHeadStatus, { label: string; cls: string }> = {
    PENDING_ACCEPT:    { label: 'Awaiting accept', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
    ACCEPTED:          { label: 'Locked in',       cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
    DECLINED:          { label: 'Declined',        cls: 'border-slate-700 bg-slate-800 text-slate-400' },
    CANCELLED:         { label: 'Cancelled',       cls: 'border-slate-700 bg-slate-800 text-slate-400' },
    WON_BY_ORIGINAL:   { label: 'Original won',    cls: 'border-blue-500/30 bg-blue-500/10 text-blue-300' },
    WON_BY_CHALLENGER: { label: 'Challenger won',  cls: 'border-red-500/30 bg-red-500/10 text-red-300' },
    PUSH:              { label: 'Push',             cls: 'border-slate-700 bg-slate-800 text-slate-400' },
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
    neutral:  'text-slate-100',
    positive: 'text-emerald-300',
    muted:    'text-slate-400',
  }[tone];
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-0.5 font-bold ${valueClass}`}>{value}</p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
//  Empty-state copy
// ─────────────────────────────────────────────────────────────────

function emptyCopy(bucket: HeadToHeadBucket): string {
  switch (bucket) {
    case 'incoming': return 'No one has challenged your bets yet.';
    case 'outgoing': return 'No outgoing challenges.';
    case 'active':   return 'No active head-to-heads.';
    case 'history':  return 'No past head-to-heads.';
  }
}
function emptyHint(bucket: HeadToHeadBucket): string {
  switch (bucket) {
    case 'incoming': return 'Place pending bets — others can fade them and they\'ll appear here.';
    case 'outgoing': return "Use Counter on a profile or friend, or Counter-Bet on their slip, then cancel here if they haven't accepted yet.";
    case 'active':   return 'Locked-in H2Hs settle automatically when the game ends.';
    case 'history':  return 'Resolved, declined, and cancelled H2Hs land here.';
  }
}

function friendlyError(code: string): string {
  switch (code) {
    case 'H2H_NOT_FOUND':      return 'This challenge no longer exists.';
    case 'WRONG_USER':         return 'You can\'t take this action on this challenge.';
    case 'WRONG_STATUS':       return 'This challenge has already been resolved.';
    case 'EVENT_STARTED':      return 'The game already started — this challenge is locked.';
    case 'INSUFFICIENT_FUNDS': return 'You don\'t have enough funds to accept.';
    case 'USER_NOT_FOUND':     return 'Account not found. Try signing in again.';
    default:                   return 'Something went wrong. Please try again.';
  }
}
