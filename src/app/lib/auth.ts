import { getSupabase } from '@/app/lib/supabase';

/**
 * Sign-in for both the client portal and the admin console.
 *
 * Neither method issues a password: whoever signs in gets an auth identity, and
 * `portal_bootstrap_user()` links it to a `portal_users` row by email address. No matching
 * row means no access — the guards show "no portal access yet" rather than an empty portal.
 * So inviting someone in the admin console is the whole provisioning step, for both methods.
 */
export async function signInWithGoogle(redirectPath: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}${redirectPath}`,
      // Always show the account chooser — people often have several Google accounts open.
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw new Error(error.message);
}

/**
 * Passwordless sign-in for people without a Google account: Supabase emails a one-time link.
 *
 * Requires custom SMTP on the Supabase project — the built-in sender only delivers to project
 * members and is rate-limited to a handful of messages per hour, so client-facing links silently
 * never arrive without it.
 */
export async function sendSignInLink(email: string, redirectPath: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: `${window.location.origin}${redirectPath}`,
      // Invited clients have no auth user until their first sign-in, so the link has to create one.
      shouldCreateUser: true,
    },
  });
  if (error) throw new Error(error.message);
}
