import React from 'react';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** Patch the cached data in place (optimistic updates) without a network round-trip. */
  mutate: (updater: (previous: T | null) => T | null) => void;
}

/**
 * Small fetch-on-mount helper for the admin console's per-tab loads. The loader is read from a
 * ref so callers can pass an inline closure; re-fetching is driven by `deps` alone.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: React.DependencyList): AsyncState<T> {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);

  const loaderRef = React.useRef(loader);
  loaderRef.current = loader;

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);

    loaderRef
      .current()
      .then((value) => {
        if (cancelled) return;
        setData(value);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'Something went wrong.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, ...deps]);

  const reload = React.useCallback(async () => {
    setNonce((value) => value + 1);
  }, []);

  const mutate = React.useCallback((updater: (previous: T | null) => T | null) => {
    setData((previous) => updater(previous));
  }, []);

  return { data, loading, error, reload, mutate };
}
