import React from 'react';
import { toast } from 'sonner';
import { signInWithGoogle } from '@/app/lib/auth';
import { isSupabaseConfigured } from '@/app/lib/supabase';

const GoogleMark: React.FC = () => (
  <svg viewBox="0 0 18 18" aria-hidden className="h-[18px] w-[18px]">
    <path
      fill="#4285F4"
      d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
    />
    <path
      fill="#34A853"
      d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
    />
    <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
    <path
      fill="#EA4335"
      d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
    />
  </svg>
);

/** Primary sign-in control: Google account, no password. */
export const GoogleButton: React.FC<{ redirectPath: string; label?: string }> = ({
  redirectPath,
  label = 'Continue with Google',
}) => {
  const [busy, setBusy] = React.useState(false);

  const start = async () => {
    if (!isSupabaseConfigured()) {
      toast.error('Sign-in is not configured yet.');
      return;
    }
    setBusy(true);
    try {
      await signInWithGoogle(redirectPath);
      // On success the browser navigates to Google, so `busy` stays true until then.
    } catch (cause) {
      setBusy(false);
      toast.error('Could not start Google sign-in', {
        description: cause instanceof Error ? cause.message : undefined,
      });
    }
  };

  return (
    <button
      type="button"
      onClick={start}
      disabled={busy}
      className="flex w-full items-center justify-center gap-3 rounded-lg border border-border-color bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-violet hover:bg-portal-tint disabled:cursor-not-allowed disabled:opacity-60"
    >
      <GoogleMark />
      {busy ? 'Opening Google…' : label}
    </button>
  );
};
