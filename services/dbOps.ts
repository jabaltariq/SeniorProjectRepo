import { setDoc, doc, getDoc, getFirestore, onSnapshot, Timestamp } from "firebase/firestore";
import {APP} from "@/models/constants.ts";

const db = getFirestore(APP);

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