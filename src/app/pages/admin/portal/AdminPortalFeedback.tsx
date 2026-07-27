import React from 'react';
import { useAsync } from '@/app/hooks/use-async';
import { adminListFeedback } from '@/app/lib/portal-admin-api';
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
  const feedback = useAsync(() => adminListFeedback(), []);
  const [filter, setFilter] = React.useState<Filter>('all');

  if (feedback.loading) return <PortalSpinner label="Loading feedback…" />;
  if (feedback.error) return <ErrorNote>{feedback.error}</ErrorNote>;

  const entries = feedback.data ?? [];
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
    <div className="space-y-5">
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
