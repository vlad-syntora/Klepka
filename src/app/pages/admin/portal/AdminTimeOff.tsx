import React from 'react';
import { toast } from 'sonner';
import { CalendarOff, Check, Pencil, Plane, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { useAsync } from '@/app/hooks/use-async';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import {
  adminCreateTimeOff,
  adminDeleteTimeOff,
  adminListTeams,
  adminListTimeOff,
  adminListTimeOffReplacementRequests,
  adminListTimeOffResponses,
  adminListTimeOffReviewQueue,
  adminListUsers,
  adminSetTimeOffStatus,
  adminUpdateTimeOff,
} from '@/app/lib/portal-admin-api';
import { formatDate, prettyName } from '@/app/lib/portal-format';
import {
  isInternalRole,
  type TimeOff,
  type TimeOffKind,
  type TimeOffReplacement,
  type TimeOffReview,
} from '@/app/lib/portal-types';
import {
  Cell,
  EmptyState,
  ErrorNote,
  Field,
  InfoNote,
  PortalButton,
  PortalCard,
  PortalModal,
  PortalSpinner,
  PortalTable,
  Row,
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

interface EditState {
  id?: string;
  user_id: string;
  kind: TimeOffKind;
  start_date: string;
  end_date: string;
  note: string;
}

/**
 * Employee time off (migrations 0058–0060). Everyone can request and manage their own leave. A team lead
 * or admin additionally gets two review widgets: leave pending an internal sign-off (approve/reject) and
 * leave for which a client asked to be covered — pinned to the exact project + client that requested it.
 * Admins also keep the full ledger with edit/delete and per-leave client-response badges.
 */
export const AdminTimeOff: React.FC = () => {
  const { user } = usePortalUser();
  const me = user?.id ?? '';
  const isAdmin = user?.role === 'portal_admin';

  const state = useAsync(async () => {
    const [list, teams] = await Promise.all([adminListTimeOff(), adminListTeams()]);
    const canReview = isAdmin || teams.some((team) => team.lead_id === me);
    const [responses, users, reviewQueue, replacements] = await Promise.all([
      isAdmin && list.length > 0 ? adminListTimeOffResponses(list.map((l) => l.id)) : Promise.resolve([]),
      isAdmin ? adminListUsers() : Promise.resolve([]),
      canReview ? adminListTimeOffReviewQueue() : Promise.resolve([]),
      canReview ? adminListTimeOffReplacementRequests() : Promise.resolve([]),
    ]);
    return { list, canReview, responses, users, reviewQueue, replacements };
  }, [isAdmin, me]);

  const [edit, setEdit] = React.useState<EditState | null>(null);
  const [busy, setBusy] = React.useState(false);

  const list = state.data?.list ?? [];
  const canReview = state.data?.canReview ?? false;
  const reviewQueue = state.data?.reviewQueue ?? [];
  const replacements = state.data?.replacements ?? [];
  const myLeave = list.filter((row) => row.user_id === me);
  const staff = (state.data?.users ?? []).filter((u) => u.account_id === null && isInternalRole(u.role));

  // Aggregate client responses per leave (a staffer may be visible to several projects/accounts).
  const responseFor = React.useMemo(() => {
    const map = new Map<string, { approved: number; replacement: number }>();
    for (const r of state.data?.responses ?? []) {
      const acc = map.get(r.time_off_id) ?? { approved: 0, replacement: 0 };
      if (r.approved) acc.approved += 1;
      if (r.replacement_requested) acc.replacement += 1;
      map.set(r.time_off_id, acc);
    }
    return map;
  }, [state.data?.responses]);

  const openCreate = () =>
    setEdit({ user_id: me, kind: 'vacation', start_date: '', end_date: '', note: '' });

  const save = async () => {
    if (!edit) return;
    if (!edit.user_id || !edit.start_date || !edit.end_date) {
      toast.error('Pick an employee and both dates.');
      return;
    }
    if (edit.end_date < edit.start_date) {
      toast.error('The end date cannot be before the start date.');
      return;
    }
    setBusy(true);
    try {
      if (edit.id) {
        await adminUpdateTimeOff(edit.id, {
          kind: edit.kind,
          start_date: edit.start_date,
          end_date: edit.end_date,
          note: edit.note.trim(),
        });
      } else {
        await adminCreateTimeOff({
          user_id: edit.user_id,
          kind: edit.kind,
          start_date: edit.start_date,
          end_date: edit.end_date,
          note: edit.note.trim(),
        });
      }
      toast.success(edit.id ? 'Time off updated.' : 'Time off requested.');
      setEdit(null);
      await state.reload();
    } catch (cause) {
      toast.error('Could not save', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const review = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await adminSetTimeOffStatus(id, status);
      await state.reload();
    } catch (cause) {
      toast.error('Could not update', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const remove = async (row: TimeOff) => {
    if (!window.confirm('Delete this time off entry?')) return;
    try {
      await adminDeleteTimeOff(row.id);
      await state.reload();
    } catch (cause) {
      toast.error('Could not delete', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const editRow = (row: TimeOff) =>
    setEdit({
      id: row.id,
      user_id: row.user_id,
      kind: row.kind,
      start_date: row.start_date,
      end_date: row.end_date,
      note: row.note,
    });

  if (state.loading) return <PortalSpinner label="Loading time off…" />;
  if (state.error) return <ErrorNote>{state.error}</ErrorNote>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-violet">
            <CalendarOff className="h-5 w-5" /> Time off
          </h1>
          <p className="text-sm text-grey">
            {canReview
              ? 'Vacations and sick leave. Approve a request to make it visible to the client projects it touches.'
              : 'Request your vacations and sick leave. A team lead or admin approves before it is shared with clients.'}
          </p>
        </div>
        <PortalButton onClick={openCreate}>
          <Plus className="h-4 w-4" /> {isAdmin ? 'Add time off' : 'Request time off'}
        </PortalButton>
      </div>

      {!canReview && (
        <InfoNote>
          Your requests start as <strong>pending</strong>. A team lead or admin approves them; only approved
          leave is shown to clients whose projects you are on.
        </InfoNote>
      )}

      {/* 1 — Everyone: my own leave. */}
      <PortalCard title="My time off" description="Your vacation and sick leave.">
        {myLeave.length === 0 ? (
          <EmptyState title="No time off yet" description="Use “Request time off” to add some." />
        ) : (
          <PortalTable head={['Type', 'Dates', 'Days', 'Status', '']}>
            {myLeave.map((row) => (
              <Row key={row.id}>
                <Cell>
                  <StatusTag tone={row.kind === 'vacation' ? 'violet' : 'amber'}>{KIND_LABELS[row.kind]}</StatusTag>
                </Cell>
                <Cell className="whitespace-nowrap text-grey">
                  {formatDate(row.start_date)} – {formatDate(row.end_date)}
                  {row.note && <div className="text-xs text-grey">{row.note}</div>}
                </Cell>
                <Cell className="whitespace-nowrap text-grey">{spanDays(row.start_date, row.end_date)}</Cell>
                <Cell>
                  <StatusTag tone={STATUS_TONE[row.status]}>{row.status}</StatusTag>
                </Cell>
                <Cell className="text-right">
                  <div className="flex justify-end gap-1">
                    <PortalButton variant="ghost" onClick={() => editRow(row)} aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </PortalButton>
                    <PortalButton variant="ghost" onClick={() => remove(row)} aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </PortalButton>
                  </div>
                </Cell>
              </Row>
            ))}
          </PortalTable>
        )}
      </PortalCard>

      {/* 2 — Team lead / admin: pending leave to sign off. */}
      {canReview && (
        <PortalCard
          title="Pending approval"
          description={isAdmin ? 'Requests awaiting an internal sign-off.' : 'Requests from your team awaiting sign-off.'}
        >
          {reviewQueue.length === 0 ? (
            <EmptyState title="Nothing to review" description="Approved and rejected requests drop off this list." />
          ) : (
            <PortalTable head={['Employee', 'Team', 'Type', 'Dates', 'Days', '']}>
              {reviewQueue.map((row: TimeOffReview) => (
                <Row key={row.id}>
                  <Cell className="font-medium">{prettyName(row.full_name)}</Cell>
                  <Cell className="text-grey">{row.team_name ?? '—'}</Cell>
                  <Cell>
                    <StatusTag tone={row.kind === 'vacation' ? 'violet' : 'amber'}>{KIND_LABELS[row.kind]}</StatusTag>
                  </Cell>
                  <Cell className="whitespace-nowrap text-grey">
                    {formatDate(row.start_date)} – {formatDate(row.end_date)}
                    {row.note && <div className="text-xs text-grey">{row.note}</div>}
                  </Cell>
                  <Cell className="whitespace-nowrap text-grey">{row.days}</Cell>
                  <Cell className="text-right">
                    <div className="flex justify-end gap-1">
                      <PortalButton variant="ghost" onClick={() => review(row.id, 'approved')} aria-label="Approve">
                        <Check className="h-4 w-4 text-portal-green" />
                      </PortalButton>
                      <PortalButton variant="ghost" onClick={() => review(row.id, 'rejected')} aria-label="Reject">
                        <X className="h-4 w-4 text-portal-red" />
                      </PortalButton>
                    </div>
                  </Cell>
                </Row>
              ))}
            </PortalTable>
          )}
        </PortalCard>
      )}

      {/* 3 — Team lead / admin: replacements a client asked for, per project. */}
      {canReview && (
        <PortalCard
          title={
            <span className="inline-flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-violet" /> Replacement requested
            </span>
          }
          description="Clients who asked to be covered while someone is away — by project."
        >
          {replacements.length === 0 ? (
            <EmptyState title="No replacement requests" description="Nothing needs cover right now." />
          ) : (
            <PortalTable head={['Employee', 'Type', 'Dates', 'Days', 'Requested by (client › project)']}>
              {replacements.map((row: TimeOffReplacement) => (
                <Row key={`${row.id}-${row.project_id}`}>
                  <Cell className="font-medium">{prettyName(row.full_name)}</Cell>
                  <Cell>
                    <StatusTag tone={row.kind === 'vacation' ? 'violet' : 'amber'}>{KIND_LABELS[row.kind]}</StatusTag>
                  </Cell>
                  <Cell className="whitespace-nowrap text-grey">
                    {formatDate(row.start_date)} – {formatDate(row.end_date)}
                  </Cell>
                  <Cell className="whitespace-nowrap text-grey">{row.days}</Cell>
                  <Cell>
                    <span className="text-sm font-medium">{row.account_name}</span>
                    <span className="text-grey"> › {row.project_name}</span>
                    {row.replacement_requested_at && (
                      <div className="text-xs text-grey">requested {formatDate(row.replacement_requested_at)}</div>
                    )}
                  </Cell>
                </Row>
              ))}
            </PortalTable>
          )}
        </PortalCard>
      )}

      {/* 4 — Admin only: the full ledger with edit/delete + client-response badges. */}
      {isAdmin && (
        <PortalCard title="All time off" description="Everyone's leave.">
          {list.length === 0 ? (
            <EmptyState title="No time off yet" description="Requests will appear here." />
          ) : (
            <PortalTable head={['Employee', 'Type', 'Dates', 'Days', 'Status', 'Client', '']}>
              {list.map((row) => {
                const days = spanDays(row.start_date, row.end_date);
                const resp = responseFor.get(row.id);
                return (
                  <Row key={row.id}>
                    <Cell className="font-medium">{prettyName(row.user?.full_name ?? '')}</Cell>
                    <Cell>
                      <StatusTag tone={row.kind === 'vacation' ? 'violet' : 'amber'}>{KIND_LABELS[row.kind]}</StatusTag>
                    </Cell>
                    <Cell className="whitespace-nowrap text-grey">
                      {formatDate(row.start_date)} – {formatDate(row.end_date)}
                      {row.note && <div className="text-xs text-grey">{row.note}</div>}
                    </Cell>
                    <Cell className="whitespace-nowrap text-grey">{days}</Cell>
                    <Cell>
                      <StatusTag tone={STATUS_TONE[row.status]}>{row.status}</StatusTag>
                    </Cell>
                    <Cell>
                      {row.status === 'approved' ? (
                        <div className="flex flex-wrap gap-1">
                          {resp && resp.approved > 0 && <StatusTag tone="green">Approved · {resp.approved}</StatusTag>}
                          {resp && resp.replacement > 0 && (
                            <StatusTag tone="amber">Replacement · {resp.replacement}</StatusTag>
                          )}
                          {(!resp || (resp.approved === 0 && resp.replacement === 0)) && (
                            <span className="text-xs text-grey">Awaiting client</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-grey">—</span>
                      )}
                    </Cell>
                    <Cell className="text-right">
                      <div className="flex justify-end gap-1">
                        {row.status !== 'approved' && (
                          <PortalButton variant="ghost" onClick={() => review(row.id, 'approved')} aria-label="Approve">
                            <Check className="h-4 w-4 text-portal-green" />
                          </PortalButton>
                        )}
                        {row.status !== 'rejected' && (
                          <PortalButton variant="ghost" onClick={() => review(row.id, 'rejected')} aria-label="Reject">
                            <X className="h-4 w-4 text-portal-red" />
                          </PortalButton>
                        )}
                        <PortalButton variant="ghost" onClick={() => editRow(row)} aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </PortalButton>
                        <PortalButton variant="ghost" onClick={() => remove(row)} aria-label="Delete">
                          <Trash2 className="h-4 w-4" />
                        </PortalButton>
                      </div>
                    </Cell>
                  </Row>
                );
              })}
            </PortalTable>
          )}
        </PortalCard>
      )}

      {edit && (
        <PortalModal
          open
          onClose={() => setEdit(null)}
          title={edit.id ? 'Edit time off' : isAdmin ? 'Add time off' : 'Request time off'}
          description="Vacation or sick leave. A team lead or admin approval is required before clients see it."
          className="max-w-md"
        >
          <div className="space-y-3">
            {isAdmin && !edit.id && (
              <Field label="Employee">
                <select
                  className={inputClass}
                  value={edit.user_id}
                  onChange={(event) => setEdit({ ...edit, user_id: event.target.value })}
                >
                  <option value="">Select employee…</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {prettyName(member.full_name)}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Type">
              <select
                className={inputClass}
                value={edit.kind}
                onChange={(event) => setEdit({ ...edit, kind: event.target.value as TimeOffKind })}
              >
                <option value="vacation">Vacation</option>
                <option value="sick">Sick leave</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start">
                <input
                  type="date"
                  className={inputClass}
                  value={edit.start_date}
                  onChange={(event) => setEdit({ ...edit, start_date: event.target.value })}
                />
              </Field>
              <Field label="End">
                <input
                  type="date"
                  className={inputClass}
                  value={edit.end_date}
                  onChange={(event) => setEdit({ ...edit, end_date: event.target.value })}
                />
              </Field>
            </div>
            <Field label="Note" hint="Optional.">
              <input
                className={inputClass}
                value={edit.note}
                onChange={(event) => setEdit({ ...edit, note: event.target.value })}
              />
            </Field>
            <div className="flex items-center gap-2 pt-1">
              <PortalButton disabled={busy} onClick={save}>
                {busy ? 'Saving…' : 'Save'}
              </PortalButton>
              <PortalButton variant="ghost" type="button" onClick={() => setEdit(null)}>
                Cancel
              </PortalButton>
              {edit.start_date && edit.end_date && edit.end_date >= edit.start_date && (
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-grey">
                  <Plane className="h-3.5 w-3.5" /> {spanDays(edit.start_date, edit.end_date)} day(s)
                </span>
              )}
            </div>
          </div>
        </PortalModal>
      )}
    </div>
  );
};
