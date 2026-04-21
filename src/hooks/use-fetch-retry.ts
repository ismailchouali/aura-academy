'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseFetchRetryOptions<T> {
  url: string;
  maxRetries?: number;
  intervalMs?: number;
  enabled?: boolean;
}

interface UseFetchRetryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  retrying: boolean;
  retryCount: number;
  refetch: () => void;
}

export function useFetchRetry<T = unknown>({
  url,
  maxRetries = 20,
  intervalMs = 3000,
  enabled = true,
}: UseFetchRetryOptions<T>): UseFetchRetryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const retriesRef = useRef(0);

  const fetchOnce = useCallback(async (signal: AbortSignal) => {
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json as T;
    } catch (err) {
      if (signal.aborted) return null;
      throw err;
    }
  }, [url]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    retriesRef.current = 0;

    async function doFetch() {
      // Abort previous request
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      try {
        const result = await fetchOnce(abortRef.current.signal);
        if (cancelled) return;
        if (result !== null) {
          setData(result);
          setError(null);
          setLoading(false);
          setRetrying(false);
          setRetryCount(0);
          return true;
        }
      } catch {
        if (cancelled) return;
      }
      return false;
    }

    async function fetchWithRetry() {
      setLoading(true);
      const success = await doFetch();
      if (cancelled) return;

      if (success) return;

      // First attempt failed, start retrying
      setLoading(false);
      setRetrying(true);
      setError('connection');

      const interval = setInterval(async () => {
        if (cancelled) return;
        retriesRef.current++;
        setRetryCount(retriesRef.current);

        const ok = await doFetch();
        if (cancelled) return;

        if (ok) {
          clearInterval(interval);
        } else if (retriesRef.current >= maxRetries) {
          clearInterval(interval);
          setRetrying(false);
          setError('failed');
        }
      }, intervalMs);
    }

    fetchWithRetry();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [url, maxRetries, intervalMs, enabled, fetchOnce]);

  const refetch = useCallback(() => {
    retriesRef.current = 0;
    setRetryCount(0);
    setError(null);
    setLoading(true);
    setRetrying(false);

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    fetchOnce(abortRef.current.signal).then((result) => {
      if (result !== null) {
        setData(result);
        setError(null);
        setRetrying(false);
        setRetryCount(0);
      } else {
        setLoading(false);
        setRetrying(true);
        setError('connection');
      }
    }).catch(() => {
      setLoading(false);
      setRetrying(true);
      setError('connection');
    });
  }, [fetchOnce]);

  return { data, loading, error, retrying, retryCount, refetch };
}
