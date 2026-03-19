import { setDoc, doc, getDoc, getDocs, onSnapshot, collection, Timestamp } from "firebase/firestore";
import { db } from "@/models/constants.ts";
import { Bet, LeaderboardEntry } from "@/models";

export var currBets = new Array<Bet>;

export async function setUserName(uid : string, name : string) {
    await setDoc(doc(db, "userInfo", uid), {
        name: name
    }, { merge: true })
}

export async function resetRatio(uid: string) {
    await setDoc(doc(db, "userInfo", uid), {
        wins: 0,
        losses: 0
    }, { merge: true })
}

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
        return data["money"] as number;
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

/**
 * Listens for changes in the Firestore database, and updates the information in the application accordingly.
 * @param uid A user's Firebase Authentication ID.
 * @author Aidan Rodriguez
 */
export function listenForChange(uid : string) {
    const unsub = onSnapshot(doc(db, "userInfo", uid), (doc) => {
        const source = doc.metadata.hasPendingWrites ? "Local" : "Server";
        console.log(source, " data: ", doc.data());
        localStorage.setItem("userMoney", doc.data().money)

        var currDate = new Date(Date.now())
        if ((doc.data().lastClaim.toDate().getDay() == currDate.getDay())) {
            localStorage.setItem("hasDailyBonus", "false")
            console.log("false")
        }
        else {
            localStorage.setItem("hasDailyBonus", "true")
            console.log("true")
        }

    })
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
                stake: doc.data().stake,
                odds: doc.data().odds,
                potentialPayout: doc.data().potentialPayout,
                placedAt: doc.data().placedAt.toDate()
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
    var topUserList = new Array();


    const querySnapshot = await getDocs(collection(db, "userInfo"))
    querySnapshot.forEach(async (doc) => {
        var ratio = (doc.data().wins / doc.data().losses) * 100
        if (isNaN(ratio)) {
            ratio = 100
        }
        const newTopUser : LeaderboardEntry = {
            id: doc.id,
            name: doc.data().name,
            avatar: "",
            netWorth: doc.data().money,
            winRate: ratio,
            rank: 1,
            isCurrentUser: false
        }
        topUserList.push(newTopUser)
    })

    const sortFunc = (field) => {
        return (a, b) => {
            let comp = 0;
            if (a[field] > b[field]) {
                comp = 1;
            }
            else {
                comp = 1;
            }

            return comp * -1;
        }
    }

    topUserList.sort((a, b) => b.netWorth - a.netWorth )
    var rankCounter = 0;
    for (const user of topUserList) {
        rankCounter++
        topUserList[rankCounter - 1].rank = rankCounter
    }

    return topUserList;
}