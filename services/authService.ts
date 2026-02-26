import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword} from "firebase/auth";
import {getUserMoney, setUserMoney} from "@/services/dbOps.ts";
import {APP} from "@/models/constants.ts";
const USERS_KEY = 'bethub_users';
const SESSION_KEY = 'bethub_session';
var userEmail : string;
var userMoney : number;
var userId : string;


export interface User {
  email: string;
  money: number;
  claimTime : string;
}

export async function signUp(email: string, password: string): Promise<{ success: boolean; error?: string }> {
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
    setSession(trimmed);
    await setUserMoney(user.uid, 10000.00)
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
    userMoney = (await getUserMoney(userCredential.user.uid))
    userId = userCredential.user.uid
    setSession(trimmed);
    return { success : true };
  }
  catch (error: any) {

  }
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function getSession(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

function setSession(email: string) {
  localStorage.setItem(SESSION_KEY, email);
  localStorage.setItem("userEmail", userEmail);
  localStorage.setItem("userMoney", String(userMoney))
  localStorage.setItem("uid", userId);
}