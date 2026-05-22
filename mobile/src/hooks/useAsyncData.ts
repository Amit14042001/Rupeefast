/**
 * RupeeFast — Shared Async Data Hooks
 *
 * Standardises the fetch → loading → fallback pattern used across all screens.
 *
 * Usage:
 *   const { data, loading } = useAsyncData(() => fetchDashboard(), FALLBACK);
 *   const { data } = useTimedAsyncData(() => apiFetch('/leaderboard'), FALLBACK, 3000);
 */

import { useEffect, useState, useCallback, useRef } from 'react';

// ── useMountedRef ──

/**
 * Returns a ref that stays `true` while the component is mounted.
 * Set to `false` on unmount.  Useful in then/catch chains to avoid
 * state updates after the component has unmounted.
 */
export function useMountedRef() {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  return mountedRef;
}

// ── useAsyncData ──

/**
 * Generic hook that fetches data on mount, manages a `loading` flag,
 * and falls back to `fallback` when the fetcher returns null or throws.
 *
 * @param fetcher  Async function returning data or null on failure
 * @param fallback  Value to use when data is unavailable
 * @returns  { data, loading, refresh }
 *
 * @example
 *   const { data, loading } = useAsyncData(
 *     () => fetchDashboard() as Promise<AgentDashboardData | null>,
 *     FALLBACK_DATA,
 *   );
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T | null>,
  fallback: T,
): { data: T; loading: boolean; refresh: () => void } {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const execute = useCallback(() => {
    setLoading(true);
    fetcherRef.current().then((result) => {
      if (mounted.current) {
        if (result !== null && result !== undefined) {
          setData(result);
        }
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    mounted.current = true;
    execute();
    return () => { mounted.current = false; };
  }, [execute]);

  return { data, loading, refresh: execute };
}

// ── useTimedAsyncData ──

/**
 * Like `useAsyncData` but with a timeout safety net.  If the fetcher
 * doesn't resolve within `timeoutMs` milliseconds the loading flag is
 * released and `fallback` is used.
 *
 * Useful for endpoints that may not exist (e.g. mock-only feature flags).
 *
 * @example
 *   const { data, loading } = useTimedAsyncData(
 *     () => apiFetch<LeaderboardResponse>('/leaderboard')
 *       .then(r => r.success ? r.data.top_agents : null),
 *     FALLBACK_AGENTS,
 *     3000,
 *   );
 */
export function useTimedAsyncData<T>(
  fetcher: () => Promise<T | null>,
  fallback: T,
  timeoutMs: number = 3000,
): { data: T; loading: boolean; refresh: () => void } {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const execute = useCallback(() => {
    setLoading(true);
    let finished = false;

    const timer = setTimeout(() => {
      if (mounted.current) {
        finished = true;
        setData(fallback);
        setLoading(false);
      }
    }, timeoutMs);

    fetcherRef.current().then((result) => {
      if (mounted.current && !finished) {
        clearTimeout(timer);
        if (result !== null && result !== undefined) {
          setData(result);
        } else {
          setData(fallback);
        }
        setLoading(false);
      }
    });

    // Return a cleanup (unused here but keeps symmetry)
    return () => clearTimeout(timer);
  }, [timeoutMs, fallback]);

  useEffect(() => {
    mounted.current = true;
    execute();
    return () => { mounted.current = false; };
  }, [execute]);

  return { data, loading, refresh: execute };
}
