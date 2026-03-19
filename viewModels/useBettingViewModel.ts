import { useState, useCallback, useEffect } from 'react';
import type { Market, MarketOption, Bet } from '../models';
import { INITIAL_BALANCE, DAILY_BONUS_AMOUNT, BONUS_STORAGE_KEY } from '../models/constants';

/**
 * Balance, placed bets, and bet selection. Used by DashboardView.
 * Daily bonus: $500 once per day, stored in localStorage by date.
 */
function getBonusStorageKey(userEmail: string | null) {
  return `${BONUS_STORAGE_KEY}:${(userEmail ?? 'guest').toLowerCase()}`;
}

function isDailyBonusAvailable(userEmail: string | null) {
  try {
    const key = getBonusStorageKey(userEmail);
    const last = localStorage.getItem(key);
    const today = new Date().toISOString().slice(0, 10);
    return last !== today;
  } catch {
    return true;
  }
}

export function useBettingViewModel(userEmail: string | null) {
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [activeBets, setActiveBets] = useState<Bet[]>([]);
  const [betSelection, setBetSelection] = useState<{ market: Market; option: MarketOption } | null>(null);
  // True if last claim was not today
  const [dailyBonusAvailable, setDailyBonusAvailable] = useState(() => isDailyBonusAvailable(userEmail));
  const [bonusMessage, setBonusMessage] = useState<string | null>(null);

  useEffect(() => {
    // Reset transient betting state when the authenticated user changes.
    setBalance(INITIAL_BALANCE);
    setActiveBets([]);
    setBetSelection(null);
    setBonusMessage(null);
    setDailyBonusAvailable(isDailyBonusAvailable(userEmail));
  }, [userEmail]);

  const handlePlaceBet = useCallback((stake: number) => {
    if (!betSelection) return;
    // Deduct stake, add to active bets, clear selection
    const newBet: Bet = {
      id: Math.random().toString(36).substr(2, 9),
      marketId: betSelection.market.id,
      marketTitle: betSelection.market.title,
      optionLabel: betSelection.option.label,
      stake,
      odds: betSelection.option.odds,
      potentialPayout: stake * betSelection.option.odds,
      placedAt: new Date()
    };

    setBalance(prev => prev - stake);
    setActiveBets(prev => [newBet, ...prev]);
    setBetSelection(null);
  }, [betSelection]);

  const handleDailyBonus = useCallback(() => {
    if (!dailyBonusAvailable) {
      setBonusMessage('Already claimed! Come back tomorrow for more.');
      setTimeout(() => setBonusMessage(null), 3000);
      return;
    }
    setBalance(prev => prev + DAILY_BONUS_AMOUNT);
    try {
      localStorage.setItem(getBonusStorageKey(userEmail), new Date().toISOString().slice(0, 10));
    } catch { /* ignore */ }
    setDailyBonusAvailable(false);
    setBonusMessage(`+$${DAILY_BONUS_AMOUNT} added to your wallet!`);
    setTimeout(() => setBonusMessage(null), 3000);
  }, [dailyBonusAvailable, userEmail]);

  const clearBetSelection = useCallback(() => setBetSelection(null), []);

  const selectBet = useCallback((market: Market, option: MarketOption) => {
    setBetSelection({ market, option });
  }, []);

  return {
    balance,
    activeBets,
    betSelection,
    dailyBonusAvailable,
    bonusMessage,
    handlePlaceBet,
    handleDailyBonus,
    clearBetSelection,
    selectBet,
  };
}
