import type { Friend, SocialActivity } from './index';

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
export const INITIAL_BALANCE = 10000;
export const DAILY_BONUS_AMOUNT = 500;
export const BONUS_STORAGE_KEY = 'bethub_last_bonus_claim';

export const SPORT_TABS = ['ALL', 'Football', 'Basketball', 'Baseball', 'Hockey', 'Soccer'] as const;

/** Show “View All Games” only when the board already lists this many rows (avoids clutter for normal boards). */
export const VIEW_ALL_GAMES_VISIBLE_THRESHOLD = 60;

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCcgJVGV0L95RkcRZ-jqzFAepr3N73wewQ",
  authDomain: "seniorproject-ce9fe.firebaseapp.com",
  projectId: "seniorproject-ce9fe",
  storageBucket: "seniorproject-ce9fe.firebasestorage.app",
  messagingSenderId: "1007996245994",
  appId: "1:1007996245994:web:5d168e3055cb61a14d8493",
  measurementId: "G-81E1JLPRLN"
}

export var APP = initializeApp(FIREBASE_CONFIG);

export const db = getFirestore(APP);

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
