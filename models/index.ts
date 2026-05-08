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
  result?: 'WON' | 'LOST' | 'PUSH' | 'VOID' | 'PENDING';
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
  eventStartsAt?: Date;         // ← ADDED: kickoff time (singles only) — used by H2H lock
  settledAt?: Date;             // ← ADDED
  // Optional metadata persisted alongside bets in Firestore. Declared here so
  // call sites that read/write these fields don't need `as any` casts and so
  // tsc catches typos.
  isFree?: boolean;             // ← ADDED: bet of the day claims (no stake debit)
  boostApplied?: 'double_payout' | 'money_back' | null; // ← ADDED: weekly boost
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

// ── Head-to-Head (peer-to-peer side wager) ───────────────────────
//
// A challenger picks a pending bet placed by another user and proposes to
// fade it. Stakes are odds-matched: the original puts up `stake = S`, the
// challenger puts up `stake × (odds − 1)`. Total escrow = `S × odds`.
// Winner of the underlying real-world event takes the entire escrow.
//
// The original bookmaker bet is independent and is settled by the existing
// settleBet() flow against the user's wallet. This H2H is a separate side
// pot that lives in its own Firestore collection.
export type HeadToHeadStatus =
  | 'PENDING_ACCEPT'      // challenger has paid in; original owner has not yet accepted
  | 'ACCEPTED'            // both stakes escrowed; awaiting underlying event result
  | 'DECLINED'            // original owner declined; challenger refunded
  | 'CANCELLED'           // challenger withdrew before acceptance; challenger refunded
  | 'WON_BY_ORIGINAL'    // original's pick won; original took the escrow
  | 'WON_BY_CHALLENGER'  // original's pick lost; challenger took the escrow
  | 'PUSH';               // event pushed/voided; both sides refunded

export interface HeadToHead {
  id: string;

  // Pointer to the bet being faded (lives in the existing `bets` collection)
  originalBetId: string;
  originalUserId: string;
  originalSide: string;          // optionLabel the original user took
  originalOdds: number;          // decimal odds at the time of proposal
  originalStake: number;         // S — what the original owner escrows on accept

  // The user fading the original bet
  challengerUserId: string;
  challengerStake: number;       // S × (originalOdds − 1) — escrowed at proposal time

  // Underlying event (so settlement can resolve automatically)
  marketId: string;
  marketTitle: string;
  eventId: string;               // Odds API event id
  sportKey: string;
  eventStartsAt: Date;           // hard lock — no proposals/accepts after this

  status: HeadToHeadStatus;
  createdAt: Date;
  acceptedAt?: Date;
  settledAt?: Date;
}