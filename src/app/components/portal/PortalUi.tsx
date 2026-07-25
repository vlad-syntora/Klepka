import React from 'react';
import { ChevronDown, Star } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';

/* ------------------------------------------------------------------ tags */

export type Tone = 'violet' | 'green' | 'amber' | 'red' | 'grey';

const TONE_CLASSES: Record<Tone, string> = {
  violet: 'bg-portal-tint text-violet',
  green: 'bg-portal-green/10 text-portal-green',
  amber: 'bg-portal-amber/10 text-portal-amber',
  red: 'bg-portal-red/10 text-portal-red',
  grey: 'bg-slate-100 text-slate-600',
};

/** The tag background/text classes for a tone — handy for colouring inline controls (selects). */
export function toneClassName(tone: Tone): string {
  return TONE_CLASSES[tone];
}

export const StatusTag: React.FC<{ tone?: Tone; children: React.ReactNode; className?: string }> = ({
  tone = 'grey',
  children,
  className,
}) => (
  <span
    className={cn(
      'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide',
      TONE_CLASSES[tone],
      className,
    )}
  >
    {children}
  </span>
);

/** `at_risk` → `At risk`, for enum values that have no dedicated label map. */
export function humanize(value: string): string {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Maps every status string used across the portal onto one of the five tones. */
export function toneFor(status: string): Tone {
  switch (status) {
    case 'accepted':
    case 'signed':
    case 'paid':
    case 'approved':
    case 'complete':
    case 'confirmed':
    case 'on_track':
    case 'active':
    case 'resolved':
    case 'closed_won':
      return 'green';
    case 'sent':
    case 'awaiting_signature':
    case 'changes_requested':
    case 'due':
    case 'upcoming':
    case 'at_risk':
    case 'requested':
    case 'in_progress':
    case 'acknowledged':
    case 'invited':
      return 'amber';
    case 'overdue':
    case 'delayed':
    case 'expired':
    case 'cancelled':
    case 'disabled':
    case 'inactive':
    case 'new':
      return 'red';
    case 'draft':
    case 'not_sent':
    case 'not_issued':
    case 'not_started':
    case 'superseded':
    case 'planned':
      return 'grey';
    default:
      return 'violet';
  }
}

/* ----------------------------------------------------------------- cards */

// When true, every PortalCard with a title renders collapsed and toggleable. Scoped by the
// <CollapsibleCards> provider so it only affects the trees that opt in (e.g. the admin account
// workspace) — the client portal is unaffected.
const CardCollapseContext = React.createContext(false);

/** Wrap a region so its PortalCards become collapsible sections, closed by default. */
export const CollapsibleCards: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <CardCollapseContext.Provider value={true}>{children}</CardCollapseContext.Provider>
);

export const PortalCard: React.FC<{
  title?: React.ReactNode;
  action?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Opt this card out of the CollapsibleCards behaviour — it stays expanded and non-toggleable. */
  alwaysOpen?: boolean;
}> = ({ title, action, description, children, className, bodyClassName, alwaysOpen }) => {
  const collapseEnabled = React.useContext(CardCollapseContext);
  const collapsible = !alwaysOpen && collapseEnabled && Boolean(title);
  const [open, setOpen] = React.useState(false);
  const showBody = !collapsible || open;

  return (
    <section className={cn('rounded-xl border border-border-color bg-card shadow-sm', className)}>
      {(title || action) && (
        <header
          className={cn(
            'flex flex-wrap items-center justify-between gap-3 px-5 py-4',
            showBody && 'border-b border-border-color',
          )}
        >
          {collapsible ? (
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <ChevronDown
                className={cn('h-4 w-4 shrink-0 text-grey transition-transform', open && 'rotate-180')}
              />
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold text-violet">{title}</span>
                {description && <span className="mt-0.5 block text-xs text-grey">{description}</span>}
              </span>
            </button>
          ) : (
            <div className="min-w-0">
              {title && <h2 className="truncate text-[15px] font-semibold text-violet">{title}</h2>}
              {description && <p className="mt-0.5 text-xs text-grey">{description}</p>}
            </div>
          )}
          {/* Actions belong to the open section — hide them while collapsed. */}
          {action && showBody && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      {showBody && <div className={cn('px-5 py-4', bodyClassName)}>{children}</div>}
    </section>
  );
};

export const StatTile: React.FC<{ label: string; value: React.ReactNode; tone?: Tone; hint?: string }> = ({
  label,
  value,
  tone,
  hint,
}) => (
  <div className="rounded-xl border border-border-color bg-card px-5 py-4 shadow-sm">
    <div className="text-xs uppercase tracking-wide text-grey">{label}</div>
    <div
      className={cn(
        'mt-1 text-2xl font-semibold',
        tone === 'green' && 'text-portal-green',
        tone === 'red' && 'text-portal-red',
        tone === 'amber' && 'text-portal-amber',
        !tone && 'text-foreground',
      )}
    >
      {value}
    </div>
    {hint && <div className="mt-1 text-xs text-grey">{hint}</div>}
  </div>
);

export const EmptyState: React.FC<{ title: string; description?: string; action?: React.ReactNode }> = ({
  title,
  description,
  action,
}) => (
  <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
    <p className="text-sm font-medium text-foreground">{title}</p>
    {description && <p className="max-w-md text-sm text-grey">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

/* ---------------------------------------------------------------- tables */

export const PortalTable: React.FC<{ head: React.ReactNode[]; children: React.ReactNode; className?: string }> = ({
  head,
  children,
  className,
}) => (
  <div className={cn('-mx-5 overflow-x-auto', className)}>
    <table className="w-full min-w-[560px] border-collapse text-sm">
      <thead>
        <tr>
          {head.map((cell, index) => (
            <th
              key={index}
              className="bg-portal-tint px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-violet first:rounded-l-none"
            >
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);

export const Row: React.FC<{ children: React.ReactNode; onClick?: () => void; className?: string }> = ({
  children,
  onClick,
  className,
}) => (
  <tr
    onClick={onClick}
    className={cn(
      'border-b border-border-color last:border-b-0',
      onClick && 'cursor-pointer transition-colors hover:bg-portal-tint/60',
      className,
    )}
  >
    {children}
  </tr>
);

export const Cell: React.FC<{ children?: React.ReactNode; className?: string; colSpan?: number }> = ({
  children,
  className,
  colSpan,
}) => (
  <td colSpan={colSpan} className={cn('px-5 py-3 align-middle text-foreground', className)}>
    {children}
  </td>
);

/* --------------------------------------------------------- stage tracker */

export const StageTracker: React.FC<{ stages: { key: string; label: string }[]; current: string }> = ({
  stages,
  current,
}) => {
  const currentIndex = stages.findIndex((stage) => stage.key === current);

  return (
    <ol className="flex items-start gap-1">
      {stages.map((stage, index) => {
        const done = currentIndex > index;
        const active = currentIndex === index;
        return (
          <li key={stage.key} className="relative flex-1 text-center">
            {index > 0 && (
              <span
                aria-hidden
                className={cn(
                  'absolute left-[-50%] top-3.5 -z-0 h-0.5 w-full',
                  done || active ? 'bg-violet' : 'bg-border-color',
                )}
              />
            )}
            <span
              className={cn(
                'relative z-10 mx-auto flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold',
                done && 'border-violet bg-violet text-white',
                active && 'border-violet bg-white text-violet',
                !done && !active && 'border-border-color bg-slate-100 text-grey',
              )}
            >
              {done ? '✓' : index + 1}
            </span>
            <span
              className={cn(
                'mt-1.5 block text-[11px] leading-tight',
                active ? 'font-semibold text-foreground' : done ? 'font-medium text-violet' : 'text-grey',
              )}
            >
              {stage.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
};

/* ----------------------------------------------------------------- stars */

export const Stars: React.FC<{ value: number; onChange?: (value: number) => void; size?: number }> = ({
  value,
  onChange,
  size = 20,
}) => (
  <div className="flex items-center gap-1">
    {[1, 2, 3, 4, 5].map((star) => {
      const filled = star <= value;
      const icon = (
        <Star
          style={{ width: size, height: size }}
          className={filled ? 'fill-amber-400 text-amber-400' : 'text-border-color'}
        />
      );
      return onChange ? (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          aria-label={`${star} out of 5`}
          className="rounded transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet"
        >
          {icon}
        </button>
      ) : (
        <span key={star}>{icon}</span>
      );
    })}
  </div>
);

/* ------------------------------------------------------------ form parts */

export const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode; className?: string }> = ({
  label,
  hint,
  children,
  className,
}) => (
  <label className={cn('block', className)}>
    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-grey">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-grey">{hint}</span>}
  </label>
);

export const inputClass =
  'w-full rounded-lg border border-border-color bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-violet focus:ring-1 focus:ring-violet';

export const PortalButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }
> = ({ variant = 'primary', className, ...props }) => (
  <button
    className={cn(
      'inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
      variant === 'primary' && 'bg-violet text-white hover:bg-violet/90',
      variant === 'secondary' && 'border border-violet bg-card text-violet hover:bg-portal-tint',
      variant === 'ghost' && 'text-grey hover:bg-slate-100 hover:text-foreground',
      variant === 'danger' && 'border border-portal-red/40 bg-card text-portal-red hover:bg-portal-red/10',
      className,
    )}
    {...props}
  />
);

export const PortalSpinner: React.FC<{ label?: string }> = ({ label }) => (
  <div className="flex items-center justify-center gap-3 py-16 text-sm text-grey">
    <span className="h-5 w-5 animate-spin rounded-full border-2 border-violet border-t-transparent" />
    {label}
  </div>
);

export const ErrorNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-lg border border-portal-red/30 bg-portal-red/5 px-4 py-3 text-sm text-portal-red">
    {children}
  </div>
);

export const InfoNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-lg bg-portal-tint px-4 py-3 text-[13px] leading-relaxed text-violet">{children}</div>
);
