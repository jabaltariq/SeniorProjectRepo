import type { SocialActivity } from '@/models';

/** Merge bet-based community rows with peer competition rows, newest first. */
export function mergeActivityFeeds(
  betRows: SocialActivity[],
  peerRows: SocialActivity[],
  cap = 60,
): SocialActivity[] {
  const merged = [...betRows, ...peerRows];
  merged.sort((a, b) => (b.sortKey ?? 0) - (a.sortKey ?? 0));
  return merged.slice(0, cap);
}
