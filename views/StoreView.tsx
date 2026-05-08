/**
 * BetHub Store — buy and equip profile pictures.
 *
 * Renders the catalog from `models/storeItems.ts` as a responsive grid of
 * cards. Each card surfaces:
 *   - the rarity tier (chip)
 *   - the price (or OWNED / EQUIPPED if applicable)
 *   - the primary action: Buy / Equip / Equipped
 *   - inline affordability hints when the wallet can't cover the price
 *
 * The component is intentionally pure-UI: all real work lives in
 * `useStoreViewModel`, which talks to `services/storeOps.ts`. Wallet
 * balance is read from props so we don't double-subscribe to userInfo.
 *
 * @author Cursor (store feature)
 */

import React from 'react';
import { CheckCircle2, Coins, Lock, Loader2, ShoppingBag, Sparkles, Wallet } from 'lucide-react';
import {
  RARITY_META,
  STARTER_AVATAR_ID,
  STORE_AVATARS,
  type StoreAvatar,
} from '../models/storeItems';
import { useStoreViewModel } from '../viewModels/useStoreViewModel';

interface StoreViewProps {
  /** Live wallet balance from useBettingViewModel (already wired in DashboardView). */
  balance: number;
  /** Current user's Firebase Auth uid; null = signed-out (store is read-only). */
  currentUserId: string | null;
}

export const StoreView: React.FC<StoreViewProps> = ({ balance, currentUserId }) => {
  const {
    ownedAvatars,
    equippedAvatar,
    loading,
    pendingId,
    feedback,
    buyAvatar,
    equipAvatar,
    dismissFeedback,
  } = useStoreViewModel(currentUserId);

  const ownedSet = new Set(ownedAvatars);
  const safeBalance = Number.isFinite(balance) ? Math.max(0, balance) : 0;

  return (
    <div className="animate-in fade-in duration-500 w-full">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShoppingBag className="text-violet-400" size={24} /> Store
          </h2>
          <p className="text-slate-400 text-sm mt-1 max-w-xl">
            Shop some profile pictures that represent you. New looks update every season.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-300">
          <Wallet size={16} />
          Wallet
          <span className="text-emerald-200">${safeBalance.toFixed(2)}</span>
        </div>
      </header>

      {feedback && (
        <button
          type="button"
          onClick={dismissFeedback}
          className={`mb-4 w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
            feedback.kind === 'success'
              ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15'
              : 'border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/15'
          }`}
        >
          {feedback.message}
          <span className="ml-2 text-[10px] uppercase tracking-wider opacity-70">tap to dismiss</span>
        </button>
      )}

      {loading ? (
        <div className="glass-card rounded-2xl p-10 border border-slate-800 text-center text-slate-400 inline-flex w-full items-center justify-center gap-3">
          <Loader2 size={18} className="animate-spin" /> Loading store...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {STORE_AVATARS.map((avatar) => (
            <StoreCard
              key={avatar.id}
              avatar={avatar}
              owned={ownedSet.has(avatar.id)}
              equipped={equippedAvatar === avatar.id}
              balance={safeBalance}
              pending={pendingId === avatar.id}
              disabled={!currentUserId}
              onBuy={() => buyAvatar(avatar.id)}
              onEquip={() => equipAvatar(avatar.id)}
            />
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-slate-500 leading-relaxed">
        Avatars are cosmetic only. The free starter ({findName(STARTER_AVATAR_ID)})
        is automatically owned by every account.
      </p>
    </div>
  );
};

interface StoreCardProps {
  avatar: StoreAvatar;
  owned: boolean;
  equipped: boolean;
  balance: number;
  pending: boolean;
  disabled: boolean;
  onBuy: () => void;
  onEquip: () => void;
}

const StoreCard: React.FC<StoreCardProps> = ({
  avatar, owned, equipped, balance, pending, disabled, onBuy, onEquip,
}) => {
  const rarity = RARITY_META[avatar.rarity];
  const canAfford = balance >= avatar.price;
  const showLock = !owned && !canAfford;

  return (
    <article
      className={`glass-card rounded-2xl border border-slate-800 p-5 flex flex-col gap-4 transition-shadow ${
        equipped ? `ring-2 ${rarity.ring} shadow-lg` : 'hover:border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`relative w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden shrink-0 ${
            equipped ? `ring-2 ring-offset-2 ring-offset-slate-900 ${rarity.ring}` : ''
          }`}
        >
          <img
            src={avatar.imageUrl}
            alt={avatar.name}
            className="w-full h-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          {equipped && (
            <span className="absolute -bottom-1 -right-1 inline-flex items-center justify-center rounded-full bg-emerald-500 text-white p-1 border-2 border-slate-900">
              <CheckCircle2 size={14} />
            </span>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${rarity.chip}`}>
            <Sparkles size={10} /> {rarity.label}
          </span>
          {avatar.price === 0 ? (
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              Free
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-300">
              <Coins size={13} /> ${avatar.price.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-base font-bold text-slate-100">{avatar.name}</h3>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{avatar.description}</p>
      </div>

      <div className="mt-auto pt-2 flex flex-col gap-1.5">
        {equipped ? (
          <button
            type="button"
            disabled
            className="w-full rounded-lg bg-emerald-500/15 border border-emerald-400/40 px-3 py-2 text-xs font-bold uppercase tracking-wider text-emerald-200 cursor-default inline-flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 size={13} /> Equipped
          </button>
        ) : owned ? (
          <button
            type="button"
            onClick={onEquip}
            disabled={pending || disabled}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            {pending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {pending ? 'Equipping...' : 'Equip'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onBuy}
            disabled={pending || showLock || disabled}
            title={showLock ? `Need $${avatar.price.toLocaleString()} — you have $${balance.toFixed(2)}` : undefined}
            className={`w-full rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center justify-center gap-1.5 ${
              showLock
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-violet-600 hover:bg-violet-500 text-white disabled:cursor-not-allowed disabled:opacity-50'
            }`}
          >
            {pending ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Buying...
              </>
            ) : showLock ? (
              <>
                <Lock size={13} /> Need ${avatar.price.toLocaleString()}
              </>
            ) : avatar.price === 0 ? (
              <>
                <Coins size={13} /> Claim free
              </>
            ) : (
              <>
                <Coins size={13} /> Buy ${avatar.price.toLocaleString()}
              </>
            )}
          </button>
        )}
        {owned && !equipped && (
          <span className="text-center text-[10px] uppercase tracking-wider text-slate-500">
            In your collection
          </span>
        )}
      </div>
    </article>
  );
};

function findName(id: string): string {
  const a = STORE_AVATARS.find((x) => x.id === id);
  return a?.name ?? id;
}
