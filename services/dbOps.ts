import { setDoc, doc, getDoc, getDocs, onSnapshot, collection, Timestamp, DocumentData, FieldValue} from "firebase/firestore";
import { db } from "@/models/constants.ts";
import {Bet, Friend, LeaderboardEntry, SocialActivity} from "@/models";
import firebase from "firebase/compat/app";
import DocumentReference = firebase.firestore.DocumentReference;
import { betList } from "@/services/authService.ts";
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
export async function getUserMoney(uid: string): Promise<number> {

    const documentReference = doc(db, "userInfo", uid);
    const documentSnapshot = await getDoc(documentReference);

    if (documentSnapshot.exists()) {
        const data = documentSnapshot.data();
        return data["money"] as number;
    } else {
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

    }, {merge: true});
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
        const hasDailyBonus = data.lastClaim
            ? data.lastClaim.toDate().getDate() !== currDate.getDate() ||
            data.lastClaim.toDate().getMonth() !== currDate.getMonth() ||
            data.lastClaim.toDate().getFullYear() !== currDate.getFullYear()
            : true;
        localStorage.setItem("hasDailyBonus", hasDailyBonus ? "true" : "false");

        onUpdate?.({money, hasDailyBonus});
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
        return data["lastClaim"] as Timestamp;
    } else {
        return null;
    }
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
        stake: bet.stake,
        odds: bet.odds,
        potentialPayout: bet.potentialPayout,
        placedAt: bet.placedAt
    })
    currBets.push(bet)
}

/**
 * Returns all bets associated with a user ID.
 * @param uid The user ID that will be part of the request to Firestore for the data.
 * @return Returns an Array of bets from Firestore associated with the user ID. If no bets are found, an empty Array is
 * returned. It should be noted that this Array is returned as a Promise.
 * @author Aidan Rodriguez
 */
export async function getBets(uid: string): Promise<Bet[]> {
    var betList = new Array()
    const querySnapshot = await getDocs(collection(db, "bets"));
    querySnapshot.forEach((doc) => {
        if (doc.data().userID == uid) {
            const validBet: Bet = {
                id: doc.id,
                marketId: doc.data().marketId,
                marketTitle: doc.data().marketTitle,
                optionLabel: doc.data().optionLabel,
                stake: doc.data().stake,
                odds: doc.data().odds,
                potentialPayout: doc.data().potentialPayout,
                placedAt: doc.data().placedAt.toDate()
            }
            try {

                betList.push(validBet as Bet)
            } catch (error) {
                console.log(error)
            }
        } else {
        }
    })
    return betList
}

export async function getTopUsers(): Promise<LeaderboardEntry[]> {
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