import React from 'react';
import { toast } from 'sonner';
import { CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAsync } from '@/app/hooks/use-async';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import {
  adminDeletePublicHoliday,
  adminListPublicHolidays,
  adminUpsertPublicHoliday,
} from '@/app/lib/portal-admin-api';
import { formatDate } from '@/app/lib/portal-format';
import { isImplementer, type PublicHoliday } from '@/app/lib/portal-types';
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

const todayIso = (): string => new Date().toISOString().slice(0, 10);

interface EditState {
  id?: string;
  name: string;
  holiday_date: string;
  description: string;
  country: string;
}

const emptyEdit = (): EditState => ({ name: '', holiday_date: '', description: '', country: '' });

/**
 * Public-holiday calendar (migration 0042). Admins can add / edit / delete; the Implementer role is
 * read-only (RLS also enforces this server-side). Both see the same list of upcoming holidays.
 */
export const AdminPublicHolidays: React.FC = () => {
  const { user } = usePortalUser();
  const canEdit = user ? !isImplementer(user.role) : false;
  const holidays = useAsync(() => adminListPublicHolidays(), []);
  const [edit, setEdit] = React.useState<EditState | null>(null);
  const [busy, setBusy] = React.useState(false);

  const today = todayIso();
  const rows = holidays.data ?? [];
  const upcoming = rows.filter((holiday) => holiday.holiday_date >= today);
  const past = rows.filter((holiday) => holiday.holiday_date < today);

  const save = async () => {
    if (!edit) return;
    if (!edit.name.trim() || !edit.holiday_date) {
      toast.error('Give the holiday a name and a date.');
      return;
    }
    setBusy(true);
    try {
      await adminUpsertPublicHoliday({
        id: edit.id,
        name: edit.name.trim(),
        holiday_date: edit.holiday_date,
        description: edit.description.trim(),
        country: edit.country.trim() || null,
      });
      toast.success(edit.id ? 'Holiday updated.' : 'Holiday added.');
      setEdit(null);
      await holidays.reload();
    } catch (cause) {
      toast.error('Could not save', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (holiday: PublicHoliday) => {
    if (!window.confirm(`Delete "${holiday.name}"?`)) return;
    try {
      await adminDeletePublicHoliday(holiday.id);
      await holidays.reload();
    } catch (cause) {
      toast.error('Could not delete', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  if (holidays.loading) return <PortalSpinner label="Loading holidays…" />;
  if (holidays.error) return <ErrorNote>{holidays.error}</ErrorNote>;

  const table = (list: PublicHoliday[], emptyLabel: string) =>
    list.length === 0 ? (
      <EmptyState title={emptyLabel} />
    ) : (
      <PortalTable head={['Date', 'Holiday', 'Country', ...(canEdit ? [''] : [])]}>
        {list.map((holiday) => (
          <Row key={holiday.id}>
            <Cell className="whitespace-nowrap text-grey">{formatDate(holiday.holiday_date)}</Cell>
            <Cell>
              <div className="font-medium">{holiday.name}</div>
              {holiday.description && <div className="text-xs text-grey">{holiday.description}</div>}
            </Cell>
            <Cell>
              {holiday.country ? (
                <StatusTag tone="violet">{holiday.country}</StatusTag>
              ) : (
                <span className="text-xs text-grey">All</span>
              )}
            </Cell>
            {canEdit && (
              <Cell className="text-right">
                <div className="flex justify-end gap-1">
                  <PortalButton
                    variant="ghost"
                    onClick={() =>
                      setEdit({
                        id: holiday.id,
                        name: holiday.name,
                        holiday_date: holiday.holiday_date,
                        description: holiday.description,
                        country: holiday.country ?? '',
                      })
                    }
                    aria-label="Edit holiday"
                  >
                    <Pencil className="h-4 w-4" />
                  </PortalButton>
                  <PortalButton variant="ghost" onClick={() => remove(holiday)} aria-label="Delete holiday">
                    <Trash2 className="h-4 w-4" />
                  </PortalButton>
                </div>
              </Cell>
            )}
          </Row>
        ))}
      </PortalTable>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-violet">
            <CalendarDays className="h-5 w-5" /> Public holidays
          </h1>
          <p className="text-sm text-grey">
            Shared calendar surfaced on the admin and client dashboards. Clients see it once their account is qualified.
          </p>
        </div>
        {canEdit && (
          <PortalButton onClick={() => setEdit(emptyEdit())}>
            <Plus className="h-4 w-4" /> Add holiday
          </PortalButton>
        )}
      </div>

      {!canEdit && (
        <InfoNote>You have read-only access to the holiday calendar. Ask an admin to add or change entries.</InfoNote>
      )}

      <PortalCard title="Upcoming" description="Holidays from today onward.">
        {table(upcoming, 'No upcoming holidays yet')}
      </PortalCard>

      {past.length > 0 && (
        <PortalCard title="Earlier this year" description="Holidays already passed.">
          {table(past, 'None')}
        </PortalCard>
      )}

      {edit && (
        <PortalModal
          open
          onClose={() => setEdit(null)}
          title={edit.id ? 'Edit holiday' : 'Add holiday'}
          description="Public holidays are shared with all staff and qualified clients."
          className="max-w-md"
        >
          <div className="space-y-3">
            <Field label="Name">
              <input
                className={inputClass}
                value={edit.name}
                onChange={(event) => setEdit({ ...edit, name: event.target.value })}
              />
            </Field>
            <Field label="Date">
              <input
                type="date"
                className={inputClass}
                value={edit.holiday_date}
                onChange={(event) => setEdit({ ...edit, holiday_date: event.target.value })}
              />
            </Field>
            <Field label="Country" hint="Optional ISO code (e.g. PL, US). Leave blank for all.">
              <input
                className={inputClass}
                value={edit.country}
                onChange={(event) => setEdit({ ...edit, country: event.target.value })}
              />
            </Field>
            <Field label="Description" hint="Optional.">
              <input
                className={inputClass}
                value={edit.description}
                onChange={(event) => setEdit({ ...edit, description: event.target.value })}
              />
            </Field>
            <div className="flex gap-2 pt-1">
              <PortalButton disabled={busy} onClick={save}>
                {busy ? 'Saving…' : 'Save'}
              </PortalButton>
              <PortalButton variant="ghost" type="button" onClick={() => setEdit(null)}>
                Cancel
              </PortalButton>
            </div>
          </div>
        </PortalModal>
      )}
    </div>
  );
};
