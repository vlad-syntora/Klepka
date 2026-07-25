import React from 'react';
import { toast } from 'sonner';
import { MailCheck } from 'lucide-react';
import { sendSignInLink } from '@/app/lib/auth';
import { isSupabaseConfigured } from '@/app/lib/supabase';
import { Field, PortalButton, inputClass } from './PortalUi';

/** Passwordless email sign-in: request a one-time link, then wait for it. */
export const EmailLinkForm: React.FC<{ redirectPath: string }> = ({ redirectPath }) => {
  const [email, setEmail] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [sentTo, setSentTo] = React.useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isSupabaseConfigured()) {
      toast.error('Sign-in is not configured yet.');
      return;
    }

    setBusy(true);
    try {
      await sendSignInLink(email, redirectPath);
      setSentTo(email.trim().toLowerCase());
    } catch (cause) {
      toast.error('Could not send the link', {
        description: cause instanceof Error ? cause.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <div className="rounded-lg bg-portal-tint px-4 py-4 text-sm text-violet">
        <div className="flex items-center gap-2 font-medium">
          <MailCheck className="h-4 w-4" />
          Check your inbox
        </div>
        <p className="mt-1.5 leading-relaxed">
          We sent a sign-in link to <strong>{sentTo}</strong>. It works once and expires in an hour — open it on this
          device. Nothing there? Check spam, then try again.
        </p>
        <button
          type="button"
          onClick={() => setSentTo(null)}
          className="mt-2 text-xs underline underline-offset-2 hover:opacity-80"
        >
          Use a different address
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Work email">
        <input
          type="email"
          className={inputClass}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
          required
        />
      </Field>
      <PortalButton type="submit" variant="secondary" disabled={busy} className="w-full">
        {busy ? 'Sending…' : 'Email me a sign-in link'}
      </PortalButton>
    </form>
  );
};
