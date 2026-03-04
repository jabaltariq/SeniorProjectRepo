import { setDoc, doc, getDoc, getDocs, getFirestore, onSnapshot, collection, Timestamp } from "firebase/firestore";
import {APP} from "@/models/constants.ts";
import {Bet} from "@/models";

const db = getFirestore(APP);
export var currBets = new Array<Bet>;

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

export async function setUserMoney(uid : string, amount : number) {
    await setDoc(doc(db, "userInfo", uid), {
        money: amount
    }, { merge : true});
}

export async function claimedDaily(uid : string) {
    await setDoc(doc(db, "userInfo", uid), {
        lastClaim: Timestamp.now()
    }, { merge: true})
}

export async function setNewDaily(uid : string) {
    var beginningOfTime = new Date(1900, 1, 1)
    await setDoc(doc(db, "userInfo", uid), {
        lastClaim: Timestamp.fromDate(beginningOfTime)
    }, { merge: true })
}
export async function changeUserMoney(uid : string, amount : number) {
    const newMoney = ((await getUserMoney(uid)) + amount);
    await setDoc(doc(db, "userInfo", uid), {
        money: newMoney

    }, { merge: true });
}

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

export async function getBets(uid: string) : Promise<Bet[]> {
    var betList = new Array()
    const querySnapshot = await getDocs(collection(db, "bets"));
    querySnapshot.forEach((doc) => {
        console.log("Found bet!")
        if (doc.data().userID == uid) {
            console.log("bet is valid!")
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