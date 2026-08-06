import React from 'react';
import { CalendarDays } from 'lucide-react';
import { formatDate } from '@/app/lib/portal-format';
import type { PublicHoliday } from '@/app/lib/portal-types';
import { EmptyState, PortalCard, StatusTag } from '@/app/components/portal/PortalUi';

/**
 * Compact "Public holidays" card for the admin and client dashboards — upcoming holidays in the
 * current year, soonest first. The list itself is access-gated by RLS (migration 0042), so an
 * ineligible client simply receives an empty array and the card shows the empty state.
 */
export const PublicHolidaysWidget: React.FC<{ holidays: PublicHoliday[]; limit?: number }> = ({
  holidays,
  limit = 6,
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const year = new Date().getFullYear();
  const upcoming = holidays
    .filter((holiday) => holiday.holiday_date >= today && holiday.holiday_date.slice(0, 4) === String(year))
    .sort((a, b) => a.holiday_date.localeCompare(b.holiday_date))
    .slice(0, limit);

  return (
    <PortalCard
      title={
        <span className="inline-flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-violet" /> Public holidays
        </span>
      }
      collapseKey="public-holidays"
      description={`Upcoming in ${year}`}
    >
      {upcoming.length === 0 ? (
        <EmptyState title="No upcoming holidays" description="Nothing scheduled for the rest of the year." />
      ) : (
        <ul className="divide-y divide-border-color">
          {upcoming.map((holiday) => (
            <li key={holiday.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{holiday.name}</div>
                {holiday.description && <div className="truncate text-xs text-grey">{holiday.description}</div>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {holiday.country && <StatusTag tone="violet">{holiday.country}</StatusTag>}
                <span className="whitespace-nowrap text-xs text-grey">{formatDate(holiday.holiday_date)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PortalCard>
  );
};
