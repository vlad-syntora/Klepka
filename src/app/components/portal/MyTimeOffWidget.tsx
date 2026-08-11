import React from 'react';
import { toast } from 'sonner';
import { CalendarOff, Plane, Plus } from 'lucide-react';
import { useAsync } from '@/app/hooks/use-async';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import { adminCreateTimeOff, adminListMyTeamTimeOff } from '@/app/lib/portal-admin-api';
import { formatDate, prettyName } from '@/app/lib/portal-format';
import type { MyTeamTimeOff, TimeOffKind } from '@/app/lib/portal-types';
import {
  EmptyState,
  ErrorNote,
  Field,
  PortalButton,
  PortalCard,
  PortalModal,
  PortalSpinner,
  StatusTag,
  inputClass,
} from '@/app/components/portal/PortalUi';

const KIND_LABELS: Record<TimeOffKind, string> = { vacation: 'Vacation', sick: 'Sick leave' };
const STATUS_TONE = { pending: 'amber', approved: 'green', rejected: 'red' } as const;

/** Whole-day span, inclusive of both ends. */
const spanDays = (start: string, end: string): number => {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
};

const LeaveRow: React.FC<{ item: MyTeamTimeOff; showStatus?: boolean }> = ({ item, showStatus }) => (
  <li className="flex items-start justify-between gap-3 py-2.5">
    <div className="min-w-0">
      <div className="truncate text-sm font-medium">{prettyName(item.full_name)}</div>
      <div className="text-xs text-grey">
        {formatDate(item.start_date)} – {formatDate(item.end_date)} · {item.days} day(s)
      </div>
      {item.note && <div className="mt-0.5 truncate text-xs text-grey">{item.note}</div>}
    </div>
    <div className="flex shrink-0 items-center gap-1.5">
      {showStatus && <StatusTag tone={STATUS_TONE[item.status]}>{item.status}</StatusTag>}
      <StatusTag tone={item.kind === 'vacation' ? 'violet' : 'amber'}>{KIND_LABELS[item.kind]}</StatusTag>
    </div>
  </li>
);

/**
 * Staff dashboard widget (migration 0059). Lets a staffer request time off right from the dashboard and
 * shows their own upcoming leave (any pending/approved status) plus the approved upcoming leave of their
 * teammates (people sharing their team). Reads the internal `portal_my_team_upcoming_time_off` feed.
 */
export const MyTimeOffWidget: React.FC = () => {
  const { user } = usePortalUser();
  const me = user?.id ?? '';
  const feed = useAsync(() => adminListMyTeamTimeOff(), []);

  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<TimeOffKind>('vacation');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const reset = () => {
    setKind('vacation');
    setStartDate('');
    setEndDate('');
    setNote('');
  };

  const submit = async () => {
    if (!me || !startDate || !endDate) {
      toast.error('Pick both dates.');
      return;
    }
    if (endDate < startDate) {
      toast.error('The end date cannot be before the start date.');
      return;
    }
    setBusy(true);
    try {
      await adminCreateTimeOff({ user_id: me, kind, start_date: startDate, end_date: endDate, note: note.trim() });
      toast.success('Time off requested. An admin will review it.');
      setOpen(false);
      reset();
      await feed.reload();
    } catch (cause) {
      toast.error('Could not request time off', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const items = feed.data ?? [];
  const mine = items.filter((item) => item.is_me);
  const team = items.filter((item) => !item.is_me);

  return (
    <PortalCard
      title={
        <span className="inline-flex items-center gap-2">
          <CalendarOff className="h-4 w-4 text-violet" /> Time off
        </span>
      }
      collapseKey="my-time-off"
      description="Your upcoming leave and your team's"
      keepActionWhenCollapsed
      action={
        <PortalButton variant="secondary" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Request time off
        </PortalButton>
      }
    >
      {feed.loading ? (
        <PortalSpinner />
      ) : feed.error ? (
        <ErrorNote>{feed.error}</ErrorNote>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-grey">My upcoming</div>
            {mine.length === 0 ? (
              <EmptyState title="No upcoming time off" description="Request leave to see it here." />
            ) : (
              <ul className="divide-y divide-border-color">
                {mine.map((item) => (
                  <LeaveRow key={item.id} item={item} showStatus />
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-grey">My team</div>
            {team.length === 0 ? (
              <EmptyState title="Nobody on your team is away" description="Approved leave of your teammates shows here." />
            ) : (
              <ul className="divide-y divide-border-color">
                {team.map((item) => (
                  <LeaveRow key={item.id} item={item} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {open && (
        <PortalModal
          open
          onClose={() => setOpen(false)}
          title="Request time off"
          description="Vacation or sick leave. An admin approval is required before clients see it."
          className="max-w-md"
        >
          <div className="space-y-3">
            <Field label="Type">
              <select className={inputClass} value={kind} onChange={(event) => setKind(event.target.value as TimeOffKind)}>
                <option value="vacation">Vacation</option>
                <option value="sick">Sick leave</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start">
                <input
                  type="date"
                  className={inputClass}
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </Field>
              <Field label="End">
                <input
                  type="date"
                  className={inputClass}
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </Field>
            </div>
            <Field label="Note" hint="Optional.">
              <input className={inputClass} value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
            <div className="flex items-center gap-2 pt-1">
              <PortalButton disabled={busy} onClick={submit}>
                {busy ? 'Requesting…' : 'Request'}
              </PortalButton>
              <PortalButton variant="ghost" type="button" onClick={() => setOpen(false)}>
                Cancel
              </PortalButton>
              {startDate && endDate && endDate >= startDate && (
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-grey">
                  <Plane className="h-3.5 w-3.5" /> {spanDays(startDate, endDate)} day(s)
                </span>
              )}
            </div>
          </div>
        </PortalModal>
      )}
    </PortalCard>
  );
};
