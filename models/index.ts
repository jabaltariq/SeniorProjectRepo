export enum MarketType {
  SPORTS = 'SPORTS',
  HOBBIES = 'HOBBIES',
  TRENDS = 'TRENDS'
}

export interface Market {
  id: string;
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

export interface Bet {
  id: string;
  marketId: string;
  marketTitle: string;
  optionLabel: string;
  betType?: 'single' | 'parlay';
  stake: number;
  odds: number;
  potentialPayout: number;
  placedAt: Date;
  parlayLegs?: Array<{
    marketId: string;
    marketTitle: string;
    optionId: string;
    optionLabel: string;
    odds: number;
  }>;
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