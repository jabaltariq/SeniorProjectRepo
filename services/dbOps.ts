import { setDoc, doc, getDoc, getFirestore, onSnapshot } from "firebase/firestore";
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
    });
}
export async function changeUserMoney(uid : string, amount : number) {
    const newMoney = ((await getUserMoney(uid)) + amount);
    await setDoc(doc(db, "userInfo", uid), {
        money: newMoney
    });
}

export function listenForChange(uid : string) {
    const unsub = onSnapshot(doc(db, "userInfo", uid), (doc) => {
        const source = doc.metadata.hasPendingWrites ? "Local" : "Server";
        console.log(source, " data: ", doc.data());
        localStorage.setItem("userMoney", doc.data().money)
    })
}