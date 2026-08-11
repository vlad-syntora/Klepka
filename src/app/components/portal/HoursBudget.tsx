import React from 'react';
import { cn } from '@/app/components/ui/utils';

const fmt = (value: number) => {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, '');
};

interface HoursBudgetProps {
  bank?: number | null;
  notify?: number | null;
  /** Optional consumed hours; when given with a bank, renders a used-vs-bank progress bar. */
  used?: number | null;
  /** Optional period qualifier for the bar caption, e.g. "This month" — the bank is a monthly limit. */
  label?: string;
  className?: string;
}

/**
 * Read-only view of a record's hours budget (migration 0034). Each of the two figures is shown
 * only when set, so a client never sees a blank field; the whole block renders nothing when both
 * are absent. When `used` is supplied alongside a bank, a progress bar tracks consumption of the
 * (monthly) limit — showing the percent drawn down — and the bar turns amber once the notify mark
 * is reached, then red once the limit is exceeded.
 */
export const HoursBudget: React.FC<HoursBudgetProps> = ({ bank, notify, used, label, className }) => {
  const hasBank = bank != null;
  const hasNotify = notify != null;
  if (!hasBank && !hasNotify) return null;

  const usedNum = used ?? null;
  const showBar = hasBank && usedNum != null && bank > 0;
  const overBudget = usedNum != null && hasBank && usedNum > bank;
  const pastNotify = usedNum != null && hasNotify && usedNum >= notify;
  const pct = showBar ? Math.min(100, Math.round((usedNum / bank) * 100)) : 0;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap gap-2">
        {hasBank && (
          <span className="inline-flex items-baseline gap-1.5 rounded-lg bg-portal-tint px-3 py-1.5 text-sm text-violet">
            <span className="text-xs uppercase tracking-wide text-grey">Bank of hours</span>
            <span className="font-semibold">{fmt(bank)} h</span>
          </span>
        )}
        {hasNotify && (
          <span className="inline-flex items-baseline gap-1.5 rounded-lg bg-portal-tint px-3 py-1.5 text-sm text-violet">
            <span className="text-xs uppercase tracking-wide text-grey">Notify at</span>
            <span className="font-semibold">{fmt(notify)} h</span>
          </span>
        )}
      </div>
      {showBar && (
        <div>
          <div className="flex items-baseline justify-between text-xs text-grey">
            <span>
              {label ? `${label} · ` : ''}
              {fmt(usedNum)} h used
            </span>
            <span>
              <span className={cn('font-semibold', overBudget ? 'text-portal-red' : 'text-foreground')}>{pct}%</span>{' '}
              of {fmt(bank)} h
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border-color">
            <div
              className={cn('h-full rounded-full', overBudget ? 'bg-portal-red' : pastNotify ? 'bg-portal-amber' : 'bg-violet')}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
