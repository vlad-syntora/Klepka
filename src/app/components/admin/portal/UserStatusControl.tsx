import React from 'react';
import { toast } from 'sonner';
import { adminUpdateUser, portalInviteUser } from '@/app/lib/portal-admin-api';
import { notifyInviteResult } from '@/app/lib/invite-feedback';
import { USER_STATUSES, USER_STATUS_LABELS, type PortalUser, type UserStatus } from '@/app/lib/portal-types';
import { cn } from '@/app/components/ui/utils';
import { inputClass, toneClassName, toneFor } from '@/app/components/portal/PortalUi';

/**
 * Inline status editor. Picking "Invited" provisions an auth user and emails the invite (server
 * side); the other states just update the profile. "Inactive" revokes portal access entirely.
 */
export const UserStatusControl: React.FC<{ user: PortalUser; onChanged: () => void | Promise<void> }> = ({
  user,
  onChanged,
}) => {
  const [busy, setBusy] = React.useState(false);
  // Legacy 'disabled' rows read as 'inactive' in the dropdown.
  const current = (user.status === 'disabled' ? 'inactive' : user.status) as UserStatus;

  const change = async (next: UserStatus) => {
    if (next === current) return;
    setBusy(true);
    try {
      if (next === 'invited') {
        notifyInviteResult(await portalInviteUser(user.id), user.email);
      } else {
        await adminUpdateUser(user.id, { status: next });
        toast.success(next === 'inactive' ? 'Access revoked.' : 'Marked as Active.');
      }
      await onChanged();
    } catch (cause) {
      toast.error('Could not update status', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <select
      className={cn(inputClass, 'w-auto py-1 text-xs font-semibold', toneClassName(toneFor(current)))}
      value={current}
      disabled={busy}
      onChange={(event) => change(event.target.value as UserStatus)}
    >
      {USER_STATUSES.map((value) => (
        <option key={value} value={value}>
          {USER_STATUS_LABELS[value]}
        </option>
      ))}
    </select>
  );
};
