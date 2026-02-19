const USERS_KEY = 'bethub_users';
const SESSION_KEY = 'bethub_session';

export interface User {
  email: string;
  password: string;
}

const useExpressApi = typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_EXPRESS === '1';

function getUsers(): User[] {
  try {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveUsers(users: User[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

async function apiAuth(endpoint: 'signup' | 'login', email: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/auth/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.success) setSession(email);
    return { success: !!data.success, error: data.error };
  } catch {
    return { success: false, error: 'Network error' };
  }
}

export async function signUp(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !password) {
    return { success: false, error: 'Email and password are required' };
  }
  if (password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters' };
  }
  if (useExpressApi) return apiAuth('signup', trimmed, password);
  const users = getUsers();
  if (users.some(u => u.email === trimmed)) {
    return { success: false, error: 'An account with this email already exists' };
  }
  users.push({ email: trimmed, password });
  saveUsers(users);
  setSession(trimmed);
  return { success: true };
}

export async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  const trimmed = email.trim().toLowerCase();
  if (useExpressApi) return apiAuth('login', trimmed, password);
  const users = getUsers();
  const user = users.find(u => u.email === trimmed);
  if (!user || user.password !== password) {
    return { success: false, error: 'Invalid email or password' };
  }
  setSession(trimmed);
  return { success: true };
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
