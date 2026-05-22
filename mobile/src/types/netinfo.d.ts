/**
 * Type declarations for @react-native-community/netinfo
 *
 * This module may not be installed yet (it's optional for offline detection).
 * TypeScript resolves the import at compile time, so we provide minimal types.
 */
declare module '@react-native-community/netinfo' {
  export interface NetInfoState {
    type: string;
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
    details?: any;
  }

  export function fetch(): Promise<NetInfoState>;

  export function addEventListener(
    handler: (state: NetInfoState) => void,
  ): () => void;

  const NetInfo: {
    fetch: typeof fetch;
    addEventListener: typeof addEventListener;
  };

  export default NetInfo;
}
