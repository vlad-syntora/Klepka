import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { SEOHead } from '@/app/components/SEOHead';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import { PortalSpinner } from '@/app/components/portal/PortalUi';
import { GoogleButton } from '@/app/components/portal/GoogleButton';
import { EmailLinkForm } from '@/app/components/portal/EmailLinkForm';
import logoPurple from '@/assets/85bd7ec43f69e1c0fc0ed1f1121c7466d87fd6c5.png';

export const PortalLogin: React.FC = () => {
  const { signedIn, loading, isInternal } = usePortalUser();

  if (loading) return <PortalSpinner />;
  if (signedIn) return <Navigate to={isInternal ? '/admin/portal/accounts' : '/portal'} replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-off-white px-4 py-10">
      <SEOHead title="Client Portal Sign In" description="Klepka client portal" noindex />

      <div className="w-full max-w-sm rounded-xl border border-border-color bg-card p-8 shadow-sm">
        <img src={logoPurple} alt="KLEPKA" className="mx-auto mb-6 h-10 w-auto" />
        <h1 className="mb-1 text-center text-xl font-semibold text-violet">Client Portal</h1>
        <p className="mb-6 text-center text-sm text-grey">
          Offers, contracts, calls and project status — all in one place.
        </p>

        <GoogleButton redirectPath="/portal" />

        <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wide text-grey">
          <span className="h-px flex-1 bg-border-color" />
          or
          <span className="h-px flex-1 bg-border-color" />
        </div>

        <EmailLinkForm redirectPath="/portal" />

        <p className="mt-3 text-center text-xs text-grey">
          Either way, use the address your Klepka contact invited — there is no password to remember.
        </p>

        <p className="mt-6 text-center text-xs text-grey">
          Need access?{' '}
          <Link to="/" className="text-violet hover:underline">
            Contact your Klepka team
          </Link>
        </p>
      </div>
    </div>
  );
};
