export enum MarketType {
  SPORTS = 'SPORTS',
  HOBBIES = 'HOBBIES',
  TRENDS = 'TRENDS'
}

export interface Market {
  id: string;
  sport_key: string;        // ← ADDED: Odds API sport key e.g. "basketball_nba"
  title: string;
  subtitle: string;
  category: string;
  type: MarketType;
  options: MarketOption[];
  startTime: string;
  status: 'LIVE' | 'UPCOMING' | 'CLOSED';
}

export interface MarketOption {
  id: string;
  label: string;
  odds: number;
  marketKey?: 'h2h' | 'spreads' | 'totals' | 'outrights';
}

// ── NEW: one leg inside a parlay ─────────────────────────────────
export interface ParlayLeg {
  marketId: string;
  marketTitle: string;
  sportKey: string;
  optionId: string;
  optionLabel: string;
  odds: number;
  marketKey: string;
  result?: 'WON' | 'LOST' | 'PUSH' | 'PENDING';
}

// ── NEW: possible settlement states for a bet ────────────────────
export type BetStatus = 'PENDING' | 'WON' | 'LOST' | 'PUSH' | 'CANCELLED';

export interface Bet {
  id: string;
  userID?: string;
  marketId: string;
  marketTitle: string;
  optionLabel: string;
  betType?: 'single' | 'parlay';
  stake: number;
  odds: number;
  potentialPayout: number;
  placedAt: Date;
  legCount?: number;            // ← ADDED
  parlayLegs?: ParlayLeg[];     // ← UPDATED: was inline anonymous type, now ParlayLeg
  // Settlement fields
  status?: BetStatus;           // ← ADDED: undefined on old bets = treat as PENDING
  eventId?: string;             // ← ADDED: Odds API event ID (singles only)
  sportKey?: string;            // ← ADDED: e.g. "basketball_nba" (singles only)
  settledAt?: Date;             // ← ADDED
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  avatar: string;
  netWorth: number;
  winRate: number;
  rank: number;
  isCurrentUser?: boolean;
}

export interface SocialActivity {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  action: string;
  target: string;
  timestamp: string;
}

export interface Friend {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline' | 'away';
  lastActive: string;
  privacyEnabled: boolean;
}

export interface Challenge {
  id: string;
  challengerId: string;
  opponentId: string;
  marketId: string;
  marketTitle: string;
  stake: number;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'COMPLETED';
}

export interface Message {
  id: string;
  sender: 'current' | 'other'
  text: string;
  timestamp: Date;
}