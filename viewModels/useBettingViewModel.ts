import { useState, useCallback, useEffect } from 'react';
import type { Market, MarketOption, Bet } from '../models';
import { INITIAL_BALANCE, DAILY_BONUS_AMOUNT, BONUS_STORAGE_KEY } from '../models/constants';
import { addBet, changeUserMoney, claimedDaily, getUserMoney, listenForChange } from '@/services/dbOps';

/**
 * Balance, placed bets, and bet selection. Used by DashboardView.
 * Loads balance from Firestore and syncs via listenForChange.
 */
export function useBettingViewModel() {
  type BetSelection = { market: Market; option: MarketOption };
  const [balance, setBalance] = useState<number>(() => {
    const m = localStorage.getItem('userMoney');
    return m ? parseInt(m, 10) : 0;
  });
  const [activeBets, setActiveBets] = useState<Bet[]>([]);
  const [betSelection, setBetSelection] = useState<BetSelection | null>(null);
  const [parlaySelections, setParlaySelections] = useState<BetSelection[]>([]);
  const [dailyBonusAvailable, setDailyBonusAvailable] = useState(() => {
    return localStorage.getItem('hasDailyBonus') === 'true';
  });
  const [bonusMessage, setBonusMessage] = useState<string | null>(null);

  useEffect(() => {
    const uid = localStorage.getItem('uid');
    if (!uid) return;

    getUserMoney(uid).then((money) => {
      if (money != null && !isNaN(money)) {
        setBalance(money);
      }
    });

    const unsub = listenForChange(uid, ({ money, hasDailyBonus }) => {
      setBalance(money);
      setDailyBonusAvailable(hasDailyBonus);
    });
    return unsub;
  }, []);

  const handlePlaceBet = useCallback((stake: number) => {
    if (!betSelection) return;
    const uid = localStorage.getItem('uid');
    if (!uid) return;

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

    addBet(uid, newBet);
    changeUserMoney(uid, -stake).then(() => {
      setBalance((prev) => prev - stake);
    });
    setActiveBets((prev) => [newBet, ...prev]);
    setBetSelection(null);
  }, [betSelection]);

  const handleDailyBonus = useCallback(() => {
    if (localStorage.getItem('hasDailyBonus') !== 'true') {
      setBonusMessage('Already claimed! Come back tomorrow for more.');
      setTimeout(() => setBonusMessage(null), 3000);
      return;
    }

    const uid = localStorage.getItem('uid');
    if (!uid) return;

    setDailyBonusAvailable(false);
    changeUserMoney(uid, DAILY_BONUS_AMOUNT).then(() => {
      setBalance((prev) => prev + DAILY_BONUS_AMOUNT);
      setBonusMessage(`+$${DAILY_BONUS_AMOUNT} added to your wallet!`);
    });
    localStorage.setItem('hasDailyBonus', 'false');
    claimedDaily(uid);
    setTimeout(() => setBonusMessage(null), 3000);
  }, []);

  const clearBetSelection = useCallback(() => {
    setBetSelection(null);
    setParlaySelections([]);
  }, []);

  const selectBet = useCallback((market: Market, option: MarketOption) => {
    const key = `${market.id}:${option.id}`;
    setParlaySelections((prev) => {
      const exists = prev.some((sel) => `${sel.market.id}:${sel.option.id}` === key);
      if (exists) {
        const next = prev.filter((sel) => `${sel.market.id}:${sel.option.id}` !== key);
        setBetSelection((current) => {
          if (!current) return next[next.length - 1] ?? null;
          const currentKey = `${current.market.id}:${current.option.id}`;
          if (currentKey !== key) return current;
          return next[next.length - 1] ?? null;
        });
        return next;
      }
      const next = [...prev, { market, option }];
      setBetSelection({ market, option });
      return next;
    });
  }, []);

  return {
    balance,
    activeBets,
    betSelection,
    parlaySelections,
    dailyBonusAvailable,
    bonusMessage,
    handlePlaceBet,
    handleDailyBonus,
    clearBetSelection,
    selectBet,
  };
}
