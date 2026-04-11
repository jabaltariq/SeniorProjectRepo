import { setDoc, doc, getDoc, getDocs, onSnapshot, collection, deleteDoc, Timestamp, runTransaction, deleteField, query, where, writeBatch, increment, QueryDocumentSnapshot, DocumentData, DocumentReference, addDoc } from "firebase/firestore";
import { db } from "@/models/constants.ts";
import {Bet, LeaderboardEntry, ParlayLeg, BetStatus, Friend, SocialActivity} from "@/models";
import {betList} from "@/services/authService.ts";
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

export async function getFriendRequestsAsName(requests : FriendRequest[]) : Promise<FriendRequest[]> {
    var friendRequestsAsName: FriendRequest[] = [];
    for (const item of requests) {
        const newFriendRequest = {
            id: item.id,
            sender: await getUserName(item.sender),
            receiver: await getUserName(item.receiver)
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
        eventId:         bet.eventId  ?? bet.marketId,   // Odds API event ID
        sportKey:        bet.sportKey ?? "",              // e.g. "basketball_nba"
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
                // For parlays, persist each leg with its sportKey and marketKey
                // so the settlement service can resolve each leg independently.
                parlayLegs:      (bet.parlayLegs ?? []).map((leg: ParlayLeg) => ({
                    marketId:    leg.marketId,
                    marketTitle: leg.marketTitle,
                    sportKey:    leg.sportKey   ?? "",   // ← needed for settlement
                    optionId:    leg.optionId,
                    optionLabel: leg.optionLabel,
                    odds:        leg.odds,
                    marketKey:   leg.marketKey  ?? "h2h", // ← needed for spread/total resolution
                    result:      "PENDING",
                })),
                legCount:        bet.legCount ?? (bet.betType === "parlay" ? (bet.parlayLegs?.length ?? 0) : 1),
                stake:           bet.stake,
                odds:            bet.odds,
                potentialPayout: bet.potentialPayout,
                placedAt:        Timestamp.fromDate(bet.placedAt),
                // ── Settlement fields ──────────────────────────────────
                status:          "PENDING",
                eventId:         bet.eventId  ?? bet.marketId,   // singles only (parlay uses legs)
                sportKey:        bet.sportKey ?? "",              // singles only
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
    // CHANGED: query filter instead of scanning every bet in the collection
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
            // CHANGED: now maps sportKey and marketKey so settlement can use them
            parlayLegs: Array.isArray(data.parlayLegs)
                ? data.parlayLegs.map((leg: any): ParlayLeg => ({
                    marketId:    String(leg.marketId    ?? ""),
                    marketTitle: String(leg.marketTitle ?? ""),
                    sportKey:    String(leg.sportKey    ?? ""),   // ← added
                    optionId:    String(leg.optionId    ?? ""),
                    optionLabel: String(leg.optionLabel ?? ""),
                    odds:        Number(leg.odds)        || 0,
                    marketKey:   String(leg.marketKey   ?? "h2h"), // ← added
                    result:      leg.result ?? "PENDING",
                }))
                : [],
            // Settlement fields
            status:    (data.status   ?? "PENDING") as BetStatus,
            eventId:   data.eventId,
            sportKey:  data.sportKey,
            settledAt: data.settledAt?.toDate(),
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
        });
    });

    return betList;
}

/**
 * Marks a bet as WON or LOST and updates the user's wallet and record atomically.
 * Called by the settlement service after a game is confirmed completed.
 */
export async function settleBet(bet: Bet, result: "WON" | "LOST"): Promise<void> {
    const batch = writeBatch(db);

    // 1. Update bet status
    batch.update(doc(db, "bets", bet.id), {
        status:    result,
        settledAt: Timestamp.now(),
    });

    // 2. Update user wallet and record
    // NOTE: collection is "userInfo" (not "users")
    const userRef = doc(db, "userInfo", bet.userID);
    if (result === "WON") {
        batch.update(userRef, {
            money:  increment(bet.potentialPayout),
            wins:   increment(1),
        });
    } else {
        batch.update(userRef, {
            losses: increment(1),
        });
    }

    await batch.commit();
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
            winRate = (wins / (wins + losses)) * 100;  // FIXED: was wins/losses (wrong formula)
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
            console.log("user does not exist, throwing out document")
            continue;
        }

        let newSocialActivity: SocialActivity;

        if (userData["access"] == true) {
            newSocialActivity = {
                id: docSnap.id,
                userId: documentSnapshot.id,
                userName: "Anonymous User",
                userAvatar: "?",
                action: "placed a bet on",
                target: data["marketTitle"],
                timestamp: ""
            }
        }
        else {
            newSocialActivity = {
                id: docSnap.id,
                userId: documentSnapshot.id,
                userName: userData["name"],
                userAvatar: userData["name"]?.slice(0, 2),
                action: "placed a bet on",
                target: data["marketTitle"],
                timestamp: ""
            }
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

export async function sendFriendRequest(username : string, senderUid : string) {
    const querySnapshot = await getDocs(collection(db, "userInfo"));

    for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data()
        if (data["name"] == username) {
            await addDoc(collection(db, "friendRequests"), {
                sender: senderUid,
                receiver: docSnap.id,
            })
            console.log("added friend")
            break;
        }
    }
}

export interface FriendRequest {
    id: string,
    sender: string,
    receiver: string,
}

export async function getFriendRequests(uid : string) : Promise<FriendRequest[]> {
    const querySnapshot = await getDocs(collection(db, "friendRequests"))
    var friendRequests : FriendRequest[] = []
    for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data()
        if (data["sender"] == uid || data["receiver"] == uid) {
            const newFriendRequest = {
                id: docSnap.id,
                sender: data["sender"],
                receiver: data["receiver"]
            }
            friendRequests.push(newFriendRequest)
        }
    }
    return friendRequests
}

export async function handleFriendRequest (request : FriendRequest, accepted : boolean) {
    if (accepted) {
        console.log(request)
        const querySnapshot = await getDocs(collection(db, "userInfo"));

        for (const docSnap of querySnapshot.docs) {
            const data = docSnap.data()
            if (data["name"] == request.sender) {
                addFriend(data["name"], await getUidByUsername(request.receiver))
            }
            else if (data["name"] == request.receiver) {
                addFriend(data["name"], await getUidByUsername(request.sender))
            }
        }
        const documentReference = doc(db, "friendRequests", request.id)

        await deleteDoc(documentReference)
        console.log("Deleted friend request from database.")
    }
    else {
        const documentReference = doc(db, "friendRequests", request.id)

        await deleteDoc(documentReference)
        console.log("Deleted friend request from database.")
    }
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