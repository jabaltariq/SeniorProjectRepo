import { setDoc, doc, getDoc, getDocs, onSnapshot, collection, deleteDoc, Timestamp, runTransaction, deleteField, query, where, orderBy, limit, writeBatch, increment, QueryDocumentSnapshot, DocumentData, DocumentReference, addDoc } from "firebase/firestore";
import { db } from "@/models/constants.ts";
import {Bet, LeaderboardEntry, ParlayLeg, BetStatus, Friend, SocialActivity, HeadToHead, HeadToHeadStatus} from "@/models";
import {randomInt} from "node:crypto";

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

export async function getUserName(uid : string) : Promise<string> {
    const documentReference = doc(db, "userInfo", uid)
    const documentSnapshot = await getDoc(documentReference)

    if (documentSnapshot.exists()) {
        const data = documentSnapshot.data()
        return data["name"]
    }
}

export async function getUidByUsername(name : string) : Promise<string> {
    const querySnapshot = await getDocs(collection(db, "userInfo"))

    for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data()
        if (data["name"] == name) {
            return docSnap.id
        }
    }
}
export async function setUserPrivacy(uid : string, access : boolean) {
    await setDoc(doc(db, "userInfo", uid), {
        privacy: access
    }, {merge: true})
}

export async function getUserPrivacy(uid: string) : Promise<boolean> {
    const documentReference = doc(db, "userInfo", uid)
    const documentSnapshot = await getDoc(documentReference)

    if (documentSnapshot.exists()) {
        const data = documentSnapshot.data()
        return data["privacy"]
    }
}

export type UserThemeMode = "ocean" | "light";

export async function setUserTheme(uid: string, themeMode: UserThemeMode) {
    await setDoc(doc(db, "userInfo", uid), {
        themeMode
    }, { merge: true });
}

export async function getUserTheme(uid: string): Promise<UserThemeMode> {
    const documentReference = doc(db, "userInfo", uid);
    const documentSnapshot = await getDoc(documentReference);

    if (!documentSnapshot.exists()) return "ocean";
    const data = documentSnapshot.data();
    return data["themeMode"] === "light" ? "light" : "ocean";
}

/**
 * @deprecated Used to translate the sender/receiver UID fields to display
 * names so the UI could match against the current user's name. This caused
 * a ghost-request bug when either side resolved to `undefined`, since two
 * `undefined` values compared equal and any unrelated user could see it.
 *
 * The new code keeps sender/receiver as UIDs (unambiguous) and carries
 * `senderName` separately for display only. Kept exported for any legacy
 * call sites — should be removed once nothing imports it.
 */
export async function getFriendRequestsAsName(requests : FriendRequest[]) : Promise<FriendRequest[]> {
    var friendRequestsAsName: FriendRequest[] = [];
    for (const item of requests) {
        const newFriendRequest: FriendRequest = {
            id: item.id,
            sender: item.sender,
            receiver: item.receiver,
            senderName: await getUserName(item.sender),
        };
        friendRequestsAsName.push(newFriendRequest)
    }
    return friendRequestsAsName
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
//  WEEKLY BOOSTS
// ─────────────────────────────────────────────────────────────────

export type BoostType = 'double_payout' | 'money_back';

export type UserBoosts = {
    doublePayoutUsed: boolean;
    moneyBackUsed:    boolean;
    lastReset:        Timestamp;
};

/**
 * Returns the most recent Sunday at midnight UTC.
 */
function getLastSundayMidnight(): Date {
    const now = new Date();
    const day = now.getUTCDay(); // 0 = Sunday
    const lastSunday = new Date(now);
    lastSunday.setUTCDate(now.getUTCDate() - day);
    lastSunday.setUTCHours(0, 0, 0, 0);
    return lastSunday;
}

/**
 * Gets a user's current boost state.
 * Auto-resets if the last reset was before the most recent Sunday midnight.
 * @param uid A user's Firebase Authentication ID.
 */
export async function getUserBoosts(uid: string): Promise<UserBoosts> {
    const userRef = doc(db, "userInfo", uid);
    const snap = await getDoc(userRef);

    const lastSunday = getLastSundayMidnight();
    const defaultBoosts: UserBoosts = {
        doublePayoutUsed: false,
        moneyBackUsed:    false,
        lastReset:        Timestamp.fromDate(lastSunday),
    };

    if (!snap.exists()) return defaultBoosts;

    const data = snap.data();
    const raw = data.boosts;

    // No boosts field yet — write defaults and return
    if (!raw) {
        await setDoc(userRef, { boosts: defaultBoosts }, { merge: true });
        return defaultBoosts;
    }

    const lastReset = raw.lastReset as Timestamp;

    // If last reset was before this Sunday — reset boosts
    if (lastReset.toDate() < lastSunday) {
        const freshBoosts: UserBoosts = {
            doublePayoutUsed: false,
            moneyBackUsed:    false,
            lastReset:        Timestamp.fromDate(lastSunday),
        };
        await setDoc(userRef, { boosts: freshBoosts }, { merge: true });
        return freshBoosts;
    }

    return {
        doublePayoutUsed: raw.doublePayoutUsed ?? false,
        moneyBackUsed:    raw.moneyBackUsed    ?? false,
        lastReset,
    };
}

/**
 * Marks a specific boost as used for the week.
 * Called atomically inside placeSingleBet when a boost is applied.
 * @param uid       A user's Firebase Authentication ID.
 * @param boostType Which boost to mark as used.
 */
export async function markBoostUsed(uid: string, boostType: BoostType): Promise<void> {
    const field = boostType === 'double_payout' ? 'boosts.doublePayoutUsed' : 'boosts.moneyBackUsed';
    await setDoc(doc(db, "userInfo", uid), {
        [field]: true,
    }, { merge: true });
}

// ─────────────────────────────────────────────────────────────────
//  SPENDING LIMITS
// ─────────────────────────────────────────────────────────────────

export type SpendingLimits = {
    daily:            number | null;  // null = no limit
    weekly:           number | null;
    dailySpent:       number;
    weeklySpent:      number;
    lastDailyReset:   Timestamp;
    lastWeeklyReset:  Timestamp;
};

function getMidnightToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * Gets a user's spending limits, auto-resetting spent counters as needed.
 * Daily spent resets at midnight local time; weekly spent resets every Sunday midnight UTC.
 * @param uid A user's Firebase Authentication ID.
 */
export async function getSpendingLimits(uid: string): Promise<SpendingLimits> {
    const userRef = doc(db, "userInfo", uid);
    const snap = await getDoc(userRef);

    const todayMidnight  = getMidnightToday();
    const lastSunday     = (() => {
        const now = new Date();
        const d = new Date(now);
        d.setUTCDate(now.getUTCDate() - now.getUTCDay());
        d.setUTCHours(0, 0, 0, 0);
        return d;
    })();

    const defaults: SpendingLimits = {
        daily:           null,
        weekly:          null,
        dailySpent:      0,
        weeklySpent:     0,
        lastDailyReset:  Timestamp.fromDate(todayMidnight),
        lastWeeklyReset: Timestamp.fromDate(lastSunday),
    };

    if (!snap.exists()) return defaults;

    const data = snap.data();
    const raw  = data.spendingLimits;

    if (!raw) {
        await setDoc(userRef, { spendingLimits: defaults }, { merge: true });
        return defaults;
    }

    let dailySpent      = raw.dailySpent      ?? 0;
    let weeklySpent     = raw.weeklySpent     ?? 0;
    let lastDailyReset  = raw.lastDailyReset  as Timestamp;
    let lastWeeklyReset = raw.lastWeeklyReset as Timestamp;
    let needsWrite      = false;

    // Reset daily if last reset was before today's midnight
    if (lastDailyReset.toDate() < todayMidnight) {
        dailySpent     = 0;
        lastDailyReset = Timestamp.fromDate(todayMidnight);
        needsWrite     = true;
    }

    // Reset weekly if last reset was before this Sunday midnight
    if (lastWeeklyReset.toDate() < lastSunday) {
        weeklySpent     = 0;
        lastWeeklyReset = Timestamp.fromDate(lastSunday);
        needsWrite      = true;
    }

    if (needsWrite) {
        await setDoc(userRef, {
            spendingLimits: { ...raw, dailySpent, weeklySpent, lastDailyReset, lastWeeklyReset }
        }, { merge: true });
    }

    return {
        daily:           raw.daily           ?? null,
        weekly:          raw.weekly          ?? null,
        dailySpent,
        weeklySpent,
        lastDailyReset,
        lastWeeklyReset,
    };
}

/**
 * Saves a user's daily and/or weekly spending limits.
 * Pass null to remove a limit.
 * @param uid    A user's Firebase Authentication ID.
 * @param daily  Daily limit in dollars, or null to remove.
 * @param weekly Weekly limit in dollars, or null to remove.
 */
export async function setSpendingLimits(
    uid: string,
    daily: number | null,
    weekly: number | null,
): Promise<void> {
    const userRef = doc(db, "userInfo", uid);
    const snap = await getDoc(userRef);
    const existing = snap.exists() ? (snap.data().spendingLimits ?? {}) : {};

    await setDoc(userRef, {
        spendingLimits: {
            ...existing,
            daily,
            weekly,
        }
    }, {merge: true});
}


// ─────────────────────────────────────────────────────────────────
//  MOCK NFL GAMES (PER USER)
// ─────────────────────────────────────────────────────────────────

export type MockNflWinner = "HOME" | "AWAY" | null;

export interface MockNflGameState {
    id: string;
    week: number;
    awayTeam: string;
    homeTeam: string;
    awayOdds: number;
    homeOdds: number;
    totalOverOdds: number;
    totalUnderOdds: number;
    spreadLine: number;
    totalLine: number;
    status: "UPCOMING" | "FINAL";
    awayScore: number | null;
    homeScore: number | null;
    winner: MockNflWinner;
    updatedAtMs: number;
}

export async function getUserMockNflGames(uid: string): Promise<MockNflGameState[]> {
    if (!uid) return [];
    const snap = await getDoc(doc(db, "userInfo", uid));
    if (!snap.exists()) return [];
    const data = snap.data();
    const raw = data["mockNflGames"];
    if (!Array.isArray(raw)) return [];

    return raw
        .map((row: any): MockNflGameState | null => {
            if (!row || typeof row !== "object") return null;
            const id = String(row.id ?? "");
            const awayTeam = String(row.awayTeam ?? "");
            const homeTeam = String(row.homeTeam ?? "");
            if (!id || !awayTeam || !homeTeam) return null;
            return {
                id,
                week: Math.min(18, Math.max(1, Number(row.week) || 1)),
                awayTeam,
                homeTeam,
                awayOdds: Number(row.awayOdds) || 1.91,
                homeOdds: Number(row.homeOdds) || 1.91,
                totalOverOdds: Number(row.totalOverOdds) || 1.91,
                totalUnderOdds: Number(row.totalUnderOdds) || 1.91,
                spreadLine: Number(row.spreadLine) || 0,
                totalLine: Number(row.totalLine) || 44.5,
                status: row.status === "FINAL" ? "FINAL" : "UPCOMING",
                awayScore: row.awayScore == null ? null : Number(row.awayScore) || 0,
                homeScore: row.homeScore == null ? null : Number(row.homeScore) || 0,
                winner: row.winner === "HOME" || row.winner === "AWAY" ? row.winner : null,
                updatedAtMs: Number(row.updatedAtMs) || Date.now(),
            };
        })
        .filter((row: MockNflGameState | null): row is MockNflGameState => row !== null);
}

export async function saveUserMockNflGames(uid: string, games: MockNflGameState[]): Promise<void> {
    if (!uid) return;
    await setDoc(doc(db, "userInfo", uid), {
        mockNflGames: games,
        mockNflUpdatedAt: Timestamp.now(),
    }, { merge: true });
}

/**
 * Settles all pending bets for a finalized mock NFL game for one user.
 * This reuses the existing settleBet() path so wallet + win/loss + history
 * stay consistent with normal markets.
 */
export async function settleUserMockNflGameBets(
    uid: string,
    game: MockNflGameState,
): Promise<void> {
    if (!uid) return;
    if (game.status !== "FINAL") return;
    if (game.awayScore == null || game.homeScore == null) return;

    const marketId = `mock-${game.id}`;
    const pending = (await getBets(uid)).filter(
        (b) => b.marketId === marketId && (b.status ?? "PENDING") === "PENDING",
    );
    if (pending.length === 0) return;

    const awayTeam = game.awayTeam;
    const homeTeam = game.homeTeam;
    const awaySpreadLabel = `${awayTeam} ${game.spreadLine > 0 ? `+${game.spreadLine.toFixed(1)}` : game.spreadLine.toFixed(1)}`;
    const homeSpread = -game.spreadLine;
    const homeSpreadLabel = `${homeTeam} ${homeSpread > 0 ? `+${homeSpread.toFixed(1)}` : homeSpread.toFixed(1)}`;
    const overLabel = `Over ${game.totalLine.toFixed(1)}`;
    const underLabel = `Under ${game.totalLine.toFixed(1)}`;
    const margin = game.awayScore - game.homeScore;
    const totalScore = game.awayScore + game.homeScore;

    const outcomeFor = (optionLabel: string): "WON" | "LOST" | "VOID" => {
        const selected = optionLabel.trim();

        // Moneyline
        if (selected === awayTeam) {
            if (game.awayScore === game.homeScore) return "VOID";
            return game.awayScore > game.homeScore ? "WON" : "LOST";
        }
        if (selected === homeTeam) {
            if (game.awayScore === game.homeScore) return "VOID";
            return game.homeScore > game.awayScore ? "WON" : "LOST";
        }

        // Spread
        if (selected === awaySpreadLabel) {
            const result = margin + game.spreadLine;
            if (result === 0) return "VOID";
            return result > 0 ? "WON" : "LOST";
        }
        if (selected === homeSpreadLabel) {
            const result = -margin - game.spreadLine;
            if (result === 0) return "VOID";
            return result > 0 ? "WON" : "LOST";
        }

        // Totals
        if (selected === overLabel) {
            if (totalScore === game.totalLine) return "VOID";
            return totalScore > game.totalLine ? "WON" : "LOST";
        }
        if (selected === underLabel) {
            if (totalScore === game.totalLine) return "VOID";
            return totalScore < game.totalLine ? "WON" : "LOST";
        }

        // Unknown/legacy label for this mock market: void it safely.
        return "VOID";
    };

    await Promise.all(
        pending.map(async (bet) => {
            await settleBet(bet, outcomeFor(bet.optionLabel));
        }),
    );
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
    | { success: false; error: "USER_NOT_FOUND" | "INVALID_STAKE" | "INSUFFICIENT_FUNDS" | "BOOST_ALREADY_USED" | "LIMIT_EXCEEDED" | "UNKNOWN" };

/**
 * Places a single or parlay bet and debits funds atomically in Firestore.
 * Avoids race conditions from separate read/write calls.
 * Optionally applies a weekly boost (double_payout or money_back) to the bet.
 * @author Aidan Rodriguez (updated for settlement + boosts)
 */
export async function placeSingleBet(uid: string, bet: Bet, boost: BoostType | null = null): Promise<PlaceSingleBetResult> {
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

            // Validate boost hasn't already been used this week
            if (boost) {
                const boosts = userSnap.data().boosts;
                const field = boost === 'double_payout' ? 'doublePayoutUsed' : 'moneyBackUsed';
                if (boosts?.[field] === true) throw new Error("BOOST_ALREADY_USED");
            }


            // Check spending limits (free bets don't count)
            if (!bet.isFree) {
                const limits = userSnap.data().spendingLimits;
                if (limits) {
                    const todayMidnight = getMidnightToday();
                    const lastSunday = (() => {
                        const now = new Date();
                        const d = new Date(now);
                        d.setUTCDate(now.getUTCDate() - now.getUTCDay());
                        d.setUTCHours(0, 0, 0, 0);
                        return d;
                    })();

                    // Auto-reset daily spent if needed
                    const dailySpent = (limits.lastDailyReset?.toDate() >= todayMidnight)
                        ? (limits.dailySpent ?? 0)
                        : 0;

                    // Auto-reset weekly spent if needed
                    const weeklySpent = (limits.lastWeeklyReset?.toDate() >= lastSunday)
                        ? (limits.weeklySpent ?? 0)
                        : 0;

                    if (limits.daily  != null && dailySpent  + bet.stake > limits.daily)  throw new Error("LIMIT_EXCEEDED");
                    if (limits.weekly != null && weeklySpent + bet.stake > limits.weekly) throw new Error("LIMIT_EXCEEDED");
                }
            }

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
                status:          "PENDING",
                eventId:         bet.eventId  ?? bet.marketId,
                sportKey:        bet.sportKey ?? "",
                eventStartsAt:   bet.eventStartsAt ? Timestamp.fromDate(bet.eventStartsAt) : null,
                isFree:          false,
                boostApplied:    boost ?? null,
            });

            // Mark boost as used and deduct stake atomically
            transaction.update(userRef, { money: nextMoney });
            if (boost) {
                const field = boost === 'double_payout' ? 'boosts.doublePayoutUsed' : 'boosts.moneyBackUsed';
                transaction.update(userRef, { [field]: true });
            }
            // Increment spending limit counters (free bets excluded)
            if (!bet.isFree) {
                transaction.update(userRef, {
                    'spendingLimits.dailySpent':  increment(bet.stake),
                    'spendingLimits.weeklySpent': increment(bet.stake),
                });
            }
            return nextMoney;
        });  // ← closes runTransaction

        currBets.push(bet);
        return { success: true, newBalance };
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message === "USER_NOT_FOUND")     return { success: false, error: "USER_NOT_FOUND" };
        if (message === "INSUFFICIENT_FUNDS") return { success: false, error: "INSUFFICIENT_FUNDS" };
        if (message === "BOOST_ALREADY_USED") return { success: false, error: "BOOST_ALREADY_USED" };
        if (message === "LIMIT_EXCEEDED")     return { success: false, error: "LIMIT_EXCEEDED" };
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
            status:        (data.status   ?? "PENDING") as BetStatus,
            eventId:       data.eventId,
            sportKey:      data.sportKey,
            eventStartsAt: data.eventStartsAt?.toDate?.(),
            settledAt:     data.settledAt?.toDate?.(),
            isFree:        data.isFree ?? false,
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
 * Realtime subscription for one user's bets.
 * Keeps local UI state in sync when bets are settled/updated server-side.
 */
export function subscribeToUserBets(
    uid: string,
    onUpdate: (bets: Bet[]) => void,
    onError?: (err: Error) => void,
): () => void {
    if (!uid) {
        onUpdate([]);
        return () => {};
    }

    const q = query(collection(db, "bets"), where("userID", "==", uid));

    return onSnapshot(
        q,
        (snapshot) => {
            const betList: Bet[] = [];
            snapshot.forEach((d) => {
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
                    placedAt:        data.placedAt?.toDate?.() ?? new Date(),
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
                    status:        (data.status   ?? "PENDING") as BetStatus,
                    eventId:       data.eventId,
                    sportKey:      data.sportKey,
                    eventStartsAt: data.eventStartsAt?.toDate?.(),
                    settledAt:     data.settledAt?.toDate?.(),
                };
                betList.push(validBet);
            });
            betList.sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime());
            onUpdate(betList);
        },
        (err) => {
            if (onError) onError(err);
            else console.error("subscribeToUserBets failed", err);
        },
    );
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
 * Marks a bet as WON, LOST, or VOID and updates the user's wallet and record atomically.
 * Called by the settlement service after a game is confirmed completed.
 *
 * Boost effects:
 *   double_payout — on a WIN, pays (potentialPayout - stake) extra (doubles the profit)
 *   money_back    — on a LOSS, refunds the stake in full
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
    const boost = (bet as any).boostApplied as BoostType | null ?? null;

    if (result === "WON") {
        let payout = bet.potentialPayout;
        // double_payout: add the profit again (doubles profit, not stake)
        if (boost === 'double_payout' && !bet.isFree) {
            const profit = bet.potentialPayout - bet.stake;
            payout = bet.potentialPayout + profit;
        }
        batch.update(userRef, {
            money: increment(payout),
            wins:  increment(1),
        });
    } else if (result === "LOST") {
        // money_back: refund the stake in full
        if (boost === 'money_back' && !bet.isFree) {
            batch.update(userRef, {
                money:  increment(bet.stake),
                losses: increment(1),
            });
        } else {
            batch.update(userRef, {
                losses: increment(1),
            });
        }
    }
    // VOID: cancelled — no payout, no win/loss recorded

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
        // console.log('placing bet with boost:', boost);
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
                eventStartsAt:   betOfTheDay.startsAt,
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
    var data;
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

export interface CommunityActivity {
    activities: SocialActivity[];
    bets: Bet[];
}

/**
 * How many recent bets the activity feed pulls in. Caps Firestore read cost
 * and keeps the UI snappy as the bets collection grows.
 */
const COMMUNITY_ACTIVITY_LIMIT = 50;

/**
 * Renders a placedAt Date as the short relative label the feed shows
 * ("JUST NOW", "12M AGO", "3H AGO", "2D AGO", or a date for older entries).
 */
function formatActivityTimestamp(d: Date): string {
    const ms = Date.now() - d.getTime();
    if (!Number.isFinite(ms) || ms < 60_000) return "JUST NOW";
    const mins = Math.floor(ms / 60_000);
    if (mins < 60)  return `${mins}M AGO`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}H AGO`;
    const days = Math.floor(hours / 24);
    if (days < 7)   return `${days}D AGO`;
    return d.toLocaleDateString();
}

/**
 * Shared converter from a snapshot of bet documents into the
 * CommunityActivity payload. Used by both the one-shot loader and the
 * realtime subscription so they stay in lockstep.
 *
 * Fixes vs. the legacy implementation:
 *   - Privacy branch is no longer inverted (privacy === true now hides
 *     identity, matching the rest of the app).
 *   - Parlays are kept (the UI already disables fading on them with a
 *     reason); skipping them silently meant friends' parlays never showed.
 *   - placedAt is threaded into SocialActivity.timestamp so feed entries
 *     are dateable.
 *   - User docs are fetched once per uid per snapshot instead of once per
 *     bet, so an N-bet feed costs ~U user reads (U = unique authors)
 *     instead of N.
 *   - No more side-effect mutation of authService.betList.
 */
async function buildCommunityActivity(
    docs: QueryDocumentSnapshot<DocumentData>[],
): Promise<CommunityActivity> {
    const uniqueUids = Array.from(
        new Set(docs.map((d) => String(d.data()["userID"] ?? "")).filter(Boolean)),
    );
    const userDataByUid = new Map<string, DocumentData>();
    await Promise.all(
        uniqueUids.map(async (uid) => {
            const snap = await getDoc(doc(db, "userInfo", uid));
            const data = snap.data();
            if (data) userDataByUid.set(uid, data);
        }),
    );

    const activities: SocialActivity[] = [];
    const bets: Bet[] = [];

    for (const docSnap of docs) {
        const data = docSnap.data();
        const uid = String(data["userID"] ?? "");
        const userData = userDataByUid.get(uid);
        if (!userData) {
            // Author no longer exists; drop the row instead of crashing.
            continue;
        }

        const isPrivate = userData["privacy"] === true;
        const rawName = typeof userData["name"] === "string" ? userData["name"] : "";
        const userName = isPrivate || !rawName ? "Anonymous User" : rawName;
        const userAvatar = isPrivate || !rawName ? "?" : rawName.slice(0, 2);

        const placedAtRaw    = data["placedAt"]      as Timestamp | undefined;
        const eventStartsRaw = data["eventStartsAt"] as Timestamp | undefined;
        const settledAtRaw   = data["settledAt"]     as Timestamp | undefined;
        const placedAtDate   = placedAtRaw?.toDate?.() ?? new Date(0);
        const isParlay       = data["betType"] === "parlay";

        const newBet: Bet = {
            id:              docSnap.id,
            userID:          uid,
            marketId:        String(data["marketId"]    ?? ""),
            marketTitle:     String(data["marketTitle"] ?? ""),
            optionLabel:     String(data["optionLabel"] ?? ""),
            betType:         isParlay ? "parlay" : "single",
            stake:           Number(data["stake"])           || 0,
            odds:            Number(data["odds"])            || 0,
            potentialPayout: Number(data["potentialPayout"]) || 0,
            placedAt:        placedAtDate,
            status:          (data["status"] ?? "PENDING") as BetStatus,
            eventId:         data["eventId"]  ? String(data["eventId"])  : undefined,
            sportKey:        data["sportKey"] ? String(data["sportKey"]) : undefined,
            eventStartsAt:   eventStartsRaw?.toDate?.(),
            settledAt:       settledAtRaw?.toDate?.(),
        };
        bets.push(newBet);

        activities.push({
            id:        docSnap.id,
            userId:    uid,
            userName,
            userAvatar,
            action:    isParlay ? "placed a parlay on" : "placed a bet on",
            target:    String(data["marketTitle"] ?? ""),
            timestamp: formatActivityTimestamp(placedAtDate),
        });
    }

    return { activities, bets };
}

/**
 * One-shot loader for the community activity feed. Kept for callers that
 * just need a snapshot (e.g. tests or non-reactive contexts). Reactive UI
 * should use subscribeToCommunityActivity below so new bets appear without
 * a page reload.
 *
 * @author Aidan Rodriguez (original); reworked to share buildCommunityActivity
 *   and to drop the authService.betList side effect / privacy inversion.
 */
export async function loadCommunityActivity(): Promise<CommunityActivity> {
    const q = query(
        collection(db, "bets"),
        orderBy("placedAt", "desc"),
        limit(COMMUNITY_ACTIVITY_LIMIT),
    );
    const snapshot = await getDocs(q);
    return buildCommunityActivity(snapshot.docs);
}

/**
 * Subscribes to the community activity feed. The callback fires once with the
 * initial snapshot and again every time a bet doc changes server-side.
 * Returns an unsubscribe function — callers MUST invoke it on unmount.
 */
export function subscribeToCommunityActivity(
    onUpdate: (data: CommunityActivity) => void,
    onError?: (err: Error) => void,
    feedLimit: number = COMMUNITY_ACTIVITY_LIMIT,
): () => void {
    const q = query(
        collection(db, "bets"),
        orderBy("placedAt", "desc"),
        limit(feedLimit),
    );

    let cancelled = false;

    const unsub = onSnapshot(
        q,
        (snapshot) => {
            // Snapshot work is async (we fan out per-author user reads), so
            // guard against races where the listener has been torn down by
            // the time the activity payload is ready.
            buildCommunityActivity(snapshot.docs)
                .then((payload) => {
                    if (cancelled) return;
                    onUpdate(payload);
                })
                .catch((err) => {
                    if (cancelled) return;
                    if (onError) onError(err as Error);
                    else console.error("subscribeToCommunityActivity build failed", err);
                });
        },
        (err) => {
            if (cancelled) return;
            if (onError) onError(err);
            else console.error("subscribeToCommunityActivity onSnapshot failed", err);
        },
    );

    return () => {
        cancelled = true;
        unsub();
    };
}

export interface FriendRequest {
    id: string,
    /** Sender UID (Firebase Auth uid). Stored on the request doc. */
    sender: string,
    /** Receiver UID. Stored on the request doc. */
    receiver: string,
    /**
     * Display-only sender username, resolved on read so the UI doesn't have
     * to render a raw uid. Optional because legacy / one-shot callers may
     * not bother to fetch it.
     */
    senderName?: string,
}

export interface SendFriendRequestResult {
    success: boolean;
    error?: string;
}

/**
 * Sends a friend request. Validates inputs and rejects:
 *   - empty/unknown recipient names
 *   - self-friend attempts (no point, also caused weird flicker when the
 *     sender's name happened to equal their own)
 *   - duplicate pending requests in either direction (this used to spawn N
 *     copies of the same request, polluting the inbox)
 *   - users who are already friends
 *
 * Returns `{ success, error? }` instead of throwing so the UI can surface a
 * reason. The legacy void return is preserved for callers that just `.then()`
 * to clear the input field — a `success === true` result is truthy in JS.
 */
export async function sendFriendRequest(username : string, senderUid : string | null | undefined) : Promise<SendFriendRequestResult> {
    if (!senderUid) {
        return { success: false, error: "Not signed in" };
    }
    const trimmed = (username ?? "").trim();
    if (!trimmed) {
        return { success: false, error: "Enter a username" };
    }

    const recipientUid = await getUidByUsername(trimmed);
    if (!recipientUid) {
        return { success: false, error: "User not found" };
    }
    if (recipientUid === senderUid) {
        return { success: false, error: "Can't friend yourself" };
    }

    // Already friends?
    const senderSnap = await getDoc(doc(db, "userInfo", senderUid));
    const senderFriends = (senderSnap.data()?.["friends"] ?? []) as string[];
    if (Array.isArray(senderFriends) && senderFriends.includes(recipientUid)) {
        return { success: false, error: "Already friends" };
    }

    // Duplicate request in either direction?
    const outgoing = await getDocs(query(
        collection(db, "friendRequests"),
        where("sender", "==", senderUid),
        where("receiver", "==", recipientUid),
    ));
    if (!outgoing.empty) {
        return { success: false, error: "Request already pending" };
    }
    const incoming = await getDocs(query(
        collection(db, "friendRequests"),
        where("sender", "==", recipientUid),
        where("receiver", "==", senderUid),
    ));
    if (!incoming.empty) {
        return { success: false, error: "They've already requested you" };
    }

    await addDoc(collection(db, "friendRequests"), {
        sender: senderUid,
        receiver: recipientUid,
    });
    return { success: true };
}

/**
 * One-shot fetch of friend requests touching `uid` (either as sender or
 * receiver). Kept for non-reactive callers; reactive UI should use
 * subscribeToFriendRequests below so a request shows up the moment it's
 * sent and disappears the moment it's accepted/rejected.
 *
 * Now uses Firestore where() filters instead of a full collection scan, so
 * cost scales with the number of relevant requests rather than the entire
 * friendRequests table.
 */
export async function getFriendRequests(uid : string) : Promise<FriendRequest[]> {
    if (!uid) return [];
    const [byReceiver, bySender] = await Promise.all([
        getDocs(query(collection(db, "friendRequests"), where("receiver", "==", uid))),
        getDocs(query(collection(db, "friendRequests"), where("sender",   "==", uid))),
    ]);

    const seen = new Set<string>();
    const result: FriendRequest[] = [];
    for (const docSnap of [...byReceiver.docs, ...bySender.docs]) {
        if (seen.has(docSnap.id)) continue;
        seen.add(docSnap.id);
        const data = docSnap.data();
        result.push({
            id: docSnap.id,
            sender: String(data["sender"] ?? ""),
            receiver: String(data["receiver"] ?? ""),
        });
    }
    return result;
}

/**
 * Realtime subscription to friend requests *received* by `uid`. Fires once
 * with the initial snapshot and again whenever the Firestore-side set
 * changes (request created, accepted, refused, deleted). Sender display
 * names are resolved per-snapshot with a Map cache so it costs ~U user
 * reads per change (U = unique senders in the inbox).
 *
 * Returns an unsubscribe function — callers MUST invoke it on unmount.
 */
export function subscribeToFriendRequests(
    uid: string | null | undefined,
    onUpdate: (requests: FriendRequest[]) => void,
    onError?: (err: Error) => void,
): () => void {
    if (!uid) {
        onUpdate([]);
        return () => {};
    }

    const q = query(collection(db, "friendRequests"), where("receiver", "==", uid));
    let cancelled = false;

    const unsub = onSnapshot(
        q,
        (snapshot) => {
            const senderUids = Array.from(new Set(
                snapshot.docs
                    .map((d) => String(d.data()["sender"] ?? ""))
                    .filter(Boolean),
            ));

            (async () => {
                const senderNameByUid = new Map<string, string>();
                await Promise.all(
                    senderUids.map(async (senderUid) => {
                        const snap = await getDoc(doc(db, "userInfo", senderUid));
                        const data = snap.data();
                        if (data && typeof data["name"] === "string") {
                            senderNameByUid.set(senderUid, data["name"]);
                        }
                    }),
                );
                if (cancelled) return;

                const rows: FriendRequest[] = snapshot.docs.map((docSnap) => {
                    const data = docSnap.data();
                    const senderUid = String(data["sender"] ?? "");
                    return {
                        id: docSnap.id,
                        sender: senderUid,
                        receiver: String(data["receiver"] ?? ""),
                        senderName: senderNameByUid.get(senderUid) ?? "Unknown user",
                    };
                });

                onUpdate(rows);
            })().catch((err) => {
                if (cancelled) return;
                if (onError) onError(err as Error);
                else console.error("subscribeToFriendRequests build failed", err);
            });
        },
        (err) => {
            if (cancelled) return;
            if (onError) onError(err);
            else console.error("subscribeToFriendRequests onSnapshot failed", err);
        },
    );

    return () => {
        cancelled = true;
        unsub();
    };
}

/**
 * Internal helper: adds `friendUid` to `currUid`'s `friends` array (and
 * vice versa if `bidirectional` is true). Idempotent — already-friend
 * pairs are a no-op. Operates on UIDs only so the caller doesn't have to
 * round-trip through usernames.
 */
async function addFriendBidirectional(uidA: string, uidB: string): Promise<void> {
    if (!uidA || !uidB || uidA === uidB) return;
    const refA = doc(db, "userInfo", uidA);
    const refB = doc(db, "userInfo", uidB);
    const [snapA, snapB] = await Promise.all([getDoc(refA), getDoc(refB)]);
    const aFriends = Array.isArray(snapA.data()?.["friends"]) ? (snapA.data()!["friends"] as string[]) : [];
    const bFriends = Array.isArray(snapB.data()?.["friends"]) ? (snapB.data()!["friends"] as string[]) : [];

    const writes: Promise<unknown>[] = [];
    if (!aFriends.includes(uidB)) {
        writes.push(setDoc(refA, { friends: [...aFriends, uidB] }, { merge: true }));
    }
    if (!bFriends.includes(uidA)) {
        writes.push(setDoc(refB, { friends: [...bFriends, uidA] }, { merge: true }));
    }
    if (writes.length) await Promise.all(writes);
}

/**
 * Accepts or refuses a friend request. The friendRequests doc is deleted in
 * both branches so the inbox empties immediately and the request can never
 * be "re-accepted". On accept, both users' `friends` arrays are updated
 * before the doc is deleted so a network failure doesn't lose the request.
 */
export async function handleFriendRequest(request: FriendRequest, accepted: boolean): Promise<void> {
    if (!request?.id) return;

    if (accepted && request.sender && request.receiver) {
        await addFriendBidirectional(request.sender, request.receiver);
    }

    await deleteDoc(doc(db, "friendRequests", request.id));
}
/**
 * Realtime subscription to the current user's friends list. Listens to the
 * user's userInfo doc and re-resolves the `friends` array on every change,
 * so accepting/refusing a friend request, or being added/removed by someone
 * else, updates the UI without a refresh.
 *
 * Returns an unsubscribe function — callers MUST invoke it on unmount.
 */
export function subscribeToFriends(
    uid: string | null | undefined,
    onUpdate: (friends: Friend[]) => void,
    onError?: (err: Error) => void,
): () => void {
    if (!uid) {
        onUpdate([]);
        return () => {};
    }

    let cancelled = false;

    const unsub = onSnapshot(
        doc(db, "userInfo", uid),
        (snap) => {
            const data = snap.data();
            const friendUids = Array.isArray(data?.["friends"])
                ? (data!["friends"] as unknown[]).filter((u): u is string => typeof u === "string" && u.length > 0)
                : [];

            (async () => {
                // Resolve friend docs in parallel; preserve original order.
                const orderIndex = new Map<string, number>(friendUids.map((u, i) => [u, i]));
                const resolved = await Promise.all(
                    friendUids.map(async (friendUid) => {
                        const friendSnap = await getDoc(doc(db, "userInfo", friendUid));
                        if (!friendSnap.exists()) return null;
                        const friendData = friendSnap.data();
                        const name = typeof friendData["name"] === "string" ? friendData["name"] : "Unknown";
                        const friend: Friend = {
                            id: friendUid,
                            name,
                            avatar: name.slice(0, 2),
                            status: 'online',
                            lastActive: "dont care",
                            privacyEnabled: friendData["privacy"] === true,
                        };
                        return friend;
                    }),
                );
                if (cancelled) return;

                const friends = resolved
                    .filter((f): f is Friend => f !== null)
                    .sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0));

                onUpdate(friends);
            })().catch((err) => {
                if (cancelled) return;
                if (onError) onError(err as Error);
                else console.error('subscribeToFriends build failed', err);
            });
        },
        (err) => {
            if (cancelled) return;
            if (onError) onError(err);
            else console.error('subscribeToFriends onSnapshot failed', err);
        },
    );

    return () => {
        cancelled = true;
        unsub();
    };
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
            return []
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

// ─────────────────────────────────────────────────────────────────
//  HEAD-TO-HEAD (peer-to-peer side wagers, odds-matched)
//
//  Stake math (decimal odds O):
//    originalStake     = S          (escrowed when original owner accepts)
//    challengerStake   = S × (O−1)  (escrowed at proposal time)
//    totalEscrow       = S × O      (winner takes all)
//
//  Lifecycle:
//    proposeHeadToHead → PENDING_ACCEPT (challenger funds escrow)
//    acceptHeadToHead  → ACCEPTED       (original funds escrow)
//    declineHeadToHead → DECLINED       (challenger refunded)
//    cancelHeadToHead  → CANCELLED      (challenger refunded; only before accept)
//    settleHeadToHead  → WON_BY_*       (called by settlement cron)
//
//  All money moves are atomic via runTransaction so we never half-debit.
// ─────────────────────────────────────────────────────────────────

const H2H_COLLECTION = "headToHead";

export type ProposeHeadToHeadResult =
    | { success: true; h2hId: string; challengerStake: number }
    | { success: false; error:
        | "BET_NOT_FOUND"
        | "BET_ALREADY_SETTLED"
        | "EVENT_STARTED"
        | "OWN_BET"
        | "PARLAY_UNSUPPORTED"
        | "MISSING_EVENT_INFO"
        | "INSUFFICIENT_FUNDS"
        | "USER_NOT_FOUND"
        | "DUPLICATE_PROPOSAL"
        | "UNKNOWN" };

/**
 * Computes the challenger's odds-matched stake. Decimal odds only.
 * Returns 0 (and the caller should reject) if odds are not > 1.
 */
function computeChallengerStake(originalStake: number, originalOdds: number): number {
    if (!Number.isFinite(originalStake) || !Number.isFinite(originalOdds)) return 0;
    if (originalOdds <= 1) return 0;
    return Math.round(originalStake * (originalOdds - 1) * 100) / 100;
}

/**
 * Challenger proposes to fade an existing pending bet.
 * Atomically:
 *   - validates the bet is still fadeable (pending, not started, not own)
 *   - escrows the challenger's odds-matched stake
 *   - writes a new headToHead/{id} doc with status PENDING_ACCEPT
 *
 * The original owner does NOT pay anything here — they pay when they accept.
 * Free bets (`isFree: true`) are still fadeable; the challenger is paying real
 * money against the free-bet pick, which is the original owner's choice to accept.
 */
export async function proposeHeadToHead(
    originalBetId: string,
    challengerUserId: string,
): Promise<ProposeHeadToHeadResult> {
    try {
        const result = await runTransaction(db, async (transaction) => {
            const betRef = doc(db, "bets", originalBetId);
            const betSnap = await transaction.get(betRef);
            if (!betSnap.exists()) throw new Error("BET_NOT_FOUND");

            const betData = betSnap.data();

            // Disallow fading the same bet twice from the same challenger
            // (cheap dedupe — a stricter version would query at the collection level).
            const existingId = `${originalBetId}_${challengerUserId}`;
            const dupRef = doc(db, H2H_COLLECTION, existingId);
            const dupSnap = await transaction.get(dupRef);
            if (dupSnap.exists()) {
                const dupStatus = dupSnap.data().status as HeadToHeadStatus;
                if (dupStatus === "PENDING_ACCEPT" || dupStatus === "ACCEPTED") {
                    throw new Error("DUPLICATE_PROPOSAL");
                }
            }

            const originalUserId = String(betData.userID ?? "");
            if (!originalUserId) throw new Error("BET_NOT_FOUND");
            if (originalUserId === challengerUserId) throw new Error("OWN_BET");

            const status = (betData.status ?? "PENDING") as BetStatus;
            if (status !== "PENDING") throw new Error("BET_ALREADY_SETTLED");

            const betType = betData.betType === "parlay" ? "parlay" : "single";
            if (betType === "parlay") throw new Error("PARLAY_UNSUPPORTED");

            const eventId  = String(betData.eventId  ?? "");
            const sportKey = String(betData.sportKey ?? "");
            if (!eventId || !sportKey) throw new Error("MISSING_EVENT_INFO");

            const originalStake = Number(betData.stake) || 0;
            const originalOdds  = Number(betData.odds)  || 0;
            const challengerStake = computeChallengerStake(originalStake, originalOdds);
            if (challengerStake <= 0) throw new Error("MISSING_EVENT_INFO");

            // Hard lock: no fades after kickoff. Bets written before this field
            // existed (legacy data) won't have eventStartsAt — those skip the
            // lock and rely on the cron's existing settlement gating instead.
            const eventStartsTs = betData.eventStartsAt as Timestamp | undefined;
            const eventStartsDate = eventStartsTs?.toDate?.();
            if (eventStartsDate && eventStartsDate.getTime() <= Date.now()) {
                throw new Error("EVENT_STARTED");
            }

            const challengerRef = doc(db, "userInfo", challengerUserId);
            const challengerSnap = await transaction.get(challengerRef);
            if (!challengerSnap.exists()) throw new Error("USER_NOT_FOUND");

            const challengerMoney = Number(challengerSnap.data().money) || 0;
            if (challengerMoney < challengerStake) throw new Error("INSUFFICIENT_FUNDS");

            const nowTs = Timestamp.now();

            // Persist
            transaction.set(dupRef, {
                originalBetId,
                originalUserId,
                originalSide:    String(betData.optionLabel ?? ""),
                originalOdds,
                originalStake,
                challengerUserId,
                challengerStake,
                marketId:        String(betData.marketId    ?? ""),
                marketTitle:     String(betData.marketTitle ?? ""),
                eventId,
                sportKey,
                eventStartsAt:   eventStartsTs ?? null,
                status:          "PENDING_ACCEPT",
                createdAt:       nowTs,
            });

            transaction.update(challengerRef, { money: challengerMoney - challengerStake });

            return { id: existingId, challengerStake };
        });

        return { success: true, h2hId: result.id, challengerStake: result.challengerStake };
    } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        switch (msg) {
            case "BET_NOT_FOUND":
            case "BET_ALREADY_SETTLED":
            case "EVENT_STARTED":
            case "OWN_BET":
            case "PARLAY_UNSUPPORTED":
            case "MISSING_EVENT_INFO":
            case "INSUFFICIENT_FUNDS":
            case "USER_NOT_FOUND":
            case "DUPLICATE_PROPOSAL":
                return { success: false, error: msg };
            default:
                return { success: false, error: "UNKNOWN" };
        }
    }
}

export type AcceptHeadToHeadResult =
    | { success: true }
    | { success: false; error:
        | "H2H_NOT_FOUND"
        | "WRONG_USER"
        | "WRONG_STATUS"
        | "EVENT_STARTED"
        | "INSUFFICIENT_FUNDS"
        | "USER_NOT_FOUND"
        | "UNKNOWN" };

/**
 * Original bet owner accepts a pending H2H proposal.
 * Atomically: escrows their odds-matched stake and flips status to ACCEPTED.
 * Only the user identified by `originalUserId` on the H2H doc may accept.
 */
export async function acceptHeadToHead(
    h2hId: string,
    actingUserId: string,
): Promise<AcceptHeadToHeadResult> {
    try {
        await runTransaction(db, async (transaction) => {
            const h2hRef = doc(db, H2H_COLLECTION, h2hId);
            const snap = await transaction.get(h2hRef);
            if (!snap.exists()) throw new Error("H2H_NOT_FOUND");

            const data = snap.data();
            const status = data.status as HeadToHeadStatus;
            if (status !== "PENDING_ACCEPT") throw new Error("WRONG_STATUS");
            if (String(data.originalUserId) !== actingUserId) throw new Error("WRONG_USER");

            // Re-check the kickoff lock at accept time (the game may have started
            // between proposal and acceptance).
            const eventStartsTs = data.eventStartsAt as Timestamp | undefined;
            const eventStartsDate = eventStartsTs?.toDate?.();
            if (eventStartsDate && eventStartsDate.getTime() <= Date.now()) {
                throw new Error("EVENT_STARTED");
            }

            const originalStake = Number(data.originalStake) || 0;
            if (originalStake <= 0) throw new Error("WRONG_STATUS");

            const userRef = doc(db, "userInfo", actingUserId);
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists()) throw new Error("USER_NOT_FOUND");

            const money = Number(userSnap.data().money) || 0;
            if (money < originalStake) throw new Error("INSUFFICIENT_FUNDS");

            transaction.update(userRef, { money: money - originalStake });
            transaction.update(h2hRef, {
                status: "ACCEPTED",
                acceptedAt: Timestamp.now(),
            });
        });
        return { success: true };
    } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        switch (msg) {
            case "H2H_NOT_FOUND":
            case "WRONG_USER":
            case "WRONG_STATUS":
            case "EVENT_STARTED":
            case "INSUFFICIENT_FUNDS":
            case "USER_NOT_FOUND":
                return { success: false, error: msg };
            default:
                return { success: false, error: "UNKNOWN" };
        }
    }
}

export type DeclineOrCancelResult =
    | { success: true }
    | { success: false; error: "H2H_NOT_FOUND" | "WRONG_USER" | "WRONG_STATUS" | "UNKNOWN" };

/**
 * Original bet owner declines a pending H2H proposal.
 * Atomically refunds the challenger's escrow and flips status to DECLINED.
 */
export async function declineHeadToHead(
    h2hId: string,
    actingUserId: string,
): Promise<DeclineOrCancelResult> {
    return refundChallengerAndClose(h2hId, actingUserId, "DECLINED", "originalUserId");
}

/**
 * Challenger withdraws their proposal before the original owner accepts.
 * Atomically refunds the challenger and flips status to CANCELLED.
 */
export async function cancelHeadToHead(
    h2hId: string,
    actingUserId: string,
): Promise<DeclineOrCancelResult> {
    return refundChallengerAndClose(h2hId, actingUserId, "CANCELLED", "challengerUserId");
}

async function refundChallengerAndClose(
    h2hId: string,
    actingUserId: string,
    nextStatus: "DECLINED" | "CANCELLED",
    expectedActorField: "originalUserId" | "challengerUserId",
): Promise<DeclineOrCancelResult> {
    try {
        await runTransaction(db, async (transaction) => {
            const h2hRef = doc(db, H2H_COLLECTION, h2hId);
            const snap = await transaction.get(h2hRef);
            if (!snap.exists()) throw new Error("H2H_NOT_FOUND");

            const data = snap.data();
            const status = data.status as HeadToHeadStatus;
            if (status !== "PENDING_ACCEPT") throw new Error("WRONG_STATUS");
            if (String(data[expectedActorField]) !== actingUserId) throw new Error("WRONG_USER");

            const challengerStake = Number(data.challengerStake) || 0;
            const challengerUserId = String(data.challengerUserId);
            const challengerRef = doc(db, "userInfo", challengerUserId);

            // Refund using increment so we don't need a read of money here.
            transaction.update(challengerRef, { money: increment(challengerStake) });
            transaction.update(h2hRef, { status: nextStatus, settledAt: Timestamp.now() });
        });
        return { success: true };
    } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        switch (msg) {
            case "H2H_NOT_FOUND":
            case "WRONG_USER":
            case "WRONG_STATUS":
                return { success: false, error: msg };
            default:
                return { success: false, error: "UNKNOWN" };
        }
    }
}

/** Convert a Firestore document into a typed HeadToHead object. */
function mapHeadToHead(id: string, data: DocumentData): HeadToHead {
    const eventStartsAtRaw = data.eventStartsAt as Timestamp | undefined;
    const createdAtRaw     = data.createdAt     as Timestamp | undefined;
    const acceptedAtRaw    = data.acceptedAt    as Timestamp | undefined;
    const settledAtRaw     = data.settledAt     as Timestamp | undefined;
    return {
        id,
        originalBetId:    String(data.originalBetId    ?? ""),
        originalUserId:   String(data.originalUserId   ?? ""),
        originalSide:     String(data.originalSide     ?? ""),
        originalOdds:     Number(data.originalOdds)     || 0,
        originalStake:    Number(data.originalStake)    || 0,
        challengerUserId: String(data.challengerUserId ?? ""),
        challengerStake:  Number(data.challengerStake)  || 0,
        marketId:         String(data.marketId         ?? ""),
        marketTitle:      String(data.marketTitle      ?? ""),
        eventId:          String(data.eventId          ?? ""),
        sportKey:         String(data.sportKey         ?? ""),
        eventStartsAt:    eventStartsAtRaw ? eventStartsAtRaw.toDate() : new Date(0),
        status:           (data.status ?? "PENDING_ACCEPT") as HeadToHeadStatus,
        createdAt:        createdAtRaw ? createdAtRaw.toDate() : new Date(0),
        acceptedAt:       acceptedAtRaw ? acceptedAtRaw.toDate() : undefined,
        settledAt:        settledAtRaw  ? settledAtRaw.toDate()  : undefined,
    };
}

/** All H2H proposals where the user is the challenger (sent by them). */
export async function getOutgoingHeadToHead(uid: string): Promise<HeadToHead[]> {
    const q = query(collection(db, H2H_COLLECTION), where("challengerUserId", "==", uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapHeadToHead(d.id, d.data()));
}

/** All H2H proposals where the user is the original bet owner (sent to them). */
export async function getIncomingHeadToHead(uid: string): Promise<HeadToHead[]> {
    const q = query(collection(db, H2H_COLLECTION), where("originalUserId", "==", uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapHeadToHead(d.id, d.data()));
}

/** Returns all ACCEPTED H2H docs across all users. Called by the settlement cron. */
export async function getAcceptedHeadToHead(): Promise<HeadToHead[]> {
    const q = query(collection(db, H2H_COLLECTION), where("status", "==", "ACCEPTED"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapHeadToHead(d.id, d.data()));
}

/**
 * Settles an accepted H2H bet and pays the winner (or refunds both on PUSH).
 * Idempotent: if the doc is no longer in ACCEPTED status, this is a no-op.
 *
 * Called by the settlement cron after the underlying bet's status flips to
 * WON / LOST / PUSH / CANCELLED. The mapping is:
 *
 *   underlying WON  → original picked the winning side → WON_BY_ORIGINAL
 *   underlying LOST → original picked the losing side  → WON_BY_CHALLENGER
 *   PUSH | CANCELLED                                   → PUSH (refund both)
 *
 * @author Cursor (head-to-head feature)
 */
export async function settleHeadToHead(
    h2hId: string,
    underlyingResult: "WON" | "LOST" | "PUSH" | "CANCELLED",
): Promise<{ success: boolean; error?: string }> {
    try {
        await runTransaction(db, async (transaction) => {
            const h2hRef = doc(db, H2H_COLLECTION, h2hId);
            const snap = await transaction.get(h2hRef);
            if (!snap.exists()) throw new Error("H2H_NOT_FOUND");

            const data = snap.data();
            const status = data.status as HeadToHeadStatus;
            if (status !== "ACCEPTED") return; // idempotent no-op

            const originalUserId   = String(data.originalUserId);
            const challengerUserId = String(data.challengerUserId);
            const originalStake    = Number(data.originalStake)    || 0;
            const challengerStake  = Number(data.challengerStake)  || 0;
            const totalEscrow      = originalStake + challengerStake;

            const originalRef   = doc(db, "userInfo", originalUserId);
            const challengerRef = doc(db, "userInfo", challengerUserId);

            let nextStatus: HeadToHeadStatus;
            if (underlyingResult === "WON") {
                transaction.update(originalRef,   { money: increment(totalEscrow) });
                nextStatus = "WON_BY_ORIGINAL";
            } else if (underlyingResult === "LOST") {
                transaction.update(challengerRef, { money: increment(totalEscrow) });
                nextStatus = "WON_BY_CHALLENGER";
            } else {
                // PUSH or CANCELLED — refund each side their own escrow
                transaction.update(originalRef,   { money: increment(originalStake)   });
                transaction.update(challengerRef, { money: increment(challengerStake) });
                nextStatus = "PUSH";
            }

            transaction.update(h2hRef, {
                status:    nextStatus,
                settledAt: Timestamp.now(),
            });
        });
        return { success: true };
    } catch (error) {
        const msg = error instanceof Error ? error.message : "UNKNOWN";
        return { success: false, error: msg };
    }
}
