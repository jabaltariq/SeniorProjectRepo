import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword} from "firebase/auth";
import {
  getBets,
  getLastDaily,
  getUserMoney,
  resetRatio,
  setNewDaily,
  setUserMoney,
  setUserName
} from "@/services/dbOps.ts";
import { APP } from "@/models/constants.ts";
import { Bet } from "@/models";
const USERS_KEY = 'bethub_users';
const SESSION_KEY = 'bethub_session';
var userEmail : string;
var userMoney : number;
var userId : string;
var dailyBonusAvailable : string;
export var betList : Bet[]

export interface User {
  email: string;
  money: number;
  claimTime : string;
}

export async function signUp(email: string, password: string, username : string): Promise<{ success: boolean; error?: string }> {
  const trimmed = email.trim().toLowerCase();

  if (!trimmed || !password) {
    return { success: false, error: 'Email and password are required' };
  }
  if (password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters' };
  }

  const auth = getAuth(APP);
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, trimmed, password);
    const user = userCredential.user;

    await setUserName(user.uid, username)
    await setUserMoney(user.uid, 10000.00)
    await setNewDaily(user.uid)
    await resetRatio(user.uid)
    userEmail = userCredential.user.email
    userMoney = (await getUserMoney(userCredential.user.uid))
    userId = userCredential.user.uid
    console.log("Logged in user with the following credentials:")
    console.log("ID: " + userId)
    console.log("Email: " + userEmail);
    console.log("Total money: " + userMoney);
    setSession(trimmed);
    return { success : true };
  }
  catch (error: any) {

  }
}

export async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  const trimmed = email.trim().toLowerCase();

  const auth = getAuth(APP);
  try {
    const userCredential = await signInWithEmailAndPassword(auth, trimmed, password)
    userEmail = userCredential.user.email
    userId = userCredential.user.uid
    userMoney = (await getUserMoney(userCredential.user.uid))

    const last = (await getLastDaily(userCredential.user.uid)).toDate();
    const now = new Date(Date.now());
    console.log(last.toString())
    console.log(now.toString())
    if (last.getDay() == now.getDay()) {
      dailyBonusAvailable = "false";
    }
    else {
      dailyBonusAvailable = "true";
    }
    console.log("Created user with the following credentials:")
    console.log("ID: " + userId)
    console.log("Email: " + userEmail);
    console.log("Total money: " + userMoney);
    console.log("Daily available: " + dailyBonusAvailable)

    betList = await getBets(userId)

    console.log("Bets added from database: " + betList.length)

    setSession(userEmail);
    return { success : true };
  }
  catch (error: any) {
    return error.toString()
  }
}

export function logout(): void {
  localStorage.removeItem("userEmail");
}

export function getSession(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

function setSession(email: string) {
  localStorage.setItem(SESSION_KEY, email);
  localStorage.setItem("userEmail", email);
  localStorage.setItem("userMoney", String(userMoney))
  localStorage.setItem("uid", userId);
  localStorage.setItem("hasDailyBonus", dailyBonusAvailable)
}