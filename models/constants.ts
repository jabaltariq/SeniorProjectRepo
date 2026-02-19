import type { LeaderboardEntry, Friend, SocialActivity } from './index';

export const INITIAL_BALANCE = 10000;
export const DAILY_BONUS_AMOUNT = 500;
export const BONUS_STORAGE_KEY = 'bethub_last_bonus_claim';

export const SPORT_TABS = ['ALL', 'Football', 'Basketball', 'Baseball', 'Hockey', 'Soccer'] as const;

export const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { id: 'l1', name: 'CryptoWhale_99', avatar: 'CW', netWorth: 1450200, winRate: 72, rank: 1 },
  { id: 'l2', name: 'SharkBait', avatar: 'SB', netWorth: 980450, winRate: 68, rank: 2 },
  { id: 'l3', name: 'OddsMaster', avatar: 'OM', netWorth: 850000, winRate: 65, rank: 3 },
  { id: 'l4', name: 'LukaMagic', avatar: 'LM', netWorth: 420000, winRate: 58, rank: 4 },
  { id: 'l5', name: 'BettingBot_01', avatar: 'BB', netWorth: 310500, winRate: 91, rank: 5 },
  { id: 'l6', name: 'You (JohnDoe)', avatar: 'JD', netWorth: 10000, winRate: 0, rank: 1422, isCurrentUser: true },
];

export const MOCK_FRIENDS: Friend[] = [
  { id: 'f1', name: 'Sarah_Spin', avatar: 'SS', status: 'online', lastActive: 'Now', privacyEnabled: false },
  { id: 'f2', name: 'DaveTheDealer', avatar: 'DD', status: 'offline', lastActive: '2h ago', privacyEnabled: false },
  { id: 'f3', name: 'RiskTaker', avatar: 'RT', status: 'away', lastActive: '15m ago', privacyEnabled: true },
];

export const MOCK_ACTIVITY: SocialActivity[] = [
  { id: 'a1', userId: 'f1', userName: 'Sarah_Spin', userAvatar: 'SS', action: 'placed a bet on', target: 'Man City vs Real Madrid (Draw)', timestamp: '2m ago' },
  { id: 'a2', userId: 'f2', userName: 'DaveTheDealer', userAvatar: 'DD', action: 'won a bet on', target: 'Bitcoin $100k (No)', timestamp: '1h ago' },
  { id: 'a3', userId: 'f4', userName: 'SharkBait', userAvatar: 'SB', action: 'placed a high-stakes bet on', target: 'Lakers to Win', timestamp: '5m ago' },
];
