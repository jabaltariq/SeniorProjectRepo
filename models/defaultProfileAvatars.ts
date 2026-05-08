export const DEFAULT_PROFILE_AVATAR_PATHS = [
  'profile-defaults/bubble-bandit.png',
  'profile-defaults/red-panda-block.png',
  'profile-defaults/shadow-soldier.png',
  'profile-defaults/assassin-crest.png',
  'profile-defaults/doge.png',
  'profile-defaults/peter.png',
  'profile-defaults/spartan.png',
  'profile-defaults/scarface.png',
  'profile-defaults/minecraft.png',
  'profile-defaults/dog-closeup.png',
] as const;

export const MODE_TEST_DEFAULT_AVATAR_PATH = 'profile-defaults/doge.png';
export const ANONYMOUS_PROFILE_AVATAR_PATH = 'profile-defaults/anonymous.png';
export const FATCAT97_DEFAULT_AVATAR_PATH = 'profile-defaults/dog-closeup.png';
export const BESTBETTER_DEFAULT_AVATAR_PATH = 'profile-defaults/spartan.png';

export function defaultAvatarForUid(uid: string | null, displayName?: string): string {
  const name = displayName?.toLowerCase();
  if (name === 'modetest') return MODE_TEST_DEFAULT_AVATAR_PATH;
  if (name === 'fatcat97') return FATCAT97_DEFAULT_AVATAR_PATH;
  if (name === 'bestbetter') return BESTBETTER_DEFAULT_AVATAR_PATH;
  if (!uid) return DEFAULT_PROFILE_AVATAR_PATHS[0];

  let hash = 0;
  for (let i = 0; i < uid.length; i += 1) {
    hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  }
  return DEFAULT_PROFILE_AVATAR_PATHS[hash % DEFAULT_PROFILE_AVATAR_PATHS.length];
}

export function randomDefaultProfileAvatar(): string {
  return DEFAULT_PROFILE_AVATAR_PATHS[Math.floor(Math.random() * DEFAULT_PROFILE_AVATAR_PATHS.length)];
}

export function isDefaultProfileAvatarPath(value: unknown): value is typeof DEFAULT_PROFILE_AVATAR_PATHS[number] {
  return typeof value === 'string' && DEFAULT_PROFILE_AVATAR_PATHS.includes(value as typeof DEFAULT_PROFILE_AVATAR_PATHS[number]);
}
