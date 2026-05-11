import { useState, useCallback, useEffect, useRef } from 'react';
import type { Market, MarketOption, Bet } from '../models';
import { INITIAL_BALANCE, DAILY_BONUS_AMOUNT } from '../models/constants';
import {
  placeSingleBet,
  changeUserMoney,
  claimedDaily,
  getUserMoney,
  listenForChange,
  subscribeToUserBets,
} from '@/services/dbOps';
import { settlePendingApiOddsBetsForUser } from '@/services/settleApiOddsBets';
import { BoostType } from '@/services/dbOps';
import { validateParlayAdd } from '@/services/parlayRules';

const PARLAY_ERROR_TIMEOUT_MS = 2500;

/**
 * Balance, placed bets, and bet selection. Used by DashboardView.
 * Loads balance from Firestore and re-subscribes whenever the active user changes.
 */
export function useBettingViewModel() {
  type BetSelection = { market: Market; option: MarketOption };

  const [balance, setBalance] = useState<number>(() => {
    const stored = localStorage.getItem('userMoney');
    const parsed = stored ? Number(stored) : NaN;
    return Number.isFinite(parsed) ? parsed : INITIAL_BALANCE;
  });
  const [activeBets, setActiveBets] = useState<Bet[]>([]);
  const [betSelection, setBetSelection] = useState<BetSelection | null>(null);
  const [parlaySelections, setParlaySelections] = useState<BetSelection[]>([]);
  const [dailyBonusAvailable, setDailyBonusAvailable] = useState(() => {
    return localStorage.getItem('hasDailyBonus') === 'true';
  });
  const [bonusMessage, setBonusMessage] = useState<string | null>(null);
  const [isPlacingBet, setIsPlacingBet] = useState(false);

  // Inline error surface for strict-parlay rule rejections (max legs,
  // both-sides). Auto-clears after PARLAY_ERROR_TIMEOUT_MS. Kept separate
  // from the BetSlip's `limitError` because that one is intentionally
  // place-bet-blocking; rule rejections must NOT block the user from
  // placing the parlay they already have.
  const [parlayRuleError, setParlayRuleError] = useState<string | null>(null);
  const parlayErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashParlayError = useCallback((msg: string) => {
    if (parlayErrorTimerRef.current) clearTimeout(parlayErrorTimerRef.current);
    setParlayRuleError(msg);
    parlayErrorTimerRef.current = setTimeout(() => {
      setParlayRuleError(null);
      parlayErrorTimerRef.current = null;
    }, PARLAY_ERROR_TIMEOUT_MS);
  }, []);

  useEffect(() => () => {
    if (parlayErrorTimerRef.current) clearTimeout(parlayErrorTimerRef.current);
  }, []);

  useEffect(() => {
    setBetSelection(null);
    setBonusMessage(null);

    const uid = localStorage.getItem('uid');
    if (!uid) {
      // Logged-out path: wipe any leftover state so a previously-signed-in
      // user's bets aren't visible on the login screen.
      setActiveBets([]);
      setBalance(INITIAL_BALANCE);
      setDailyBonusAvailable(true);
      return;
    }
    // Logged-in path: do NOT clear activeBets here. Clearing causes a brief
    // empty-list flash on remount/refresh while the snapshot listener spins
    // up, which users perceive as "my bets disappeared". The snapshot below
    // will replace `activeBets` atomically as soon as the first read lands.

    getUserMoney(uid).then((money) => {
      if (money != null && Number.isFinite(money)) {
        setBalance(money);
      }
    });
    const unsubBets = subscribeToUserBets(
      uid,
      (bets) => setActiveBets(bets),
      () => undefined,
    );


    const unsubUserInfo = listenForChange(uid, ({ money, hasDailyBonus }) => {
      setBalance(money);
      setDailyBonusAvailable(hasDailyBonus);
    });

    return () => {
      unsubBets();
      unsubUserInfo();
    };
  }, [localStorage.getItem("userEmail")]);

  // Odds API singles + parlays: poll /scores via proxy and settle completed events.
  useEffect(() => {
    const uid = localStorage.getItem('uid');
    if (!uid) return;

    void settlePendingApiOddsBetsForUser(uid);
    const id = window.setInterval(() => {
      const u = localStorage.getItem('uid');
      if (u) void settlePendingApiOddsBetsForUser(u);
    }, 90_000);
    return () => window.clearInterval(id);
  }, [localStorage.getItem('userEmail')]);

  /**
   * Places a bet, optionally with a weekly boost applied.
   * The boost is saved onto the bet doc and marked used atomically in Firestore.
   * After placing, the boost is cleared so the next bet starts fresh.
   */
  const handlePlaceBet = useCallback((
      stake: number,
      betType: 'single' | 'parlay' = 'single',
      activeBoost: BoostType | null = null,
      onBoostUsed?: () => void,
      /** When set, place this queued pick as a single (removes it from the slip on success). */
      singleTarget?: BetSelection | null,
  ) => {
    console.log('handlePlaceBet called, activeBoost:', activeBoost);
    if (isPlacingBet) return;

    const isParlayBet = betType === 'parlay';
    const singlePick = !isParlayBet ? (singleTarget ?? betSelection) : null;
    if (!isParlayBet && !singlePick) return;
    if (isParlayBet && !betSelection) return;

    // Defensive lock: mock markets are bettable only while UPCOMING.
    // If a mock game finalized after selection but before checkout, remove it.
    const isClosedMock = (m: Market) => m.sport_key === 'football_nfl_mock' && m.status === 'CLOSED';
    const mockAnchor = isParlayBet ? betSelection! : singlePick!;
    if (isClosedMock(mockAnchor.market)) {
      setParlaySelections((prev) =>
        prev.filter((sel) => `${sel.market.id}:${sel.option.id}` !== `${mockAnchor.market.id}:${mockAnchor.option.id}`)
      );
      setBetSelection((cur) => {
        if (!cur) return null;
        if (`${cur.market.id}:${cur.option.id}` === `${mockAnchor.market.id}:${mockAnchor.option.id}`) return null;
        return cur;
      });
      return;
    }
    const staleParlayMockLegs = parlaySelections.filter((sel) => isClosedMock(sel.market));
    if (staleParlayMockLegs.length > 0) {
      setParlaySelections((prev) => prev.filter((sel) => !isClosedMock(sel.market)));
      if (betSelection && isClosedMock(betSelection.market)) setBetSelection(null);
      return;
    }

    const uid = localStorage.getItem('uid');
    if (!uid) return;
    if (!Number.isFinite(stake) || stake <= 0 || stake > balance) return;

    const parlayCount = parlaySelections.length;
    if (isParlayBet && parlayCount < 2) return;

    const parlayOdds = parlaySelections.reduce((acc, s) => acc * s.option.odds, 1);
    const resolvedOdds = isParlayBet ? parlayOdds : singlePick!.option.odds;
    const resolvedMarketId = isParlayBet
        ? `parlay:${parlaySelections.map((s) => s.market.id).join('|')}`
        : singlePick!.market.id;
    const resolvedMarketTitle = isParlayBet
        ? parlaySelections.map((s) => s.market.title).join(' | ')
        : singlePick!.market.title;
    const resolvedOptionLabel = isParlayBet ? `${parlayCount}-Leg Parlay` : singlePick!.option.label;
    const parlayLegs = isParlayBet
        ? parlaySelections.map((s) => ({
          marketId:    s.market.id,
          marketTitle: s.market.title,
          sportKey:    s.market.sport_key,
          optionId:    s.option.id,
          optionLabel: s.option.label,
          odds:        s.option.odds,
          marketKey:   s.option.marketKey ?? 'h2h',
        }))
        : undefined;

    // For singles, capture the underlying event so head-to-head proposals can
    // enforce a "no fades after kickoff" lock. Parlays don't expose a single
    // event, so leave these fields unset (H2H disallows parlays in v1).
    const singleEventId       = isParlayBet ? undefined : singlePick!.market.id;
    const singleSportKey      = isParlayBet ? undefined : singlePick!.market.sport_key;
    const singleEventStartsAt = isParlayBet
        ? undefined
        : (() => {
            const raw = singlePick!.market.startTime;
            if (!raw) return undefined;
            const parsed = new Date(raw);
            return Number.isNaN(parsed.getTime()) ? undefined : parsed;
          })();

    const newBet: Bet = {
      id:              Math.random().toString(36).substr(2, 9),
      marketId:        resolvedMarketId,
      marketTitle:     resolvedMarketTitle,
      optionLabel:     resolvedOptionLabel,
      betType,
      stake,
      odds:            resolvedOdds,
      potentialPayout: stake * resolvedOdds,
      placedAt:        new Date(),
      parlayLegs,
      eventId:         singleEventId,
      sportKey:        singleSportKey,
      pickedMarketKey: isParlayBet ? undefined : singlePick!.option.marketKey ?? 'h2h',
      eventStartsAt:   singleEventStartsAt,
    };

    // Use placeSingleBet (handles atomic debit + boost marking)
    void placeSingleBet(uid, newBet, activeBoost).then((result) => {
      if (result.success) {
        setBalance(result.newBalance);
        localStorage.setItem('userMoney', String(result.newBalance));
        setActiveBets((prev) => [newBet, ...prev]);
        // Clear the slip after a successful placement so the user can't
        // accidentally double-submit. For singles, dropping `betSelection`
        // is enough to gray out the singles button (BetSlip's
        // `singlesPlaceDisabled` keys off `!selection`). For parlays we ALSO
        // need to empty `parlaySelections` because the parlays button keys
        // off `parlaySelections.length >= 2`; without this, the same parlay
        // legs sit in the slip post-placement and a second click would place
        // a duplicate bet.
        if (isParlayBet) {
          setBetSelection(null);
          setParlaySelections([]);
          setParlayRuleError(null);
          if (parlayErrorTimerRef.current) {
            clearTimeout(parlayErrorTimerRef.current);
            parlayErrorTimerRef.current = null;
          }
        } else {
          const placedKey = `${singlePick!.market.id}:${singlePick!.option.id}`;
          setParlaySelections((prev) => {
            const next = prev.filter((s) => `${s.market.id}:${s.option.id}` !== placedKey);
            setBetSelection(next[next.length - 1] ?? null);
            return next;
          });
        }
        // Clear the boost after successful placement
        onBoostUsed?.();
      } else {
        console.error('Bet placement failed:', result.error);
      }
    });
  }, [betSelection, parlaySelections, balance, isPlacingBet]);

  const handleDailyBonus = useCallback(() => {
    if (!dailyBonusAvailable) {
      setBonusMessage('Already claimed! Come back tomorrow for more.');
      setTimeout(() => setBonusMessage(null), 3000);
      return;
    }

    const uid = localStorage.getItem('uid');
    if (!uid) return;

    setDailyBonusAvailable(false);
    localStorage.setItem('hasDailyBonus', 'false');

    void changeUserMoney(uid, DAILY_BONUS_AMOUNT).then(() => {
      setBonusMessage(`+$${DAILY_BONUS_AMOUNT} added to your wallet!`);
    });
    void claimedDaily(uid);
    setTimeout(() => setBonusMessage(null), 3000);
  }, [dailyBonusAvailable]);

  const clearBetSelection = useCallback(() => {
    setBetSelection(null);
    setParlaySelections([]);
    setParlayRuleError(null);
    if (parlayErrorTimerRef.current) {
      clearTimeout(parlayErrorTimerRef.current);
      parlayErrorTimerRef.current = null;
    }
  }, []);

  const selectBet = useCallback((market: Market, option: MarketOption) => {
    const key = `${market.id}:${option.id}`;
    setParlaySelections((prev) => {
      const exists = prev.some((sel) => `${sel.market.id}:${sel.option.id}` === key);
      if (exists) {
        // Toggle-off path: clicking an already-selected leg removes it.
        // Rule validation is intentionally skipped here — removing a leg
        // can only ever shrink the slip and can't violate any rule.
        const next = prev.filter((sel) => `${sel.market.id}:${sel.option.id}` !== key);
        setBetSelection((current) => {
          if (!current) return next[next.length - 1] ?? null;
          const currentKey = `${current.market.id}:${current.option.id}`;
          if (currentKey !== key) return current;
          return next[next.length - 1] ?? null;
        });
        return next;
      }

      // Add path: enforce strict-parlay rules. validateParlayAdd is pure.
      const candidate = {
        marketId: market.id,
        marketKey: option.marketKey ?? 'h2h',
        optionId: option.id,
      };
      const existingCandidates = prev.map((s) => ({
        marketId: s.market.id,
        marketKey: s.option.marketKey ?? 'h2h',
        optionId: s.option.id,
      }));
      const result = validateParlayAdd(existingCandidates, candidate);
      if (!result.ok) {
        flashParlayError(result.message);
        return prev;
      }

      const next = [...prev, { market, option }];
      setBetSelection({ market, option });
      return next;
    });
  }, [flashParlayError]);

  const focusQueuedSelection = useCallback((market: Market, option: MarketOption) => {
    const key = `${market.id}:${option.id}`;
    const exists = parlaySelections.some((sel) => `${sel.market.id}:${sel.option.id}` === key);
    if (!exists) return;
    setBetSelection({ market, option });
  }, [parlaySelections]);

  return {
    balance,
    activeBets,
    betSelection,
    parlaySelections,
    dailyBonusAvailable,
    bonusMessage,
    parlayRuleError,
    handlePlaceBet,
    handleDailyBonus,
    clearBetSelection,
    selectBet,
    focusQueuedSelection,
  };
}