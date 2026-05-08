export const PROFILE_BACKGROUND_URLS = [
  // Background refs:
  // https://www.reddit.com/media?url=https%3A%2F%2Fi.redd.it%2Fnduksi52zrs41.jpg
  // https://img.goodfon.com/wallpaper/nbig/b/c3/grand-theft-auto-v-gta-5-game-city-motorbike-gta-v.webp
  // https://wallpapers.com/images/hd/gta-5-2560x1440-freeway-lights-hrafdinvdooyde19.jpg
  'https://www.reddit.com/media?url=https%3A%2F%2Fi.redd.it%2Fnduksi52zrs41.jpg',
  'https://img.goodfon.com/wallpaper/nbig/b/c3/grand-theft-auto-v-gta-5-game-city-motorbike-gta-v.webp',
  'https://wallpapers.com/images/hd/gta-5-2560x1440-freeway-lights-hrafdinvdooyde19.jpg',
] as const;

export function profileBackgroundForUid(uid: string | null, displayName?: string): string {
  if (displayName?.toLowerCase() === 'zoomerchud') return PROFILE_BACKGROUND_URLS[1];
  if (!uid) return PROFILE_BACKGROUND_URLS[0];

  let hash = 0;
  for (let i = 0; i < uid.length; i += 1) {
    hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  }
  return PROFILE_BACKGROUND_URLS[hash % PROFILE_BACKGROUND_URLS.length];
}

export function randomProfileBackground(): string {
  return PROFILE_BACKGROUND_URLS[Math.floor(Math.random() * PROFILE_BACKGROUND_URLS.length)];
}
