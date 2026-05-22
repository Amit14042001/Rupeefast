/**
 * RupeeFast — useDebounce Hook
 *
 * Returns a debounced version of the value that only updates after
 * the specified delay has passed since the last change.
 *
 * @example
 *   const debouncedSearch = useDebounce(searchText, 300);
 *   useEffect(() => { apiSearch(debouncedSearch); }, [debouncedSearch]);
 *
 *   // With callback
 *   const [save] = useDebounce(() => apiSave(data), 1000);
 *   save(); // will be debounced
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ── Value debounce ──

/**
 * Debounces a value. The returned value updates only after
 * `delay` ms of inactivity.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// ── Callback debounce ──

/**
 * Returns a debounced version of the callback.
 * The callback is only called after the specified delay
 * since the last invocation.
 *
 * @example
 *   const debouncedSave = useDebouncedCallback(() => save(), 500);
 *   debouncedSave(); // Will only call save() after 500ms of inactivity
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300,
): (...args: Parameters<T>) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay],
  );
}

// ── Leading edge debounce ──

/**
 * Like useDebouncedCallback but fires on the leading edge,
 * then suppresses subsequent calls within the delay window.
 *
 * @example
 *   const handlePress = useThrottledCallback(() => submit(), 1000);
 *   // Each press within 1s after the first is ignored
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300,
): (...args: Parameters<T>) => void {
  const lastCall = useRef(0);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall.current >= delay) {
        lastCall.current = now;
        callbackRef.current(...args);
      }
    },
    [delay],
  );
}
