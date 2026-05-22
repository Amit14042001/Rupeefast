/**
 * RupeeFast — useAppState Hook
 *
 * Tracks whether the app is in the foreground or background.
 * Useful for refreshing data on app resume, pausing animations, etc.
 *
 * @example
 *   const appState = useAppState();
 *   useEffect(() => {
 *     if (appState === 'active') refreshData();
 *   }, [appState]);
 */

import { useState, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

// ── Types ──

export interface AppStateInfo {
  /** Current app state: 'active' | 'background' | 'inactive' */
  state: AppStateStatus;
  /** Whether the app is currently visible (foreground) */
  isForeground: boolean;
  /** Whether the app came from background (resets after read) */
  didComeFromBackground: boolean;
}

// ═══════════════════════════════════════════════════
//  HOOK
// ═══════════════════════════════════════════════════

export function useAppState(): AppStateInfo {
  const [state, setState] = useState<AppStateStatus>(AppState.currentState);
  const [cameFromBg, setCameFromBg] = useState(false);

  useEffect(() => {
    let previousState = AppState.currentState;

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (
        (previousState === 'inactive' || previousState === 'background') &&
        nextState === 'active'
      ) {
        setCameFromBg(true);
      }
      previousState = nextState;
      setState(nextState);
    });

    return () => subscription.remove();
  }, []);

  // Reset flag after a microtask to allow consumers to read it
  useEffect(() => {
    if (cameFromBg) {
      const timer = setTimeout(() => setCameFromBg(false), 0);
      return () => clearTimeout(timer);
    }
  }, [cameFromBg]);

  return {
    state,
    isForeground: state === 'active',
    didComeFromBackground: cameFromBg,
  };
}
