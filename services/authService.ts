import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import {setUserMoney} from "@/services/dbOps.ts";
import {APP} from "@/models/constants.ts";
const USERS_KEY = 'bethub_users';
const SESSION_KEY = 'bethub_session';

/*
const firebaseConfig = {
  apiKey: import.meta.env.FIREBASE_API_KEY,
  authDomain: import.meta.env.AUTH_DOMAIN,
  projectId: import.meta.env.PROJECT_ID,
  storageBucket: import.meta.env.STORAGE_BUCKET,
  messagingSenderId: import.meta.env.MESSAGING_SENDER_ID,
  appId: import.meta.env.APP_ID
  apiKey: "AIzaSyCcgJVGV0L95RkcRZ-jqzFAepr3N73wewQ",
  authDomain: "seniorproject-ce9fe.firebaseapp.com",
  projectId: "seniorproject-ce9fe",
  storageBucket: "seniorproject-ce9fe.firebasestorage.app",
  messagingSenderId: "1007996245994",
  appId: "1:1007996245994:web:5d168e3055cb61a14d8493",
  measurementId: "G-81E1JLPRLN"
}

const app = initializeApp(firebaseConfig)
*/
export interface User {
  email: string;
  password: string;
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
    const user = userCredential.user;
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
}