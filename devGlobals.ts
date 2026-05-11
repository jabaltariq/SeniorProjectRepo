import { cancelPendingMockNflBetsForUser } from '@/services/dbOps';

declare global {
  interface Window {
    /**
     * Dev only: cancels all pending mock-NFL-only slips for `localStorage.uid`
     * (refunds stakes). Run in the console while signed in.
     */
    bethubCancelMockPending?: () => Promise<{ cancelledIds: string[] }>;
  }
}

if (import.meta.env.DEV) {
  window.bethubCancelMockPending = async () => {
    const uid = localStorage.getItem('uid');
    if (!uid) throw new Error('Not signed in — localStorage.uid is missing.');
    return cancelPendingMockNflBetsForUser(uid);
  };
}
