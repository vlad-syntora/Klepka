import React from 'react';
import { useAuthSession } from '@/app/hooks/use-auth-session';
import { bootstrapPortalUser } from '@/app/lib/portal-api';
import { isInternalRole, type PortalUser } from '@/app/lib/portal-types';

interface PortalUserState {
  /** null once loading finishes = signed in, but never invited to the portal. */
  user: PortalUser | null;
  loading: boolean;
  error: string | null;
  isInternal: boolean;
  isAdmin: boolean;
  signedIn: boolean;
  refresh: () => void;
}

export const PortalUserContext = React.createContext<PortalUserState | null>(null);

export function usePortalUserState(): PortalUserState {
  const { session, loading: sessionLoading } = useAuthSession();
  const [user, setUser] = React.useState<PortalUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);

  const authUserId = session?.user.id ?? null;

  React.useEffect(() => {
    if (sessionLoading) return;

    if (!authUserId) {
      setUser(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    bootstrapPortalUser()
      .then((value) => {
        if (cancelled) return;
        setUser(value);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setUser(null);
        setError(cause instanceof Error ? cause.message : 'Could not load your portal profile.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authUserId, sessionLoading, nonce]);

  return React.useMemo(
    () => ({
      user,
      loading: sessionLoading || loading,
      error,
      isInternal: user ? isInternalRole(user.role) : false,
      isAdmin: user?.role === 'portal_admin',
      signedIn: Boolean(authUserId),
      refresh: () => setNonce((value) => value + 1),
    }),
    [user, sessionLoading, loading, error, authUserId],
  );
}

export function usePortalUser(): PortalUserState {
  const context = React.useContext(PortalUserContext);
  if (!context) {
    throw new Error('usePortalUser must be used inside a PortalUserProvider');
  }
  return context;
}
