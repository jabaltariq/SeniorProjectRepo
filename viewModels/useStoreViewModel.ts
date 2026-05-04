/**
 * View-model that backs StoreView.
 *
 * Subscribes to the user's owned/equipped avatars in real time so that a
 * purchase or equip change reflects immediately across every component
 * that re-reads the store state. Wallet balance is intentionally NOT
 * tracked here — useBettingViewModel already owns that subscription, and
 * StoreView receives the live balance as a prop from DashboardView.
 *
 * @author Cursor (store feature)
 */

import { useCallback, useEffect, useState } from 'react';
import {
  equipAvatar as equipAvatarOp,
  listenToUserStore,
  purchaseAvatar as purchaseAvatarOp,
  type EquipAvatarResult,
  type PurchaseAvatarResult,
  type UserStoreState,
} from '@/services/storeOps';
import { STARTER_AVATAR_ID } from '@/models/storeItems';

interface StoreFeedback {
  kind: 'success' | 'error';
  message: string;
}

const INITIAL_STATE: UserStoreState = {
  ownedAvatars: [STARTER_AVATAR_ID],
  equippedAvatar: null,
};

export function useStoreViewModel(uid: string | null) {
  const [storeState, setStoreState] = useState<UserStoreState>(INITIAL_STATE);
  const [loading, setLoading] = useState<boolean>(Boolean(uid));
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<StoreFeedback | null>(null);

  // Live subscription: any purchase/equip from this client OR another
  // device pushes the new state in immediately, so the UI can't disagree
  // with Firestore.
  useEffect(() => {
    if (!uid) {
      setStoreState(INITIAL_STATE);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = listenToUserStore(uid, (next) => {
      setStoreState(next);
      setLoading(false);
    });
    return unsubscribe;
  }, [uid]);

  // Auto-clear toast after 3s so the UI doesn't get stale.
  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), 3000);
    return () => window.clearTimeout(t);
  }, [feedback]);

  const buyAvatar = useCallback(
    async (avatarId: string): Promise<PurchaseAvatarResult> => {
      if (!uid) {
        const result: PurchaseAvatarResult = { success: false, error: 'USER_NOT_FOUND' };
        setFeedback({ kind: 'error', message: 'You need to be signed in to buy avatars.' });
        return result;
      }
      setPendingId(avatarId);
      try {
        const result = await purchaseAvatarOp(uid, avatarId);
        if (result.success) {
          setFeedback({
            kind: 'success',
            message: result.equipped
              ? 'Purchased and equipped! Check your account page.'
              : 'Purchased! Tap Equip to wear it.',
          });
        } else {
          setFeedback({ kind: 'error', message: friendlyPurchaseError(result.error) });
        }
        return result;
      } finally {
        setPendingId(null);
      }
    },
    [uid],
  );

  const equipAvatar = useCallback(
    async (avatarId: string | null): Promise<EquipAvatarResult> => {
      if (!uid) {
        const result: EquipAvatarResult = { success: false, error: 'USER_NOT_FOUND' };
        setFeedback({ kind: 'error', message: 'You need to be signed in to equip avatars.' });
        return result;
      }
      setPendingId(avatarId ?? '__unequip__');
      try {
        const result = await equipAvatarOp(uid, avatarId);
        if (result.success) {
          setFeedback({
            kind: 'success',
            message: avatarId ? 'Equipped! It now shows on your account.' : 'Avatar removed.',
          });
        } else {
          setFeedback({ kind: 'error', message: friendlyEquipError(result.error) });
        }
        return result;
      } finally {
        setPendingId(null);
      }
    },
    [uid],
  );

  const dismissFeedback = useCallback(() => setFeedback(null), []);

  return {
    ownedAvatars: storeState.ownedAvatars,
    equippedAvatar: storeState.equippedAvatar,
    loading,
    pendingId,
    feedback,
    buyAvatar,
    equipAvatar,
    dismissFeedback,
  };
}

function friendlyPurchaseError(code: PurchaseAvatarResult extends { error: infer E } ? E : never): string {
  switch (code) {
    case 'ALREADY_OWNED':      return 'You already own this avatar.';
    case 'INSUFFICIENT_FUNDS': return 'Not enough funds to buy this avatar.';
    case 'USER_NOT_FOUND':     return 'Account not found. Try signing in again.';
    case 'AVATAR_NOT_FOUND':   return 'That avatar isn\'t available right now.';
    default:                   return 'Something went wrong. Please try again.';
  }
}

function friendlyEquipError(code: EquipAvatarResult extends { error: infer E } ? E : never): string {
  switch (code) {
    case 'NOT_OWNED':         return 'You need to buy this avatar first.';
    case 'USER_NOT_FOUND':    return 'Account not found. Try signing in again.';
    case 'AVATAR_NOT_FOUND':  return 'That avatar isn\'t available right now.';
    default:                  return 'Something went wrong. Please try again.';
  }
}
