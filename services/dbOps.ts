import { setDoc, doc, getDoc, getDocs, onSnapshot, collection, Timestamp, runTransaction, deleteField } from "firebase/firestore";
import { db } from "@/models/constants.ts";
import { Bet, LeaderboardEntry } from "@/models";

export var currBets = new Array<Bet>;

/**
 * Sets a specified user's username in Firestore
 * @param uid A user's Firebase Authentication ID.
 * @param name The new username that the user will have in Firestore.
 * @author Aidan Rodriguez
 */
export async function setUserName(uid : string, name : string) {
    await setDoc(doc(db, "userInfo", uid), {
        name: name
    }, { merge: true })
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
    }, { merge: true })
}

/**
 * Gets both the user's wins and losses from Firestore.
 * @param uid A user's Firebase Authentication ID.
 * @return An array of two numbers - index 0 is the user's wins, while index 1 is the user's losses.
 * @author Aidan Rodriguez
 */
export async function getUserRatio(uid: string) : Promise<number[]> {
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
export async function setUserMoney(uid : string, amount : number) {
    await setDoc(doc(db, "userInfo", uid), {
        money: amount
    }, { merge : true});
}

/**
 * Informs the database that a user has claimed their daily bonus by setting their last claimed date to the current time.
 * @param uid A user's Firebase Authentication ID.
 * @author Aidan Rodriguez
 */
export async function claimedDaily(uid : string) {
    await setDoc(doc(db, "userInfo", uid), {
        lastClaim: Timestamp.now()
    }, { merge: true})
}

/**
 * Sets a user's last claim to 1/1/1900, used in the creation of a new user.
 * @param uid A user's Firebase Authentication ID.
 */
export async function setNewDaily(uid : string) {
    var beginningOfTime = new Date(1900, 1, 1)
    await setDoc(doc(db, "userInfo", uid), {
        lastClaim: Timestamp.fromDate(beginningOfTime)
    }, { merge: true })
}

/**
 * Adds to the user's current money in Firestore.
 * @param uid A user's Firebase Authentication ID.
 * @param amount The amount that will be added to the user's money (or in the case of a negative number, subtracted).
 */
export async function changeUserMoney(uid : string, amount : number) {
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

        onUpdate?.({ money, hasDailyBonus });
    });
}

/**
 * Gets the last time a user claimed their daily bonus.
 * @param uid A user's Firebase Authentication ID.
 * @return The last time a user claimed their daily bonus as a Timestamp object. It should be also noted that this object
 * is returned as a Promise.
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
 * - Migrates LastClaim -> lastClaim
 * - Coerces money/wins/losses to finite numbers
 */
export async function normalizeUserInfoDoc(uid: string): Promise<NormalizedUserInfo | null> {
    const userRef = doc(db, "userInfo", uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return null;

    const data = snap.data();
    const moneyRaw = data.money;
    const winsRaw = data.wins;
    const lossesRaw = data.losses;
    const lastClaimRaw = data.lastClaim ?? data.LastClaim;

    const money = Number.isFinite(Number(moneyRaw)) ? Number(moneyRaw) : 0;
    const wins = Number.isFinite(Number(winsRaw)) ? Number(winsRaw) : 0;
    const losses = Number.isFinite(Number(lossesRaw)) ? Number(lossesRaw) : 0;

    const fallbackDate = new Date(1900, 0, 1);
    const lastClaim =
        lastClaimRaw && typeof lastClaimRaw.toDate === "function"
            ? Timestamp.fromDate(lastClaimRaw.toDate())
            : Timestamp.fromDate(fallbackDate);

    await setDoc(
        userRef,
        {
            money,
            wins,
            losses,
            lastClaim,
            LastClaim: deleteField(),
        },
        { merge: true }
    );

    return { money, wins, losses, lastClaim };
}

/**
 * Adds a bet to the Firestore database associated with a user.
 * @param uid The user ID that the added bet will be associated with.
 * @param bet The Bet object that will be uploaded to Firestore.
 * @author Aidan Rodriguez
 */
export async function addBet(uid: string, bet: Bet) {
    await setDoc(doc(db, "bets", bet.id), {
        userID: uid,
        marketId: bet.marketId,
        marketTitle: bet.marketTitle,
        optionLabel: bet.optionLabel,
        betType: bet.betType ?? "single",
        parlayLegs: bet.parlayLegs ?? [],
        legCount: bet.parlayLegs?.length ?? (bet.betType === "parlay" ? 0 : 1),
        stake: bet.stake,
        odds: bet.odds,
        potentialPayout: bet.potentialPayout,
        placedAt: bet.placedAt
    })
    currBets.push(bet)
}

export type PlaceSingleBetResult =
    | { success: true; newBalance: number }
    | { success: false; error: "USER_NOT_FOUND" | "INVALID_STAKE" | "INSUFFICIENT_FUNDS" | "UNKNOWN" };

/**
 * Places a single bet and debits funds atomically in Firestore.
 * This avoids race conditions from separate read/write calls.
 */
export async function placeSingleBet(uid: string, bet: Bet): Promise<PlaceSingleBetResult> {
    if (!Number.isFinite(bet.stake) || bet.stake <= 0) {
        return { success: false, error: "INVALID_STAKE" };
    }

    try {
        const newBalance = await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "userInfo", uid);
            const betRef = doc(db, "bets", bet.id);

            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists()) {
                throw new Error("USER_NOT_FOUND");
            }

            const currentMoney = Number(userSnap.data().money) || 0;
            if (currentMoney < bet.stake) {
                throw new Error("INSUFFICIENT_FUNDS");
            }

            const nextMoney = currentMoney - bet.stake;

            transaction.set(betRef, {
                userID: uid,
                marketId: bet.marketId,
                marketTitle: bet.marketTitle,
                optionLabel: bet.optionLabel,
                betType: bet.betType ?? "single",
                parlayLegs: bet.parlayLegs ?? [],
                legCount: bet.parlayLegs?.length ?? (bet.betType === "parlay" ? 0 : 1),
                stake: bet.stake,
                odds: bet.odds,
                potentialPayout: bet.potentialPayout,
                placedAt: Timestamp.fromDate(bet.placedAt),
            });
            transaction.set(userRef, { money: nextMoney }, { merge: true });

            return nextMoney;
        });

        currBets.push(bet);
        return { success: true, newBalance };
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message === "USER_NOT_FOUND") return { success: false, error: "USER_NOT_FOUND" };
        if (message === "INSUFFICIENT_FUNDS") return { success: false, error: "INSUFFICIENT_FUNDS" };
        return { success: false, error: "UNKNOWN" };
    }
}

/**
 * Returns all bets associated with a user ID.
 * @param uid The user ID that will be part of the request to Firestore for the data.
 * @return Returns an Array of bets from Firestore associated with the user ID. If no bets are found, an empty Array is
 * returned. It should be noted that this Array is returned as a Promise.
 * @author Aidan Rodriguez
 */
export async function getBets(uid: string) : Promise<Bet[]> {
    var betList = new Array()
    const querySnapshot = await getDocs(collection(db, "bets"));
    querySnapshot.forEach((doc) => {
        if (doc.data().userID == uid) {
            const validBet : Bet = {
                id: doc.id,
                marketId: doc.data().marketId,
                marketTitle: doc.data().marketTitle,
                optionLabel: doc.data().optionLabel,
                betType: doc.data().betType === "parlay" ? "parlay" : "single",
                stake: doc.data().stake,
                odds: doc.data().odds,
                potentialPayout: doc.data().potentialPayout,
                placedAt: doc.data().placedAt.toDate(),
                parlayLegs: Array.isArray(doc.data().parlayLegs)
                    ? doc.data().parlayLegs.map((leg: any) => ({
                        marketId: String(leg.marketId ?? ""),
                        marketTitle: String(leg.marketTitle ?? ""),
                        optionId: String(leg.optionId ?? ""),
                        optionLabel: String(leg.optionLabel ?? ""),
                        odds: Number(leg.odds) || 0,
                    }))
                    : undefined,
            }
            try {

                betList.push(validBet as Bet)
            }
            catch (error) {
                console.log(error)
            }
        }
        else {
            console.log("Bet was found invalid.")
        }
    })
    return betList
}

export async function getTopUsers() : Promise<LeaderboardEntry[]> {
    const topUserList: LeaderboardEntry[] = [];

    const querySnapshot = await getDocs(collection(db, "userInfo"));
    for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        const name = typeof data.name === "string" ? data.name : "";
        if (!name.trim()) continue;

        const wins = Number(data.wins) || 0;
        const losses = Number(data.losses) || 0;
        let winRate = 0;
        if (losses === 0) {
            winRate = wins > 0 ? 100 : 0;
        } else {
            winRate = (wins / losses) * 100;
        }
        if (!Number.isFinite(winRate)) winRate = 0;
        winRate = Math.min(100, Math.round(winRate));

        const money = typeof data.money === "number" ? data.money : Number(data.money) || 0;

        topUserList.push({
            id: docSnap.id,
            name,
            avatar: name.slice(0, 2).toUpperCase(),
            netWorth: money,
            winRate,
            rank: 1,
            isCurrentUser: false,
        });
    }

    topUserList.sort((a, b) => b.netWorth - a.netWorth);
    var rankCounter = 0;
    for (const user of topUserList) {
        rankCounter++
        topUserList[rankCounter - 1].rank = rankCounter
    }

    return topUserList;
}