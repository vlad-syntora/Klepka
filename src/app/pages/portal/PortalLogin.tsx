import React from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { SEOHead } from '@/app/components/SEOHead';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import { getSupabase, isSupabaseConfigured } from '@/app/lib/supabase';
import { Field, PortalButton, PortalSpinner, inputClass } from '@/app/components/portal/PortalUi';
import { GoogleButton } from '@/app/components/portal/GoogleButton';
import { EmailLinkForm } from '@/app/components/portal/EmailLinkForm';
import logoPurple from '@/assets/85bd7ec43f69e1c0fc0ed1f1121c7466d87fd6c5.png';

export const PortalLogin: React.FC = () => {
  const navigate = useNavigate();
  const { signedIn, loading, isInternal } = usePortalUser();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);
  const [showPasswordForm, setShowPasswordForm] = React.useState(false);

  if (loading) return <PortalSpinner />;
  if (signedIn) return <Navigate to={isInternal ? '/admin/portal/accounts' : '/portal'} replace />;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isSupabaseConfigured()) {
      toast.error('The portal is not configured yet.');
      return;
    }

    setSubmitting(true);
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);

    if (error) {
      toast.error('Sign in failed', { description: error.message });
      return;
    }
    navigate('/portal');
  };

  const handleReset = async () => {
    if (!isSupabaseConfigured()) {
      toast.error('The portal is not configured yet.');
      return;
    }
    if (!email.trim()) {
      toast.error('Enter your email first, then request a reset link.');
      return;
    }
    setResetting(true);
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/portal`,
    });
    setResetting(false);
    if (error) {
      toast.error('Could not send the reset link', { description: error.message });
      return;
    }
    toast.success('Check your inbox for a password reset link.');
  };

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

        {showPasswordForm ? (
          <>
            <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wide text-grey">
              <span className="h-px flex-1 bg-border-color" />
              with a password
              <span className="h-px flex-1 bg-border-color" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Email">
                <input
                  type="email"
                  className={inputClass}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </Field>
              <Field label="Password">
                <input
                  type="password"
                  className={inputClass}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </Field>
              <PortalButton type="submit" disabled={submitting} className="w-full">
                {submitting ? 'Signing in…' : 'Sign in'}
              </PortalButton>
            </form>

            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className="mt-4 w-full text-center text-xs text-grey underline-offset-2 hover:text-violet hover:underline disabled:opacity-50"
            >
              {resetting ? 'Sending…' : 'Forgot your password?'}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowPasswordForm(true)}
            className="mt-5 w-full text-center text-xs text-grey underline-offset-2 hover:text-violet hover:underline"
          >
            I have a password
          </button>
        )}

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
