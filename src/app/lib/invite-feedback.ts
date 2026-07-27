import { toast } from 'sonner';
import type { InviteResult } from '@/app/lib/portal-admin-api';

/**
 * Shows the outcome of an invite. Whether or not the email was delivered, we always offer the
 * generated sign-in link so the admin can share it directly — this is the reliable path when
 * Supabase SMTP isn't configured yet.
 */
export function notifyInviteResult(result: InviteResult, email: string): void {
  const { emailed, alreadyRegistered, actionLink } = result;
  const message = alreadyRegistered
    ? emailed
      ? `${email} already has an account — a fresh sign-in email is on its way.`
      : `${email} already has an account — email could not be sent. Copy the sign-in link and share it directly.`
    : emailed
      ? `Invite emailed to ${email}.`
      : 'User provisioned — email could not be sent. Copy the sign-in link and share it directly.';

  toast.success(message, {
    duration: actionLink ? 30000 : 6000,
    action: actionLink
      ? {
          label: 'Copy sign-in link',
          onClick: () => {
            void navigator.clipboard.writeText(actionLink).then(
              () => toast.success('Sign-in link copied.'),
              () => toast.error('Could not copy — the link is in the console.', { description: actionLink }),
            );
          },
        }
      : undefined,
  });
}
