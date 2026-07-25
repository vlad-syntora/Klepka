import React from 'react';
import { loadPortalSnapshot } from '@/app/lib/portal-api';
import type { PortalSnapshot } from '@/app/lib/portal-types';

interface PortalDataState {
  snapshot: PortalSnapshot | null;
  loading: boolean;
  error: string | null;
  /** Re-fetches everything; call after any action that changes server state. */
  reload: () => Promise<void>;
}

export const PortalDataContext = React.createContext<PortalDataState | null>(null);

export function usePortalDataState(accountId: string | null): PortalDataState {
  const [snapshot, setSnapshot] = React.useState<PortalSnapshot | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!accountId) {
      setSnapshot(null);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const next = await loadPortalSnapshot(accountId);
      setSnapshot(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your portal data.');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  React.useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  return React.useMemo(
    () => ({ snapshot, loading, error, reload: load }),
    [snapshot, loading, error, load],
  );
}

export function usePortalData(): PortalDataState {
  const context = React.useContext(PortalDataContext);
  if (!context) {
    throw new Error('usePortalData must be used inside the portal layout');
  }
  return context;
}
