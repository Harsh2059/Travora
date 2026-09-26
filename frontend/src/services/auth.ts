import axios from 'axios';
import { API_BASE_URL } from '../store/journeyStore';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone_number?: string | null;
  whatsapp_phone?: string | null;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
}

const TOKEN_KEY = 'travora_token';
const USER_KEY = 'travora_user';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: UserProfile): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event('travora_auth_change'));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event('travora_auth_change'));
}

export function getStoredUserId(): string | null {
  const user = getStoredUser();
  return user ? user.id : null;
}

// ── Auth API Calls ─────────────────────────────────────────────────────────

export async function registerUser(payload: {
  name: string;
  email: string;
  password: string;
  phone_number?: string;
  whatsapp_phone?: string;
}): Promise<AuthResponse> {
  const res = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/register`, payload);
  setAuth(res.data.access_token, res.data.user);
  return res.data;
}

export async function loginUser(payload: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/login`, payload);
  setAuth(res.data.access_token, res.data.user);
  return res.data;
}

export async function fetchMe(): Promise<UserProfile> {
  const res = await axios.get<UserProfile>(`${API_BASE_URL}/auth/me`);
  const token = getStoredToken();
  if (token) {
    setAuth(token, res.data);
  }
  return res.data;
}

export async function updateUserProfile(payload: {
  name?: string;
  email?: string;
  phone_number?: string;
  whatsapp_phone?: string;
}): Promise<UserProfile> {
  const res = await axios.put<UserProfile>(`${API_BASE_URL}/users/me`, payload);
  const token = getStoredToken();
  if (token) {
    setAuth(token, res.data);
  }
  return res.data;
}

export function logoutUser(): void {
  clearAuth();
}
