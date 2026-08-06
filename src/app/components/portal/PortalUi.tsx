import React from 'react';
import { Calendar, ChevronDown, ChevronsUpDown, ChevronUp, Star, X } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';

/**
 * A compact calendar-icon date filter: just an icon that opens the native date picker on click — a
 * space-saving stand-in for a full `<input type="date">` in tight headers. When a date is picked the
 * icon stays highlighted (tinted + violet border) rather than printing the date, so the control keeps
 * a fixed width. The chosen date is surfaced via the button's title/tooltip.
 */
export const IconDateButton: React.FC<{
  value: string;
  onChange: (value: string) => void;
  label: string;
}> = ({ value, onChange, label }) => {
  const ref = React.useRef<HTMLInputElement>(null);
  const open = () => {
    const input = ref.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  };
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={open}
        title={value ? `${label}: ${value}` : label}
        aria-label={value ? `${label}: ${value}` : label}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-md border text-xs transition-colors',
          value
            ? 'border-violet bg-portal-tint text-violet'
            : 'border-border-color text-grey hover:border-violet',
        )}
      >
        <Calendar className="h-4 w-4" />
      </button>
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none absolute bottom-0 left-0 h-0 w-0 opacity-0"
      />
    </span>
  );
};

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

// When enabled, every PortalCard with a title renders collapsible and toggleable. Scoped by the
// <CollapsibleCards> provider so it only affects the trees that opt in (e.g. the admin account
// workspace) — the client portal is unaffected. `scope` namespaces the persisted open/closed
// state so different accounts/tabs remember their sections independently.
interface CardCollapseState {
  enabled: boolean;
  scope: string;
  /** State a card starts in the first time it's seen (before the user has toggled it). */
  defaultOpen: boolean;
}
const CardCollapseContext = React.createContext<CardCollapseState>({
  enabled: false,
  scope: '',
  defaultOpen: false,
});

/**
 * Wrap a region so its PortalCards become collapsible sections. Each card remembers whether it
 * was left open or closed (persisted in localStorage under `scope`), so the layout is restored on
 * the next visit. Pass a stable `scope` (e.g. account id + tab) to keep those memories separate.
 * `defaultOpen` sets the starting state before the user has toggled a section (admin defaults to
 * collapsed; the client portal opens everything by default).
 */
export const CollapsibleCards: React.FC<{
  children: React.ReactNode;
  scope?: string;
  defaultOpen?: boolean;
}> = ({ children, scope = '', defaultOpen = false }) => (
  <CardCollapseContext.Provider value={{ enabled: true, scope, defaultOpen }}>
    {children}
  </CardCollapseContext.Provider>
);

/** Turn a card title / explicit key into a filesystem-safe token for the storage key. */
function collapseToken(value: React.ReactNode): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

export const PortalCard: React.FC<{
  title?: React.ReactNode;
  /**
   * Header actions. Pass a render function to react to the card's collapsed state — e.g. keep an
   * "Add" button visible while collapsed (with `keepActionWhenCollapsed`) but only show a filter
   * once the card is open.
   */
  action?: React.ReactNode | ((state: { open: boolean }) => React.ReactNode);
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Opt this card out of the CollapsibleCards behaviour — it stays expanded and non-toggleable. */
  alwaysOpen?: boolean;
  /** Stable identifier for persisting the open/closed state when a title isn't a plain string. */
  collapseKey?: string;
  /** Keep the header `action` visible even while collapsed (e.g. an unread badge + "View all"). */
  keepActionWhenCollapsed?: boolean;
}> = ({
  title,
  action,
  description,
  children,
  className,
  bodyClassName,
  alwaysOpen,
  collapseKey,
  keepActionWhenCollapsed,
}) => {
  const { enabled: collapseEnabled, scope, defaultOpen } = React.useContext(CardCollapseContext);
  const collapsible = !alwaysOpen && collapseEnabled && Boolean(title);

  // A stable key lets each section remember whether the user left it open or closed.
  const token = collapseKey ?? collapseToken(title);
  const storageKey = collapsible && token ? `portal-card:${scope}:${token}` : null;

  const [open, setOpen] = React.useState<boolean>(() => {
    if (!storageKey || typeof window === 'undefined') return defaultOpen;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === '1') return true;
      if (stored === '0') return false;
      return defaultOpen;
    } catch {
      return defaultOpen;
    }
  });

  const toggle = () =>
    setOpen((value) => {
      const next = !value;
      if (storageKey) {
        try {
          window.localStorage.setItem(storageKey, next ? '1' : '0');
        } catch {
          /* storage unavailable (private mode / quota) — fall back to in-memory only */
        }
      }
      return next;
    });

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
              onClick={toggle}
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
          {/* Actions belong to the open section — hide them while collapsed, unless the card asks
              to keep them (e.g. an unread badge that must stay visible when Recent activity is folded).
              A function action can further tailor what it shows to the open state. */}
          {action && (showBody || keepActionWhenCollapsed) && (
            <div className="flex shrink-0 items-center gap-2">
              {typeof action === 'function' ? action({ open: showBody }) : action}
            </div>
          )}
        </header>
      )}
      {showBody && <div className={cn('px-5 py-4', bodyClassName)}>{children}</div>}
    </section>
  );
};

export const StatTile: React.FC<{
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  hint?: string;
  /** Lay the label and value on one row (a shorter tile) instead of stacking them. */
  compact?: boolean;
}> = ({ label, value, tone, hint, compact }) => {
  const valueColor = cn(
    tone === 'green' && 'text-portal-green',
    tone === 'red' && 'text-portal-red',
    tone === 'amber' && 'text-portal-amber',
    tone === 'violet' && 'text-violet',
    (!tone || tone === 'grey') && 'text-foreground',
  );

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border-color bg-card px-4 py-2.5 shadow-sm">
        <span className="text-xs uppercase tracking-wide text-grey">{label}</span>
        <span className="flex items-center gap-2 text-right">
          <span className={cn('text-sm font-semibold', valueColor)}>{value}</span>
          {hint && <span className="text-[11px] text-grey">{hint}</span>}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-color bg-card px-5 py-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-grey">{label}</div>
      <div className={cn('mt-1 text-2xl font-semibold', valueColor)}>{value}</div>
      {hint && <div className="mt-1 text-xs text-grey">{hint}</div>}
    </div>
  );
};

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

export const PortalTable: React.FC<{
  head: React.ReactNode[];
  children: React.ReactNode;
  className?: string;
  /** Tighter row/header padding so more rows fit in a fixed-height, scrolling card. */
  dense?: boolean;
}> = ({ head, children, className, dense }) => (
  <div
    className={cn(
      '-mx-5 overflow-x-auto',
      dense && '[&_td]:py-1.5 [&_th]:py-2',
      className,
    )}
  >
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

export const Row: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  draggable?: boolean;
  onDragStart?: React.DragEventHandler<HTMLTableRowElement>;
  onDragOver?: React.DragEventHandler<HTMLTableRowElement>;
  onDrop?: React.DragEventHandler<HTMLTableRowElement>;
  onDragEnd?: React.DragEventHandler<HTMLTableRowElement>;
}> = ({ children, onClick, className, draggable, onDragStart, onDragOver, onDrop, onDragEnd }) => (
  <tr
    onClick={onClick}
    draggable={draggable}
    onDragStart={onDragStart}
    onDragOver={onDragOver}
    onDrop={onDrop}
    onDragEnd={onDragEnd}
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

/* --------------------------------------------------------- sortable list */

export type SortDir = 'asc' | 'desc';
export interface SortState {
  key: string;
  dir: SortDir;
}

/** null/undefined always sort last; numbers compare numerically, everything else naturally. */
function compareSortable(a: string | number | null | undefined, b: string | number | null | undefined): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Client-side column sorting for a list view. Pass the rows and an accessor per sortable column
 * key; clicking a column toggles asc → desc → asc. Returns the sorted rows plus the state and a
 * `toggle` to wire into <SortHeader>. Lists here are small, so the sort recomputes whenever the
 * inline `accessors` object changes identity — callers needn't memoise it.
 */
export function useTableSort<T>(
  rows: T[],
  accessors: Record<string, (row: T) => string | number | null | undefined>,
  initial: SortState | null = null,
): { sorted: T[]; sort: SortState | null; toggle: (key: string) => void } {
  const [sort, setSort] = React.useState<SortState | null>(initial);

  const toggle = React.useCallback((key: string) => {
    setSort((prev) => (prev && prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  }, []);

  const sorted = React.useMemo(() => {
    if (!sort) return rows;
    const accessor = accessors[sort.key];
    if (!accessor) return rows;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => factor * compareSortable(accessor(a), accessor(b)));
  }, [rows, sort, accessors]);

  return { sorted, sort, toggle };
}

/** A clickable column header for a sortable table. Drop into a PortalTable `head` array. */
export const SortHeader: React.FC<{
  label: React.ReactNode;
  sortKey: string;
  sort: SortState | null;
  onSort: (key: string) => void;
  className?: string;
}> = ({ label, sortKey, sort, onSort, className }) => {
  const active = sort?.key === sortKey;
  const Icon = active ? (sort!.dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-label={`Sort by ${typeof label === 'string' ? label : sortKey}`}
      className={cn(
        'group -mx-1 inline-flex items-center gap-1 rounded px-1 text-left uppercase tracking-wide text-violet transition-colors hover:text-violet/70',
        className,
      )}
    >
      {label}
      <Icon className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-violet' : 'text-grey/50 group-hover:text-grey')} />
    </button>
  );
};

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

/* ---------------------------------------------------------------- modal */

/**
 * A centered, backdrop-dismissable modal. Renders nothing when closed; locks body scroll and
 * closes on Escape or a genuine backdrop click while open. Header shows `title`/`description` and a
 * close button; children are the body.
 */
export const PortalModal: React.FC<{
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}> = ({ open, onClose, title, description, children, className }) => {
  // Only a press that both starts and ends on the backdrop should dismiss — dragging a scrollbar or
  // selecting text that ends over the backdrop must not close the modal.
  const pressOnBackdrop = React.useRef(false);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        pressOnBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && pressOnBackdrop.current) onClose();
        pressOnBackdrop.current = false;
      }}
    >
      <div
        className={cn('my-auto w-full max-w-xl overflow-hidden rounded-xl bg-card shadow-xl', className)}
        onClick={(event) => event.stopPropagation()}
      >
        {(title || description) && (
          <header className="flex items-center justify-between gap-3 border-b border-border-color px-5 py-4">
            <div className="min-w-0">
              {title && <h2 className="text-[15px] font-semibold text-violet">{title}</h2>}
              {description && <p className="mt-0.5 text-xs text-grey">{description}</p>}
            </div>
            <PortalButton variant="ghost" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </PortalButton>
          </header>
        )}
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
};
