
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  getBets, getFriends,
  getLastDaily,
  getUserMoney,
  normalizeUserInfoDoc,
  resetRatio,
  setNewDaily,
  setUserMoney,
  setUserName
} from "@/services/dbOps.ts";
import {APP} from "@/models/constants.ts";
import {Bet, Friend} from "@/models";


const SESSION_KEY = 'bethub_session';
let userEmail = '';
let userMoney = 0;
let userId = '';
let dailyBonusAvailable = "true";
export let betList: Bet[] = [];

export let friendsList : Friend[] = [];

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
    return { success: false, error: error?.message ?? 'Sign up failed' };
  }
}

export async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  const trimmed = email.trim().toLowerCase();

  const auth = getAuth(APP);
  try {
    const userCredential = await signInWithEmailAndPassword(auth, trimmed, password);
    userEmail = (userCredential.user.email ?? trimmed).toLowerCase();
    userId = userCredential.user.uid;

    // Auto-heal malformed legacy userInfo fields before reading session data.
    const normalized = await normalizeUserInfoDoc(userCredential.user.uid);
    userMoney = normalized?.money ?? (await getUserMoney(userCredential.user.uid)) ?? 0;

    const lastClaim = await getLastDaily(userCredential.user.uid);
    const now = new Date(Date.now());
    if (lastClaim) {
      const last = lastClaim.toDate();
      if (last.getDate() === now.getDate() && last.getMonth() === now.getMonth() && last.getFullYear() === now.getFullYear()) {
        dailyBonusAvailable = "false";
      } else {
        dailyBonusAvailable = "true";
      }
    } else {
      dailyBonusAvailable = "true";
    }
    console.log("Created user with the following credentials:");
    console.log("ID: " + userId);
    console.log("Email: " + userEmail);
    console.log("Total money: " + userMoney);
    console.log("Daily available: " + dailyBonusAvailable);

    betList = await getBets(userId);

    friendsList = await getFriends(userId);
    console.log("Bets added from database: " + betList.length);

    setSession(userEmail);
    return { success : true };
  } catch (error: any) {
    return { success: false, error: error?.message ?? 'Login failed' };
  }
}

export function logout(): void {
  const auth = getAuth(APP);
  void signOut(auth).catch(() => undefined);

  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem("userEmail");
  localStorage.removeItem("userMoney");
  localStorage.removeItem("uid");
  localStorage.removeItem("hasDailyBonus");

  userEmail = '';
  userMoney = 0;
  userId = '';
  dailyBonusAvailable = "true";
  betList = [];
}

export function getSession(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

function setSession(email: string) {
  localStorage.setItem(SESSION_KEY, email);
  localStorage.setItem("userEmail", email);
  localStorage.setItem("userMoney", String(userMoney));
  localStorage.setItem("uid", userId);
  localStorage.setItem("hasDailyBonus", dailyBonusAvailable);
}