import React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { usePortalData } from '@/app/hooks/use-portal-data';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import { markActivityRead } from '@/app/lib/portal-api';
import { formatDateTime } from '@/app/lib/portal-format';
import { ACTIVITY_CATEGORIES, type ActivityCategory } from '@/app/lib/portal-types';
import {
  EmptyState,
  PortalButton,
  PortalCard,
  StatusTag,
  humanize,
  inputClass,
} from '@/app/components/portal/PortalUi';

export const PortalNotifications: React.FC = () => {
  const { snapshot, reload } = usePortalData();
  const { user } = usePortalUser();
  const [category, setCategory] = React.useState<ActivityCategory | 'all'>('all');
  const [busy, setBusy] = React.useState(false);

  if (!snapshot || !user) return null;

  const entries = snapshot.activity.filter((entry) => category === 'all' || entry.category === category);
  const unread = snapshot.activity.filter((entry) => !entry.read_by.includes(user.id));

  const markAll = async () => {
    setBusy(true);
    try {
      await markActivityRead(unread.map((entry) => entry.id));
      await reload();
    } catch (cause) {
      toast.error('Could not update', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PortalCard
      title="Notifications"
      description={unread.length > 0 ? `${unread.length} unread` : 'All caught up'}
      action={
        <>
          <select
            className={`${inputClass} w-auto py-1.5 text-xs`}
            value={category}
            onChange={(event) => setCategory(event.target.value as ActivityCategory | 'all')}
          >
            <option value="all">All categories</option>
            {ACTIVITY_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {humanize(value)}
              </option>
            ))}
          </select>
          <PortalButton variant="secondary" className="whitespace-nowrap" onClick={markAll} disabled={busy || unread.length === 0}>
            Mark all read
          </PortalButton>
        </>
      }
    >
      {entries.length === 0 ? (
        <EmptyState title="Nothing here yet" description="Updates across all modules land in this feed." />
      ) : (
        <ul className="divide-y divide-border-color">
          {entries.map((entry) => {
            const isUnread = !entry.read_by.includes(user.id);
            const body = (
              <div className="flex gap-3 py-3">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isUnread ? 'bg-violet' : 'bg-border-color'}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={isUnread ? 'text-sm font-semibold' : 'text-sm'}>{entry.title}</span>
                    <StatusTag tone="violet">{humanize(entry.category)}</StatusTag>
                  </div>
                  {entry.detail && <div className="text-sm text-grey">{entry.detail}</div>}
                  <div className="text-xs text-grey">{formatDateTime(entry.created_at)}</div>
                </div>
              </div>
            );

            return (
              <li key={entry.id}>
                {entry.link ? (
                  <Link to={entry.link} className="-mx-2 block rounded-lg px-2 transition-colors hover:bg-portal-tint/60">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PortalCard>
  );
};
