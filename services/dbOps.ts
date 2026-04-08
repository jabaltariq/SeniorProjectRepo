import { setDoc, doc, getDoc, getDocs, onSnapshot, collection, Timestamp, runTransaction, deleteField, query, where, writeBatch, increment } from "firebase/firestore";
import { db } from "@/models/constants.ts";
import { Bet, LeaderboardEntry, ParlayLeg, BetStatus } from "@/models";

export var currBets = new Array<Bet>;

export var allBets = new Array<Bet>;

/**
 * Sets a specified user's username in Firestore
 * @param uid A user's Firebase Authentication ID.
 * @param name The new username that the user will have in Firestore.
 * @author Aidan Rodriguez
 */
export async function setUserName(uid: string, name: string) {
    await setDoc(doc(db, "userInfo", uid), {
        name: name
    }, {merge: true})
}

/**
 * Resets the user's win / loss ratio in Firestore.
 * @param uid A user's Firebase Authentication ID.
 * @author Aidan Rodriguez
 */
export async function resetRatio(uid: string) {
    await setDoc(doc(db, "userInfo", uid), {
        wins: 0,
        losses: 0
    }, {merge: true})
}

/**
 * Gets both the user's wins and losses from Firestore.
 * @param uid A user's Firebase Authentication ID.
 * @return An array of two numbers - index 0 is the user's wins, while index 1 is the user's losses.
 * @author Aidan Rodriguez
 */
export async function getUserRatio(uid: string): Promise<number[]> {
    const documentReference = doc(db, "userInfo", uid);
    const documentSnapshot = await getDoc(documentReference);

    var winsAndLosses = [0, 0]
    if (documentSnapshot.exists()) {
        const data = documentSnapshot.data();
        winsAndLosses[0] = data["wins"] as number
        winsAndLosses[1] = data["losses"] as number
        return winsAndLosses
    }
}

/**
 * Returns the amount of money a user has in Firestore.
 * @param uid A user's Firebase Authentication ID.
 * @author Aidan Rodriguez
 */
export async function getUserMoney(uid : string) : Promise<number> {
    const documentReference = doc(db, "userInfo", uid);
    const documentSnapshot = await getDoc(documentReference);

    if (documentSnapshot.exists()) {
        const data = documentSnapshot.data();
        const rawMoney = data["money"];
        if (typeof rawMoney === "number" && Number.isFinite(rawMoney)) return rawMoney;
        const parsed = Number(rawMoney);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    else {
        return null;
    }
}

/**
 * Sets a user's money in Firestore.
 * @param uid A user's Firebase Authentication ID.
 * @param amount The new amount that the user will have in Firestore.
 * @author Aidan Rodriguez
 */
export async function setUserMoney(uid: string, amount: number) {
    await setDoc(doc(db, "userInfo", uid), {
        money: amount
    }, {merge: true});
}

/**
 * Informs the database that a user has claimed their daily bonus by setting their last claimed date to the current time.
 * @param uid A user's Firebase Authentication ID.
 * @author Aidan Rodriguez
 */
export async function claimedDaily(uid: string) {
    await setDoc(doc(db, "userInfo", uid), {
        lastClaim: Timestamp.now()
    }, {merge: true})
}

/**
 * Sets a user's last claim to 1/1/1900, used in the creation of a new user.
 * @param uid A user's Firebase Authentication ID.
 */
export async function setNewDaily(uid: string) {
    var beginningOfTime = new Date(1900, 1, 1)
    await setDoc(doc(db, "userInfo", uid), {
        lastClaim: Timestamp.fromDate(beginningOfTime)
    }, {merge: true})
}

/**
 * Adds to the user's current money in Firestore.
 * @param uid A user's Firebase Authentication ID.
 * @param amount The amount that will be added to the user's money (or in the case of a negative number, subtracted).
 */
export async function changeUserMoney(uid: string, amount: number) {
    const newMoney = ((await getUserMoney(uid)) + amount);
    await setDoc(doc(db, "userInfo", uid), {
        money: newMoney
    }, { merge: true });
}

export type ListenForChangeCallback = (data: { money: number; hasDailyBonus: boolean }) => void;

/**
 * Listens for changes in the Firestore database, and updates the information in the application accordingly.
 * @param uid A user's Firebase Authentication ID.
 * @param onUpdate Optional callback to update React state when data changes.
 * @returns Unsubscribe function to clean up the listener.
 * @author Aidan Rodriguez
 */
export function listenForChange(uid: string, onUpdate?: ListenForChangeCallback): () => void {
    return onSnapshot(doc(db, "userInfo", uid), (snap) => {
        const data = snap.data();
        if (!data) return;

        const money = typeof data.money === 'number' ? data.money : Number(data.money) || 0;
        localStorage.setItem("userMoney", String(money));

        const currDate = new Date();
        const claimStamp = data.lastClaim ?? data.LastClaim;
        const hasDailyBonus = claimStamp
            ? claimStamp.toDate().getDate() !== currDate.getDate() ||
            claimStamp.toDate().getMonth() !== currDate.getMonth() ||
            claimStamp.toDate().getFullYear() !== currDate.getFullYear()
            : true;
        localStorage.setItem("hasDailyBonus", hasDailyBonus ? "true" : "false");

        onUpdate?.({money, hasDailyBonus});
    });
}

/**
 * Gets the last time a user claimed their daily bonus.
 * @param uid A user's Firebase Authentication ID.
 * @return The last time a user claimed their daily bonus as a Timestamp object.
 * @author Aidan Rodriguez
 */
export async function getLastDaily(uid: string) {
    const documentReference = doc(db, "userInfo", uid);
    const documentSnapshot = await getDoc(documentReference);

    if (documentSnapshot.exists()) {
        const data = documentSnapshot.data();
        return (data["lastClaim"] ?? data["LastClaim"]) as Timestamp;
    } else {
        return null;
    }
}

type NormalizedUserInfo = {
    money: number;
    lastClaim: Timestamp;
    wins: number;
    losses: number;
};

/**
 * Normalizes legacy / malformed userInfo documents.
 */
export async function normalizeUserInfoDoc(uid: string): Promise<NormalizedUserInfo | null> {
    const userRef = doc(db, "userInfo", uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return null;

    const data = snap.data();
    const money = Number.isFinite(Number(data.money)) ? Number(data.money) : 0;
    const wins = Number.isFinite(Number(data.wins)) ? Number(data.wins) : 0;
    const losses = Number.isFinite(Number(data.losses)) ? Number(data.losses) : 0;

    const fallbackDate = new Date(1900, 0, 1);
    const lastClaimRaw = data.lastClaim ?? data.LastClaim;
    const lastClaim =
        lastClaimRaw && typeof lastClaimRaw.toDate === "function"
            ? Timestamp.fromDate(lastClaimRaw.toDate())
            : Timestamp.fromDate(fallbackDate);

    await setDoc(
        userRef,
        { money, wins, losses, lastClaim, LastClaim: deleteField() },
        { merge: true }
    );

    return { money, wins, losses, lastClaim };
}

// ─────────────────────────────────────────────────────────────────
//  BETTING
// ─────────────────────────────────────────────────────────────────

/**
 * Adds a bet to the Firestore database associated with a user.
 * Used for non-transactional writes (e.g. mock/test bets).
 * For real bet placement use placeSingleBet() instead.
 * @author Aidan Rodriguez
 */
export async function addBet(uid: string, bet: Bet) {
    await setDoc(doc(db, "bets", bet.id), {
        userID:          uid,
        marketId:        bet.marketId,
        marketTitle:     bet.marketTitle,
        optionLabel:     bet.optionLabel,
        betType:         bet.betType ?? "single",
        parlayLegs:      bet.parlayLegs ?? [],
        legCount:        bet.parlayLegs?.length ?? (bet.betType === "parlay" ? 0 : 1),
        stake:           bet.stake,
        odds:            bet.odds,
        potentialPayout: bet.potentialPayout,
        placedAt:        bet.placedAt,
        // ── Settlement fields ──────────────────────────────────
        status:          "PENDING",
        eventId:         bet.eventId  ?? bet.marketId,
        sportKey:        bet.sportKey ?? "",
        // ──────────────────────────────────────────────────────
    });
    currBets.push(bet);
}

export type PlaceSingleBetResult =
    | { success: true; newBalance: number }
    | { success: false; error: "USER_NOT_FOUND" | "INVALID_STAKE" | "INSUFFICIENT_FUNDS" | "UNKNOWN" };

/**
 * Places a single or parlay bet and debits funds atomically in Firestore.
 * Avoids race conditions from separate read/write calls.
 * @author Aidan Rodriguez (updated for settlement)
 */
export async function placeSingleBet(uid: string, bet: Bet): Promise<PlaceSingleBetResult> {
    if (!Number.isFinite(bet.stake) || bet.stake <= 0) {
        return { success: false, error: "INVALID_STAKE" };
    }

    try {
        const newBalance = await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "userInfo", uid);
            const betRef  = doc(db, "bets", bet.id);

            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists()) throw new Error("USER_NOT_FOUND");

            const currentMoney = Number(userSnap.data().money) || 0;
            if (currentMoney < bet.stake) throw new Error("INSUFFICIENT_FUNDS");

            const nextMoney = currentMoney - bet.stake;

            transaction.set(betRef, {
                userID:          uid,
                marketId:        bet.marketId,
                marketTitle:     bet.marketTitle,
                optionLabel:     bet.optionLabel,
                betType:         bet.betType ?? "single",
                parlayLegs:      (bet.parlayLegs ?? []).map((leg: ParlayLeg) => ({
                    marketId:    leg.marketId,
                    marketTitle: leg.marketTitle,
                    sportKey:    leg.sportKey   ?? "",
                    optionId:    leg.optionId,
                    optionLabel: leg.optionLabel,
                    odds:        leg.odds,
                    marketKey:   leg.marketKey  ?? "h2h",
                    result:      "PENDING",
                })),
                legCount:        bet.legCount ?? (bet.betType === "parlay" ? (bet.parlayLegs?.length ?? 0) : 1),
                stake:           bet.stake,
                odds:            bet.odds,
                potentialPayout: bet.potentialPayout,
                placedAt:        Timestamp.fromDate(bet.placedAt),
                // ── Settlement fields ──────────────────────────────────
                status:          "PENDING",
                eventId:         bet.eventId  ?? bet.marketId,
                sportKey:        bet.sportKey ?? "",
                // ──────────────────────────────────────────────────────
            });

            transaction.set(userRef, { money: nextMoney }, { merge: true });
            return nextMoney;
        });

        currBets.push(bet);
        return { success: true, newBalance };
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message === "USER_NOT_FOUND")    return { success: false, error: "USER_NOT_FOUND" };
        if (message === "INSUFFICIENT_FUNDS") return { success: false, error: "INSUFFICIENT_FUNDS" };
        return { success: false, error: "UNKNOWN" };
    }
}

/**
 * Returns all bets associated with a user ID.
 * @param uid The user ID that will be part of the request to Firestore for the data.
 * @author Aidan Rodriguez (updated: uses query instead of full collection scan)
 */
export async function getBets(uid: string): Promise<Bet[]> {
    const betList: Bet[] = [];
    const q = query(collection(db, "bets"), where("userID", "==", uid));
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((d) => {
        const data = d.data();
        const validBet: Bet = {
            id:              d.id,
            userID:          data.userID,
            marketId:        data.marketId,
            marketTitle:     data.marketTitle,
            optionLabel:     data.optionLabel,
            betType:         data.betType === "parlay" ? "parlay" : "single",
            stake:           data.stake,
            odds:            data.odds,
            potentialPayout: data.potentialPayout,
            placedAt:        data.placedAt.toDate(),
            legCount:        data.legCount ?? 1,
            parlayLegs: Array.isArray(data.parlayLegs)
                ? data.parlayLegs.map((leg: any): ParlayLeg => ({
                    marketId:    String(leg.marketId    ?? ""),
                    marketTitle: String(leg.marketTitle ?? ""),
                    sportKey:    String(leg.sportKey    ?? ""),
                    optionId:    String(leg.optionId    ?? ""),
                    optionLabel: String(leg.optionLabel ?? ""),
                    odds:        Number(leg.odds)        || 0,
                    marketKey:   String(leg.marketKey   ?? "h2h"),
                    result:      leg.result ?? "PENDING",
                }))
                : [],
            status:    (data.status   ?? "PENDING") as BetStatus,
            eventId:   data.eventId,
            sportKey:  data.sportKey,
            settledAt: data.settledAt?.toDate(),
            isFree:    data.isFree ?? false,
        };
        try {
            betList.push(validBet);
        } catch (error) {
            console.log(error);
        }
    });

    return betList;
}

/**
 * Returns all PENDING bets across all users.
 * Called by the settlement cron job.
 */
export async function getPendingBets(): Promise<Bet[]> {
    const betList: Bet[] = [];
    const q = query(collection(db, "bets"), where("status", "==", "PENDING"));
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((d) => {
        const data = d.data();
        betList.push({
            id:              d.id,
            userID:          data.userID,
            marketId:        data.marketId,
            marketTitle:     data.marketTitle,
            optionLabel:     data.optionLabel,
            betType:         data.betType === "parlay" ? "parlay" : "single",
            stake:           data.stake,
            odds:            data.odds,
            potentialPayout: data.potentialPayout,
            placedAt:        data.placedAt.toDate(),
            legCount:        data.legCount ?? 1,
            parlayLegs: Array.isArray(data.parlayLegs)
                ? data.parlayLegs.map((leg: any): ParlayLeg => ({
                    marketId:    String(leg.marketId    ?? ""),
                    marketTitle: String(leg.marketTitle ?? ""),
                    sportKey:    String(leg.sportKey    ?? ""),
                    optionId:    String(leg.optionId    ?? ""),
                    optionLabel: String(leg.optionLabel ?? ""),
                    odds:        Number(leg.odds)        || 0,
                    marketKey:   String(leg.marketKey   ?? "h2h"),
                    result:      leg.result ?? "PENDING",
                }))
                : [],
            status:   "PENDING",
            eventId:  data.eventId,
            sportKey: data.sportKey,
            isFree:   data.isFree ?? false,
        });
    });

    return betList;
}

/**
 * Marks a bet as WON or LOST and updates the user's wallet and record atomically.
 * Called by the settlement service after a game is confirmed completed.
 * Free bets (isFree: true) pay out stake + profit on a win since nothing was deducted on placement.
 * Free bets that are LOST or VOID require no money change since nothing was deducted.
 */
export async function settleBet(bet: Bet, result: "WON" | "LOST" | "VOID"): Promise<void> {
    const batch = writeBatch(db);

    // 1. Update bet status
    batch.update(doc(db, "bets", bet.id), {
        status:    result,
        settledAt: Timestamp.now(),
    });

    // 2. Update user wallet and record
    const userRef = doc(db, "userInfo", bet.userID);
    if (result === "WON") {
        // isFree bets never had stake deducted so potentialPayout (stake + profit) is correct as-is
        batch.update(userRef, {
            money: increment(bet.potentialPayout),
            wins:  increment(1),
        });
    } else if (result === "LOST") {
        batch.update(userRef, {
            losses: increment(1),
        });
    }
    // VOID: cancelled bet — no payout, no win/loss recorded

    await batch.commit();
}

// ─────────────────────────────────────────────────────────────────
//  BET OF THE DAY
// ─────────────────────────────────────────────────────────────────

const FREE_BET_STAKE = 100;

export type BetOfTheDayOption = {
    id:        string;
    label:     string;
    odds:      number;
    marketKey: string;
};

export type BetOfTheDay = {
    marketId:    string;
    marketTitle: string;
    eventId:     string;
    sportKey:    string;
    startsAt:    Timestamp;
    createdAt:   Timestamp;
    options:     BetOfTheDayOption[];
};

/**
 * Returns today's bet of the day document, or null if none has been set.
 */
export async function getBetOfTheDay(): Promise<BetOfTheDay | null> {
    const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
    const snap = await getDoc(doc(db, "betOfTheDay", today));
    if (!snap.exists()) return null;

    const data = snap.data();
    return {
        marketId:    data.marketId,
        marketTitle: data.marketTitle,
        eventId:     data.eventId,
        sportKey:    data.sportKey,
        startsAt:    data.startsAt as Timestamp,
        createdAt:   data.createdAt as Timestamp,
        options:     Array.isArray(data.options) ? data.options as BetOfTheDayOption[] : [],
    };
}

/**
 * Returns whether the user has already claimed today's free bet.
 * @param uid A user's Firebase Authentication ID.
 */
export async function hasClaimedFreeBet(uid: string): Promise<boolean> {
    const snap = await getDoc(doc(db, "userInfo", uid));
    if (!snap.exists()) return false;

    const data = snap.data();
    const lastClaim = data.lastFreeBetClaim as Timestamp | undefined;
    if (!lastClaim) return false;

    const claimDate = lastClaim.toDate();
    const now = new Date();
    return (
        claimDate.getFullYear() === now.getFullYear() &&
        claimDate.getMonth()    === now.getMonth()    &&
        claimDate.getDate()     === now.getDate()
    );
}

export type PlaceFreeBetResult =
    | { success: true }
    | { success: false; error: "ALREADY_CLAIMED" | "NO_BET_TODAY" | "BET_LOCKED" | "USER_NOT_FOUND" | "UNKNOWN" };

/**
 * Places the free bet of the day for a user.
 * Atomically writes the bet and marks the free bet as claimed.
 * No money is deducted on placement. On a win, potentialPayout (stake + profit) is paid out.
 * On a loss or void, no money change occurs.
 * @param uid         A user's Firebase Authentication ID.
 * @param optionLabel Which side the user picked.
 * @param odds        The odds for the chosen side.
 */
export async function placeFreeBet(
    uid: string,
    optionLabel: string,
    odds: number,
): Promise<PlaceFreeBetResult> {
    try {
        const betOfTheDay = await getBetOfTheDay();
        if (!betOfTheDay) return { success: false, error: "NO_BET_TODAY" };

        // Lock the bet once the event starts
        if (Timestamp.now().seconds >= betOfTheDay.startsAt.seconds) {
            return { success: false, error: "BET_LOCKED" };
        }

        const potentialPayout = parseFloat((FREE_BET_STAKE * (odds > 0
                ? 1 + odds / 100
                : 1 + 100 / Math.abs(odds))
        ).toFixed(2));

        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "userInfo", uid);
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists()) throw new Error("USER_NOT_FOUND");

            // Check claim inside transaction to prevent race-condition double-claims
            const lastFreeBetClaim = userSnap.data().lastFreeBetClaim as Timestamp | undefined;
            if (lastFreeBetClaim) {
                const claimDate = lastFreeBetClaim.toDate();
                const now = new Date();
                const alreadyClaimed =
                    claimDate.getFullYear() === now.getFullYear() &&
                    claimDate.getMonth()    === now.getMonth()    &&
                    claimDate.getDate()     === now.getDate();
                if (alreadyClaimed) throw new Error("ALREADY_CLAIMED");
            }

            const betId = `${uid}_freebet_${new Date().toISOString().split("T")[0]}`;
            const betRef = doc(db, "bets", betId);

            transaction.set(betRef, {
                userID:          uid,
                marketId:        betOfTheDay.marketId,
                marketTitle:     betOfTheDay.marketTitle,
                optionLabel:     optionLabel,
                betType:         "single",
                parlayLegs:      [],
                legCount:        1,
                stake:           FREE_BET_STAKE,
                odds:            odds,
                potentialPayout: potentialPayout,
                placedAt:        Timestamp.now(),
                status:          "PENDING",
                eventId:         betOfTheDay.eventId,
                sportKey:        betOfTheDay.sportKey,
                isFree:          true,
            });

            // Mark free bet claimed — does NOT touch money balance
            transaction.set(userRef, { lastFreeBetClaim: Timestamp.now() }, { merge: true });
        });

        return { success: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message === "ALREADY_CLAIMED") return { success: false, error: "ALREADY_CLAIMED" };
        if (message === "USER_NOT_FOUND")  return { success: false, error: "USER_NOT_FOUND" };
        return { success: false, error: "UNKNOWN" };
    }
}

/**
 * Sets today's bet of the day. Call this once per day to configure the free bet.
 * @param bet The bet of the day details to set.
 */
export async function setBetOfTheDay(bet: Omit<BetOfTheDay, "createdAt">): Promise<void> {
    const today = new Date().toISOString().split("T")[0];
    await setDoc(doc(db, "betOfTheDay", today), {
        ...bet,
        createdAt: Timestamp.now(),
    });
}

// ─────────────────────────────────────────────────────────────────
//  LEADERBOARD
// ─────────────────────────────────────────────────────────────────

export async function getTopUsers(): Promise<LeaderboardEntry[]> {
    const topUserList: LeaderboardEntry[] = [];

    const querySnapshot = await getDocs(collection(db, "userInfo"));
    for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        const name = typeof data.name === "string" ? data.name : "";
        if (!name.trim()) continue;

        const wins   = Number(data.wins)   || 0;
        const losses = Number(data.losses) || 0;
        let winRate  = 0;
        if (losses === 0) {
            winRate = wins > 0 ? 100 : 0;
        } else {
            winRate = (wins / (wins + losses)) * 100;
        }
        if (!Number.isFinite(winRate)) winRate = 0;
        winRate = Math.min(100, Math.round(winRate));

        const money = typeof data.money === "number" ? data.money : Number(data.money) || 0;

        topUserList.push({
            id:            docSnap.id,
            name,
            avatar:        name.slice(0, 2).toUpperCase(),
            netWorth:      money,
            winRate,
            rank:          1,
            isCurrentUser: false,
        });
    }

    topUserList.sort((a, b) => b.netWorth - a.netWorth);
    topUserList.forEach((user, i) => { user.rank = i + 1; });

    return topUserList;
}

export type AccountStatKey = "netWorth" | "wins" | "losses" | "winRate" | "totalBets" | "openBets";
export type AccountAchievementKey = string;

export type AccountDisplaySection = "achievements" | "stats" | "bets";

export type AccountDisplayConfig = {
    stats: AccountStatKey[];
    achievements: AccountAchievementKey[];
    bets: string[];
};

export type AchievementDefinition = {
    id: string;
    title: string;
    description: string;
    icon?: string;
    active: boolean;
    sortOrder: number;
    rule: {
        type: string;
        metric: string;
        value: number;
    };
};

export type AccountProfile = {
    id: string;
    name: string;
    email?: string;
    avatar: string;
    netWorth: number;
    wins: number;
    losses: number;
    winRate: number;
    totalBets: number;
    unlockedAchievements: AccountAchievementKey[];
    profileDisplay: AccountDisplayConfig;
};

const DEFAULT_ACCOUNT_DISPLAY: AccountDisplayConfig = {
    stats: ["netWorth", "wins", "winRate", "totalBets"],
    achievements: ["firstBet", "onTheBoard", "bankrollBuilder"],
    bets: [],
};

function uniqueStrings(values: string[]): string[] {
    return Array.from(new Set(values));
}

function normalizeAccountDisplay(value: unknown, legacySections?: unknown): AccountDisplayConfig {
    const statsAllowed: AccountStatKey[] = ["netWorth", "wins", "losses", "winRate", "totalBets", "openBets"];
    const raw = value && typeof value === "object" ? value as Partial<AccountDisplayConfig> : {};

    const normalized: AccountDisplayConfig = {
        stats: Array.isArray(raw.stats)
            ? uniqueStrings(raw.stats.filter((item): item is AccountStatKey => statsAllowed.includes(item as AccountStatKey)))
            : [],
        achievements: Array.isArray(raw.achievements)
            ? uniqueStrings(raw.achievements.filter((item): item is AccountAchievementKey => typeof item === "string" && item.trim().length > 0))
            : [],
        bets: Array.isArray(raw.bets)
            ? uniqueStrings(raw.bets.filter((item): item is string => typeof item === "string" && item.trim().length > 0))
            : [],
    };

    const legacy = Array.isArray(legacySections)
        ? legacySections.filter((section): section is AccountDisplaySection =>
            ["achievements", "stats", "bets"].includes(section as AccountDisplaySection)
          )
        : [];

    if (!normalized.stats.length && legacy.includes("stats")) {
        normalized.stats = [...DEFAULT_ACCOUNT_DISPLAY.stats];
    }
    if (!normalized.achievements.length && legacy.includes("achievements")) {
        normalized.achievements = [...DEFAULT_ACCOUNT_DISPLAY.achievements];
    }
    if (!normalized.bets.length && legacy.includes("bets")) {
        normalized.bets = [...DEFAULT_ACCOUNT_DISPLAY.bets];
    }

    if (!normalized.stats.length && !normalized.achievements.length && !normalized.bets.length) {
        return {
            stats: [...DEFAULT_ACCOUNT_DISPLAY.stats],
            achievements: [...DEFAULT_ACCOUNT_DISPLAY.achievements],
            bets: [...DEFAULT_ACCOUNT_DISPLAY.bets],
        };
    }

    return normalized;
}

export async function getAccountProfile(uid: string): Promise<AccountProfile | null> {
    const userRef = doc(db, "userInfo", uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return null;

    const data = userSnap.data();
    const name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : "BetHub User";
    const wins = Number(data.wins) || 0;
    const losses = Number(data.losses) || 0;
    const totalBets = wins + losses;
    const winRate = totalBets > 0 ? Math.round((wins / totalBets) * 100) : 0;
    const unlockedAchievements = Array.isArray(data.unlockedAchievements)
        ? uniqueStrings(data.unlockedAchievements.filter((item): item is AccountAchievementKey => typeof item === "string" && item.trim().length > 0))
        : [];
    const profileDisplay = normalizeAccountDisplay(data.profileDisplay, data.profileDisplaySections);

    return {
        id: uid,
        name,
        email: typeof data.email === "string" ? data.email : undefined,
        avatar: name.slice(0, 2).toUpperCase(),
        netWorth: Number(data.money) || 0,
        wins,
        losses,
        winRate,
        totalBets,
        unlockedAchievements,
        profileDisplay,
    };
}

export async function getAchievementDefinitions(): Promise<AchievementDefinition[]> {
    const snapshot = await getDocs(collection(db, "achievementDefinitions"));
    const achievements: AchievementDefinition[] = [];

    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const rule = data.rule && typeof data.rule === "object" ? data.rule : {};

        achievements.push({
            id: docSnap.id,
            title: typeof data.title === "string" ? data.title : docSnap.id,
            description: typeof data.description === "string" ? data.description : "",
            icon: typeof data.icon === "string" ? data.icon : undefined,
            active: data.active !== false,
            sortOrder: Number(data.sortOrder) || 0,
            rule: {
                type: typeof rule.type === "string" ? rule.type : "",
                metric: typeof rule.metric === "string" ? rule.metric : "",
                value: Number(rule.value) || 0,
            },
        });
    });

    return achievements
        .filter((achievement) => achievement.active)
        .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function setAccountDisplay(uid: string, display: AccountDisplayConfig): Promise<void> {
    await setDoc(doc(db, "userInfo", uid), {
        profileDisplay: normalizeAccountDisplay(display),
    }, { merge: true });
}

export async function setUnlockedAchievements(uid: string, achievementIds: AccountAchievementKey[]): Promise<void> {
    await setDoc(doc(db, "userInfo", uid), {
        unlockedAchievements: uniqueStrings(
            achievementIds.filter((item): item is AccountAchievementKey => typeof item === "string" && item.trim().length > 0)
        ),
    }, { merge: true });
}

export async function addFriend(name: string, currUid: string) {
    const querySnapshot = await getDocs(collection(db, "userInfo"))
    let data: DocumentData;
    let friendId : string;
    for (const docSnap of querySnapshot.docs) {
        friendId = docSnap.id
        data = docSnap.data();
        if (data["name"] == name) {
            break;
        }
    }

    const docRef = doc(db, "userInfo", currUid);
    const docSnap = await getDoc(docRef);

    var friendsList : String[]
    if (docSnap.exists()) {
        const data = docSnap.data();
        if (data["friends"] == undefined) {
            friendsList = []
        }
        else {
            friendsList = data["friends"];
        }

        if (friendsList.includes(friendId)) {
            return;
        }
        friendsList.push(friendId)
        await setDoc(doc(db, "userInfo", currUid), {
            friends: friendsList
        }, {merge: true});
    }
}

export async function loadCommunityActivity() : Promise<SocialActivity[]> {
    const querySnapshot = await getDocs(collection(db, "bets"))
    var socialActivityList : SocialActivity[] = []

    for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();

        var isSingleBet = (data["betType"] == undefined);
        if (!isSingleBet) {
            console.log("throwing out parlay document")
            continue;
        }

        const documentReference = doc(db, "userInfo", data["userID"])
        const documentSnapshot = await getDoc(documentReference);

        const userData = documentSnapshot.data();

        if (userData == undefined) {
            continue;
        }

        const newSocialActivity : SocialActivity = {
            id: docSnap.id,
            userId: documentSnapshot.id,
            userName: userData["name"],
            userAvatar: userData["name"]?.slice(0, 2),
            action: "placed a bet on",
            target: data["marketTitle"],
            timestamp: ""
        }

        const newBet : Bet = {
            id: docSnap.id,
            marketId: data["marketId"],
            marketTitle: data["marketTitle"],
            optionLabel: data["optionLabel"],
            stake: data["stake"],
            odds: data["odds"],
            potentialPayout: data["potentialPayout"],
            placedAt: data["placedAt"]
        }
        betList.push(newBet)
        socialActivityList.push(newSocialActivity)
    }
    console.log(betList)
    return socialActivityList
}

export async function getFriends(uid : string) : Promise<Friend[]> {
    const documentReference = doc(db, "userInfo", uid);
    const documentSnapshot = await getDoc(documentReference);

    var friendsListAsString : string[] = []
    var friendsList : Friend[] = []
    if (documentSnapshot.exists()) {
        const data = documentSnapshot.data();
        friendsListAsString = data["friends"];
        if (data["friends"] == undefined) {

        }
        for (const friend of friendsListAsString) {
            const friendDocumentReference = doc(db, "userInfo", friend);
            const friendDocumentSnapshot = await getDoc(friendDocumentReference);

            if (friendDocumentSnapshot.exists()) {
                const friendData = friendDocumentSnapshot.data();

                friendsList.push({
                    id: friend,
                    name: friendData["name"],
                    avatar: friendData["name"].slice(0, 2),
                    status: 'online',
                    lastActive: "dont care",
                    privacyEnabled: false
                })
            }
        }
    }
    return friendsList;
}