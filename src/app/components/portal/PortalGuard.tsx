import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuthSession } from '@/app/hooks/use-auth-session';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import { getSupabase } from '@/app/lib/supabase';
import { ErrorNote, PortalButton, PortalCard, PortalSpinner } from './PortalUi';

const Centered: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex min-h-screen items-center justify-center bg-off-white px-4">
    <div className="w-full max-w-md">{children}</div>
  </div>
);

/**
 * Shown when the signed-in identity has no matching `portal_users` row. With Google sign-in the
 * usual cause is picking the wrong account, so the address actually used is spelled out here.
 */
const NoAccess: React.FC<{ title: string; message: string }> = ({ title, message }) => {
  const { session } = useAuthSession();
  const email = session?.user.email;

  return (
    <Centered>
      <PortalCard title={title}>
        <p className="text-sm text-grey">{message}</p>
        <p className="mt-3 text-sm text-grey">
          To request access to the portal, please contact Klepka at{' '}
          <a href="mailto:contact@klepka.solutions" className="font-medium text-violet hover:underline">
            contact@klepka.solutions
          </a>
          .
        </p>
        {email && (
          <p className="mt-3 rounded-lg bg-portal-tint px-3 py-2 text-sm text-violet">
            You are signed in as <strong>{email}</strong>. If your invite went to a different
            address, sign out and pick that Google account instead.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="mailto:contact@klepka.solutions">
            <PortalButton>Email Klepka</PortalButton>
          </a>
          <PortalButton
            variant="secondary"
            onClick={async () => {
              await getSupabase().auth.signOut();
              window.location.assign('/portal/login');
            }}
          >
            Sign out
          </PortalButton>
          <Link to="/">
            <PortalButton variant="ghost">Back to klepka.solutions</PortalButton>
          </Link>
        </div>
      </PortalCard>
    </Centered>
  );
};

/** Client-side portal: requires a portal identity that belongs to an account. */
export const PortalGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, error, signedIn, isInternal } = usePortalUser();
  const location = useLocation();

  if (loading) return <PortalSpinner label="Signing you in…" />;
  if (!signedIn) return <Navigate to="/portal/login" replace state={{ from: location.pathname }} />;
  if (error) {
    return (
      <Centered>
        <ErrorNote>{error}</ErrorNote>
      </Centered>
    );
  }
  if (!user) {
    return (
      <NoAccess
        title="No portal access yet"
        message="This account is signed in but has not been invited to the Klepka client portal. Ask your Klepka contact to send an invite."
      />
    );
  }
  if (isInternal) return <Navigate to="/admin/portal/accounts" replace />;
  if (!user.account_id) {
    return <NoAccess title="No account linked" message="Your portal profile is not linked to a client account yet." />;
  }

  return <>{children}</>;
};

/** Admin console: requires a Klepka-internal role. */
export const InternalGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, error, signedIn, isInternal } = usePortalUser();
  const location = useLocation();

  if (loading) return <PortalSpinner label="Checking your access…" />;
  if (!signedIn) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  if (error) {
    return (
      <Centered>
        <ErrorNote>{error}</ErrorNote>
      </Centered>
    );
  }
  if (!isInternal) {
    // A client user who lands on an admin URL goes to their own portal instead.
    return user?.account_id ? (
      <Navigate to="/portal" replace />
    ) : (
      <NoAccess title="Klepka staff only" message="This area is limited to Klepka team members." />
    );
  }

  return <>{children}</>;
};
