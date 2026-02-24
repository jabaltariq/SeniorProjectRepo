import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { collection, getDocs, setDoc, doc, getDoc } from "firebase/firestore";
import {APP} from "@/models/constants.ts";

/*
const firebaseConfig = {
    apiKey: "AIzaSyCcgJVGV0L95RkcRZ-jqzFAepr3N73wewQ",
    authDomain: "seniorproject-ce9fe.firebaseapp.com",
    projectId: "seniorproject-ce9fe",
    storageBucket: "seniorproject-ce9fe.firebasestorage.app",
    messagingSenderId: "1007996245994",
    appId: "1:1007996245994:web:5d168e3055cb61a14d8493",
    measurementId: "G-81E1JLPRLN"
};

const app = initializeApp(firebaseConfig);*/

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