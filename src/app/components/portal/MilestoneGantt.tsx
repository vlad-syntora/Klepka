import React from 'react';
import { formatDate, formatDayDuration, formatMilestoneRange } from '@/app/lib/portal-format';
import { MILESTONE_STATUS_LABELS, type Milestone, type MilestoneStatus } from '@/app/lib/portal-types';

// Bar colour per milestone status (a completed/approved milestone reads as done).
const STATUS_BAR: Record<MilestoneStatus, string> = {
  not_started: 'bg-slate-300',
  in_progress: 'bg-portal-amber',
  complete: 'bg-violet',
  approved: 'bg-violet',
  delayed: 'bg-portal-red',
};

// Status label colour, so the written status reads clearly next to its bar.
const STATUS_TEXT: Record<MilestoneStatus, string> = {
  not_started: 'text-grey',
  in_progress: 'text-portal-amber',
  complete: 'text-violet',
  approved: 'text-violet',
  delayed: 'text-portal-red',
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * A lightweight Gantt view of a project's milestones. Each bar runs from the milestone's start date
 * to its due date over a shared time axis. When a milestone has no start date, it falls back to the
 * previous milestone's due date (or the project start) — a cascade that reads left-to-right. Dates
 * that are missing entirely are spread evenly so the chart still renders. Each bar is labelled with
 * its status. No external chart library.
 */
export const MilestoneGantt: React.FC<{
  milestones: Milestone[];
  startDate: string | null;
  targetDate: string | null;
}> = ({ milestones, startDate, targetDate }) => {
  const ordered = [...milestones].sort((a, b) => a.position - b.position);

  const dueTimes = ordered.map((milestone) => (milestone.due_date ? new Date(milestone.due_date).getTime() : null));
  const startTimes = ordered.map((milestone) =>
    milestone.start_date ? new Date(milestone.start_date).getTime() : null,
  );
  const known = [...dueTimes, ...startTimes].filter((value): value is number => value != null);

  const projectStart = startDate ? new Date(startDate).getTime() : null;
  const projectTarget = targetDate ? new Date(targetDate).getTime() : null;

  if (ordered.length === 0) {
    return <p className="text-sm text-grey">Milestones are being planned.</p>;
  }
  if (known.length === 0 && projectStart == null && projectTarget == null) {
    return <p className="text-sm text-grey">Add start or due dates to see the timeline.</p>;
  }

  // Domain: the earliest and latest points we know about, padded a little so end bars aren't flush.
  const candidates = [...known, projectStart, projectTarget].filter((value): value is number => value != null);
  let domainStart = Math.min(...candidates);
  let domainEnd = Math.max(...candidates);
  if (domainEnd <= domainStart) domainEnd = domainStart + 30 * DAY;
  const pad = (domainEnd - domainStart) * 0.04;
  domainStart -= pad;
  domainEnd += pad;
  const span = domainEnd - domainStart;

  // Fill in missing due dates by spreading them evenly across the domain, keeping order.
  const ends = dueTimes.map((value, index) =>
    value != null ? value : domainStart + ((index + 1) / ordered.length) * span,
  );
  // Bar start: the explicit start date if set, else the previous bar's end (or the project start),
  // clamped so a bar never starts after it ends.
  const starts = ordered.map((_, index) => {
    if (startTimes[index] != null) return Math.min(startTimes[index] as number, ends[index]);
    const fallback = index === 0 ? (projectStart ?? domainStart) : ends[index - 1];
    return Math.min(fallback, ends[index]);
  });
  const pct = (value: number) => Math.max(0, Math.min(100, ((value - domainStart) / span) * 100));

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[11px] text-grey">
        <span>{formatDate(new Date(domainStart).toISOString())}</span>
        <span>{formatDate(new Date(domainEnd).toISOString())}</span>
      </div>
      <ol className="space-y-1.5">
        {ordered.map((milestone, index) => {
          const left = pct(starts[index]);
          const width = Math.max(2, pct(ends[index]) - left);
          const done = milestone.status === 'approved' || milestone.status === 'complete';
          const range = formatMilestoneRange(milestone.start_date, milestone.due_date);
          const duration = formatDayDuration(milestone.start_date, milestone.due_date);
          return (
            <li key={milestone.id} className="grid grid-cols-[40%_1fr] items-center gap-2">
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium" title={milestone.name}>
                  {milestone.name}
                </span>
                <span className={`block text-[11px] font-medium ${STATUS_TEXT[milestone.status]}`}>
                  {MILESTONE_STATUS_LABELS[milestone.status]}
                </span>
                <span className="block text-[11px] text-grey">
                  {range}
                  {duration ? ` · ${duration}` : ''}
                </span>
              </span>
              <span className="relative h-4 rounded bg-slate-100" title={range}>
                <span
                  className={`absolute inset-y-0 rounded ${STATUS_BAR[milestone.status]}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                  {!done && milestone.percent_complete > 0 && (
                    <span
                      className="absolute inset-y-0 left-0 rounded bg-violet/70"
                      style={{ width: `${Math.min(100, milestone.percent_complete)}%` }}
                    />
                  )}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
