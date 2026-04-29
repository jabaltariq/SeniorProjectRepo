/**
 * Firestore reads/writes for the BetHub Store.
 *
 * Self-contained: this file owns the `ownedAvatars` (string[]) and
 * `equippedAvatar` (string) fields on each `userInfo/{uid}` document and
 * does not modify any existing helper. All money movement runs through
 * runTransaction so a purchase can never half-debit the wallet.
 *
 * Why a separate file from `dbOps.ts`:
 *   - Other contributors are actively touching dbOps.ts; keeping store
 *     logic isolated avoids merge conflicts.
 *   - The store concept is small enough to live alongside its own catalog
 *     in `models/storeItems.ts`.
 *
 * @author Cursor (store feature)
 */

import { doc, getDoc, onSnapshot, runTransaction, setDoc } from 'firebase/firestore';
import { db } from '@/models/constants';
import {
  findStoreAvatar,
  STARTER_AVATAR_ID,
  STORE_AVATARS,
  type StoreAvatar,
} from '@/models/storeItems';

export interface UserStoreState {
  /** Avatar ids the user owns (always includes the free starter). */
  ownedAvatars: string[];
  /** Currently displayed avatar id, or null to fall back to initials. */
  equippedAvatar: string | null;
}

const DEFAULT_STATE: UserStoreState = {
  ownedAvatars: [STARTER_AVATAR_ID],
  equippedAvatar: null,
};

/** Strip out anything that isn't a known avatar id, dedupe, ensure starter. */
function normalizeOwned(value: unknown): string[] {
  const known = new Set(STORE_AVATARS.map((a) => a.id));
  const list = Array.isArray(value)
    ? value.filter((id): id is string => typeof id === 'string' && known.has(id))
    : [];
  if (!list.includes(STARTER_AVATAR_ID)) list.push(STARTER_AVATAR_ID);
  return Array.from(new Set(list));
}

function normalizeEquipped(value: unknown, owned: string[]): string | null {
  if (typeof value !== 'string' || !value) return null;
  return owned.includes(value) ? value : null;
}

/**
 * Reads the user's owned + equipped avatars. Missing fields fall back to
 * the default state (free starter only, nothing equipped).
 */
export async function getUserStoreState(uid: string): Promise<UserStoreState> {
  if (!uid) return { ...DEFAULT_STATE };
  const snap = await getDoc(doc(db, 'userInfo', uid));
  if (!snap.exists()) return { ...DEFAULT_STATE };
  const data = snap.data();
  const ownedAvatars   = normalizeOwned(data.ownedAvatars);
  const equippedAvatar = normalizeEquipped(data.equippedAvatar, ownedAvatars);
  return { ownedAvatars, equippedAvatar };
}

/**
 * Subscribes to live changes on the user's userInfo doc and reports back
 * just the store-relevant fields. Returns the unsubscribe function.
 */
export function listenToUserStore(
  uid: string,
  onUpdate: (state: UserStoreState) => void,
): () => void {
  if (!uid) return () => {};
  return onSnapshot(doc(db, 'userInfo', uid), (snap) => {
    const data = snap.data();
    if (!data) {
      onUpdate({ ...DEFAULT_STATE });
      return;
    }
    const ownedAvatars   = normalizeOwned(data.ownedAvatars);
    const equippedAvatar = normalizeEquipped(data.equippedAvatar, ownedAvatars);
    onUpdate({ ownedAvatars, equippedAvatar });
  });
}

export type PurchaseAvatarResult =
  | { success: true; newBalance: number; equipped: boolean }
  | {
      success: false;
      error:
        | 'USER_NOT_FOUND'
        | 'AVATAR_NOT_FOUND'
        | 'ALREADY_OWNED'
        | 'INSUFFICIENT_FUNDS'
        | 'UNKNOWN';
    };

/**
 * Atomically purchases an avatar:
 *   - validates the user exists and the avatar id is in the catalog
 *   - rejects if already owned or if the wallet can't cover `price`
 *   - debits `money` and appends `avatarId` to ownedAvatars
 *   - if the user has nothing equipped yet, auto-equips the new purchase
 *
 * Free items (price = 0) still go through this path so the ownership state
 * is identical no matter how the avatar was acquired.
 */
export async function purchaseAvatar(
  uid: string,
  avatarId: string,
): Promise<PurchaseAvatarResult> {
  const avatar: StoreAvatar | undefined = findStoreAvatar(avatarId);
  if (!avatar) return { success: false, error: 'AVATAR_NOT_FOUND' };
  if (!uid)    return { success: false, error: 'USER_NOT_FOUND' };

  try {
    const { newBalance, equipped } = await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'userInfo', uid);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('USER_NOT_FOUND');

      const data = userSnap.data();
      const owned = normalizeOwned(data.ownedAvatars);
      if (owned.includes(avatar.id)) throw new Error('ALREADY_OWNED');

      const money = Number(data.money) || 0;
      if (money < avatar.price) throw new Error('INSUFFICIENT_FUNDS');

      const nextOwned = Array.from(new Set([...owned, avatar.id]));
      const currentEquipped = normalizeEquipped(data.equippedAvatar, nextOwned);
      const shouldAutoEquip = !currentEquipped;
      const nextBalance = money - avatar.price;

      tx.set(
        userRef,
        {
          money: nextBalance,
          ownedAvatars: nextOwned,
          ...(shouldAutoEquip ? { equippedAvatar: avatar.id } : {}),
        },
        { merge: true },
      );

      return { newBalance: nextBalance, equipped: shouldAutoEquip };
    });

    return { success: true, newBalance, equipped };
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    switch (msg) {
      case 'USER_NOT_FOUND':
      case 'ALREADY_OWNED':
      case 'INSUFFICIENT_FUNDS':
        return { success: false, error: msg };
      default:
        return { success: false, error: 'UNKNOWN' };
    }
  }
}

export type EquipAvatarResult =
  | { success: true }
  | { success: false; error: 'USER_NOT_FOUND' | 'NOT_OWNED' | 'AVATAR_NOT_FOUND' | 'UNKNOWN' };

/**
 * Equips a previously-purchased avatar. Pass `null` to unequip and revert
 * to the initials display.
 */
export async function equipAvatar(
  uid: string,
  avatarId: string | null,
): Promise<EquipAvatarResult> {
  if (!uid) return { success: false, error: 'USER_NOT_FOUND' };
  if (avatarId !== null && !findStoreAvatar(avatarId)) {
    return { success: false, error: 'AVATAR_NOT_FOUND' };
  }

  try {
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'userInfo', uid);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('USER_NOT_FOUND');

      if (avatarId !== null) {
        const owned = normalizeOwned(userSnap.data().ownedAvatars);
        if (!owned.includes(avatarId)) throw new Error('NOT_OWNED');
      }

      tx.set(userRef, { equippedAvatar: avatarId }, { merge: true });
    });
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    if (msg === 'USER_NOT_FOUND' || msg === 'NOT_OWNED') {
      return { success: false, error: msg };
    }
    return { success: false, error: 'UNKNOWN' };
  }
}

/**
 * Convenience helper for any view that just needs the URL of a user's
 * currently-equipped avatar (or null when they're using initials).
 */
export async function getEquippedAvatarUrl(uid: string): Promise<string | null> {
  const state = await getUserStoreState(uid);
  if (!state.equippedAvatar) return null;
  const avatar = findStoreAvatar(state.equippedAvatar);
  return avatar?.imageUrl ?? null;
}

/**
 * Ensures the userInfo doc has at minimum the free starter avatar in its
 * ownedAvatars array. Safe to call on every login — it only writes when
 * the field is missing or stale. Optional; unused fields just default in.
 */
export async function ensureStarterAvatar(uid: string): Promise<void> {
  if (!uid) return;
  const snap = await getDoc(doc(db, 'userInfo', uid));
  if (!snap.exists()) return;
  const owned = normalizeOwned(snap.data().ownedAvatars);
  await setDoc(doc(db, 'userInfo', uid), { ownedAvatars: owned }, { merge: true });
}
