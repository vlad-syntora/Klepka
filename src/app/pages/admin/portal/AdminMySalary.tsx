import React from 'react';
import { useAsync } from '@/app/hooks/use-async';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import { listMySalaries } from '@/app/lib/portal-admin-api';
import { formatMoney } from '@/app/lib/portal-format';
import { SalaryTable, totalsByCurrency } from '@/app/components/portal/SalaryList';
import {
  EmptyState,
  ErrorNote,
  InfoNote,
  PortalCard,
  PortalSpinner,
  StatTile,
} from '@/app/components/portal/PortalUi';

/**
 * A staffer's own salary history — the read-only counterpart to the admin Salaries page. Shows only
 * the signed-in user's rows (enforced by the self-read RLS policy, migration 0046), with no status
 * actions. Each month expands to the worklogs behind it.
 */
export const AdminMySalary: React.FC = () => {
  const { user } = usePortalUser();
  const me = user?.id ?? '';
  const salaries = useAsync(() => (me ? listMySalaries(me) : Promise.resolve([])), [me]);

  const rows = salaries.data ?? [];
  const totals = totalsByCurrency(rows);

  return (
    <div className="space-y-3">
      <PortalCard
        title="My Salary"
        description="Your monthly pay, from the hours you logged as the employee — each valued at the rate frozen on the log."
      >
        {totals.length > 0 && (
          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Months" value={rows.length} />
            {totals.map((entry) => (
              <StatTile
                key={entry.currency}
                label={`Total (${entry.currency})`}
                value={formatMoney(entry.amount, entry.currency)}
                hint={`${entry.hours} h`}
                tone="violet"
              />
            ))}
          </div>
        )}

        {salaries.loading ? (
          <PortalSpinner label="Loading your salary…" />
        ) : salaries.error ? (
          <ErrorNote>{salaries.error}</ErrorNote>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No salary yet"
            description="Once a month is opened and you log hours, your pay will appear here."
          />
        ) : (
          <SalaryTable salaries={rows} showPeriod />
        )}

        <div className="mt-4">
          <InfoNote>
            This counts the hours you logged as the <strong>Employee</strong>, by each log’s date, valued at the pay
            rate <strong>frozen when it was logged</strong>. <strong>Expand a month</strong> to see the individual
            worklogs behind it. Statuses are set by finance: <strong>Open</strong> (still accruing),{' '}
            <strong>Approved</strong> (signed off), <strong>Paid</strong> (final).
          </InfoNote>
        </div>
      </PortalCard>
    </div>
  );
};
