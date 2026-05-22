/**
 * RupeeFast — Auth Store
 * Zustand store for authentication state with AsyncStorage persistence.
 *
 * State:
 *   token     — JWT or null
 *   user      — Current user profile or null
 *   isLoading — True during initial token hydration from storage
 *
 * Actions:
 *   login(token, user)       — Set credentials + persist token
 *   logout()                 — Clear credentials + remove token
 *   setUser(user)            — Update user without changing token
 *   hydrate()                — (Optional) Load token from storage on app start
 */

import { create } from 'zustand';
import type { User } from '../types';

// ── Storage helpers (AsyncStorage-compatible abstraction) ──
// For now uses a simple in-memory/MMKV approach.
// In production, swap with expo-secure-store for sensitive data.

const TOKEN_KEY = 'rupeefast_token';
const USER_KEY = 'rupeefast_user';

// Simple synchronous storage wrapper.
// On native, you'd use expo-secure-store or @react-native-async-storage/async-storage.
// For now we use a module-level map so it works without extra native modules.
const storage: Record<string, string> = {};

try {
  // Attempt to load persisted token on module init (works on web, fails gracefully on native)
  const storedToken =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem(TOKEN_KEY)
      : null;
  if (storedToken) storage[TOKEN_KEY] = storedToken;

  const storedUser =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem(USER_KEY)
      : null;
  if (storedUser) storage[USER_KEY] = storedUser;
} catch {
  // Not in a browser environment — will need AsyncStorage
}

function setStorageItem(key: string, value: string) {
  storage[key] = value;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // Ignore — will use memory fallback
  }
}

function removeStorageItem(key: string) {
  if (key in storage) delete storage[key];
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore
  }
}

function getStorageItem(key: string): string | null {
  if (storage[key]) return storage[key];
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // Ignore
  }
  return null;
}

// ── Auth Store Interface ──

export interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;

  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: getStorageItem(TOKEN_KEY),
  user: (() => {
    try {
      const raw = getStorageItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })(),
  isLoading: false,

  /**
   * Store token and user after successful login.
   * Token is persisted to storage; user is cached as JSON.
   */
  login: (token: string, user: User) => {
    setStorageItem(TOKEN_KEY, token);
    setStorageItem(USER_KEY, JSON.stringify(user));
    set({ token, user, isLoading: false });
  },

  /**
   * Clear all auth state and remove persisted data.
   */
  logout: () => {
    removeStorageItem(TOKEN_KEY);
    removeStorageItem(USER_KEY);
    set({ token: null, user: null, isLoading: false });
  },

  /**
   * Update the current user (e.g., after profile edit) without changing token.
   */
  setUser: (user: User) => {
    setStorageItem(USER_KEY, JSON.stringify(user));
    set({ user });
  },

  /**
   * Re-hydrate auth state from storage (used on app launch).
   */
  hydrate: () => {
    const token = getStorageItem(TOKEN_KEY);
    const userRaw = getStorageItem(USER_KEY);
    let user: User | null = null;

    if (userRaw) {
      try {
        user = JSON.parse(userRaw);
      } catch {
        removeStorageItem(USER_KEY);
      }
    }

    set({ token, user, isLoading: false });
  },
}));
