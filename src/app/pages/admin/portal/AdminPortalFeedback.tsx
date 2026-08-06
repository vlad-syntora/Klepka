import React from 'react';
import { useAsync } from '@/app/hooks/use-async';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import { adminListAccounts, adminListFeedback } from '@/app/lib/portal-admin-api';
import { isImplementer } from '@/app/lib/portal-types';
import { FeedbackList } from '@/app/components/admin/portal/WorkspaceFeedback';
import {
  ErrorNote,
  PortalCard,
  PortalSpinner,
  StatTile,
  inputClass,
} from '@/app/components/portal/PortalUi';

type Filter = 'all' | 'urgent' | 'unanswered' | 'low';

export const AdminPortalFeedback: React.FC = () => {
  const { user } = usePortalUser();
  const feedback = useAsync(() => adminListFeedback(), []);
  const accounts = useAsync(() => adminListAccounts(), []);
  const [filter, setFilter] = React.useState<Filter>('all');

  const implementer = user ? isImplementer(user.role) : false;

  if (feedback.loading) return <PortalSpinner label="Loading feedback…" />;
  if (feedback.error) return <ErrorNote>{feedback.error}</ErrorNote>;

  const entries = feedback.data ?? [];

  // Implementer view: two read-only widgets — feedback about them, and feedback from the accounts
  // they're on — with no way to respond, publish or delete.
  if (implementer) {
    const myAccountIds = new Set((accounts.data ?? []).map((account) => account.id));
    const mine = entries.filter((entry) => entry.about_user_id === user?.id);
    const company = entries.filter((entry) => myAccountIds.has(entry.account_id));
    return (
      <div className="space-y-2">
        <PortalCard title="My feedback" description="Reviews clients left crediting you.">
          <FeedbackList entries={mine} showAccount readOnly onResponded={feedback.reload} />
        </PortalCard>
        <PortalCard title="Company feedback" description="Reviews from the accounts you're on.">
          <FeedbackList entries={company} showAccount readOnly onResponded={feedback.reload} />
        </PortalCard>
      </div>
    );
  }

  const urgent = entries.filter((entry) => entry.is_urgent && entry.status !== 'resolved');
  const unanswered = entries.filter((entry) => entry.status === 'new');
  const average =
    entries.length > 0 ? (entries.reduce((sum, entry) => sum + entry.rating, 0) / entries.length).toFixed(1) : '—';

  const visible = entries.filter((entry) => {
    if (filter === 'urgent') return entry.is_urgent;
    if (filter === 'unanswered') return entry.status === 'new';
    if (filter === 'low') return entry.rating <= 3;
    return true;
  });

  return (
    <div className="space-y-2">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Average rating" value={`${average} / 5`} />
        <StatTile label="Urgent open" value={urgent.length} tone={urgent.length > 0 ? 'red' : 'green'} />
        <StatTile label="Awaiting response" value={unanswered.length} tone={unanswered.length > 0 ? 'amber' : 'green'} />
      </div>

      <PortalCard
        title="Feedback inbox"
        description="Every account, newest first."
        action={
          <select
            className={`${inputClass} w-auto py-1.5 text-xs`}
            value={filter}
            onChange={(event) => setFilter(event.target.value as Filter)}
          >
            <option value="all">All feedback</option>
            <option value="urgent">Urgent flags</option>
            <option value="unanswered">Awaiting response</option>
            <option value="low">3 stars or lower</option>
          </select>
        }
      >
        <FeedbackList entries={visible} showAccount onResponded={feedback.reload} />
      </PortalCard>
    </div>
  );
};
