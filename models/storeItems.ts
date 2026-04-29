/**
 * Static catalog of profile pictures available in the BetHub Store.
 *
 * Lives separately from `models/index.ts` and `models/constants.ts` so that
 * the store feature is fully self-contained — no edits needed to other
 * shared model files. Add or remove entries here without touching anything
 * else; the StoreView, useStoreViewModel, and ProfileView all read from
 * this list.
 *
 * Avatar art is served by the public DiceBear API (https://www.dicebear.com/),
 * which doesn't require auth and returns deterministic SVGs based on the
 * style + seed. We pin the API version so visuals never silently change.
 *
 * @author Cursor (store feature)
 */

export type StoreAvatarRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface StoreAvatar {
  /** Stable id stored in Firestore as part of ownedAvatars / equippedAvatar. */
  id: string;
  name: string;
  description: string;
  rarity: StoreAvatarRarity;
  /** Cost in BetHub fake currency. 0 means it's free for every account. */
  price: number;
  imageUrl: string;
}

const dicebear = (style: string, seed: string): string =>
  `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;

export const STORE_AVATARS: StoreAvatar[] = [
  // ── Free starter — every account already owns this ────────────
  {
    id: 'starter_blue_chip',
    name: 'Blue Chip',
    description: 'Free starter avatar. Every BetHub account owns it by default.',
    rarity: 'common',
    price: 0,
    imageUrl: dicebear('identicon', 'bethub-starter'),
  },

  // ── Common ($250 – $500) ──────────────────────────────────────
  {
    id: 'common_pixel_pal',
    name: 'Pixel Pal',
    description: 'Retro 8-bit vibes for the casual capper.',
    rarity: 'common',
    price: 250,
    imageUrl: dicebear('pixel-art', 'pixel-pal'),
  },
  {
    id: 'common_sport_fan',
    name: 'Stadium Regular',
    description: 'Friendly mascot for the weekend warrior.',
    rarity: 'common',
    price: 500,
    imageUrl: dicebear('big-smile', 'stadium-regular'),
  },

  // ── Rare ($1,500 – $2,500) ────────────────────────────────────
  {
    id: 'rare_bot',
    name: 'Quant Bot',
    description: 'Algorithmic edge, rendered in chrome.',
    rarity: 'rare',
    price: 1500,
    imageUrl: dicebear('bottts', 'quant-bot'),
  },
  {
    id: 'rare_lorelei',
    name: 'Sharp Eye',
    description: 'A subtle look that says you read the lines.',
    rarity: 'rare',
    price: 2500,
    imageUrl: dicebear('lorelei', 'sharp-eye'),
  },

  // ── Epic ($5,000 – $7,500) ────────────────────────────────────
  {
    id: 'epic_avataaars',
    name: 'High Roller',
    description: 'Suits up before kickoff. Doesn\'t flinch on a bad beat.',
    rarity: 'epic',
    price: 5000,
    imageUrl: dicebear('avataaars', 'high-roller'),
  },
  {
    id: 'epic_funmoji',
    name: 'Lucky Streak',
    description: 'Wears its win streak right on its face.',
    rarity: 'epic',
    price: 7500,
    imageUrl: dicebear('fun-emoji', 'lucky-streak'),
  },

  // ── Legendary ($15,000+) ──────────────────────────────────────
  {
    id: 'legend_micah',
    name: 'The Whale',
    description: 'Reserved for capper royalty. Every limit, lifted.',
    rarity: 'legendary',
    price: 15000,
    imageUrl: dicebear('micah', 'the-whale'),
  },
  {
    id: 'legend_thumbs',
    name: 'Hall of Famer',
    description: 'A legend\'s avatar. Wear it proudly.',
    rarity: 'legendary',
    price: 25000,
    imageUrl: dicebear('thumbs', 'hall-of-famer'),
  },
];

/** The free starter is implicitly owned by every account. */
export const STARTER_AVATAR_ID = 'starter_blue_chip';

/** Lookup helper used by StoreView, ProfileView, and useStoreViewModel. */
export function findStoreAvatar(id: string | null | undefined): StoreAvatar | undefined {
  if (!id) return undefined;
  return STORE_AVATARS.find((a) => a.id === id);
}

/** Display label + tailwind classes per rarity tier. */
export const RARITY_META: Record<StoreAvatarRarity, { label: string; chip: string; ring: string }> = {
  common:    { label: 'Common',    chip: 'bg-slate-700/80 text-slate-200 border-slate-600',          ring: 'ring-slate-600/40'  },
  rare:      { label: 'Rare',      chip: 'bg-sky-500/15 text-sky-200 border-sky-400/40',             ring: 'ring-sky-400/40'    },
  epic:      { label: 'Epic',      chip: 'bg-violet-500/15 text-violet-200 border-violet-400/40',    ring: 'ring-violet-400/40' },
  legendary: { label: 'Legendary', chip: 'bg-amber-500/20 text-amber-200 border-amber-400/50',       ring: 'ring-amber-400/60'  },
};
