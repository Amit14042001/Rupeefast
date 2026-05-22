/**
 * RupeeFast — useNetworkStatus Hook
 *
 * Tracks network connectivity state and exposes connection type info.
 * Uses a dynamic import for NetInfo to avoid crashing if the module
 * isn't installed yet. Falls back gracefully.
 *
 * @example
 *   const { isConnected, connectionType } = useNetworkStatus();
 *   if (!isConnected) showOfflineBanner();
 */

import { useState, useEffect, useCallback } from 'react';

// ── Types ──

interface NetInfoState {
  isConnected: boolean | null;
  type: string;
  isInternetReachable: boolean | null;
}

export interface NetworkStatus {
  isConnected: boolean;
  connectionType: string;
  isMetered: boolean | null;
  refresh: () => void;
}

// ── Default state (assumes online) ──

const DEFAULT_STATE: NetInfoState = {
  isConnected: true,
  type: 'unknown',
  isInternetReachable: true,
};

// ═══════════════════════════════════════════════════
//  HOOK
// ═══════════════════════════════════════════════════

export function useNetworkStatus(): NetworkStatus {
  const [state, setState] = useState<NetInfoState>(DEFAULT_STATE);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    // Dynamically import NetInfo so the app doesn't crash if the dep is missing
    import('@react-native-community/netinfo')
      .then((NetInfo) => {
        // Initial fetch
        NetInfo.fetch().then(setState).catch(() => {});

        // Subscribe to changes
        unsubscribe = NetInfo.addEventListener((netState: any) => {
          setState({
            isConnected: netState.isConnected ?? true,
            type: netState.type ?? 'unknown',
            isInternetReachable: netState.isInternetReachable ?? null,
          });
        });
      })
      .catch(() => {
        // NetInfo not installed — keep default (assume online)
      });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const refresh = useCallback(() => {
    import('@react-native-community/netinfo')
      .then((NetInfo) => NetInfo.fetch().then(setState).catch(() => {}))
      .catch(() => {});
  }, []);

  return {
    isConnected: state.isConnected ?? true,
    connectionType: state.type ?? 'unknown',
    isMetered: state.isInternetReachable ?? null,
    refresh,
  };
}
