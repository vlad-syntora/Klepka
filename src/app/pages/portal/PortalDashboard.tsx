import React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  GripVertical,
  RotateCcw,
  Settings2,
  X,
} from 'lucide-react';
import { usePortalData } from '@/app/hooks/use-portal-data';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import { usePortalPhase } from '@/app/hooks/use-portal-phase';
import { getDashboardLayout, loadPublicHolidays, markActivityRead, setDashboardLayout } from '@/app/lib/portal-api';
import { formatDate, formatDateTime } from '@/app/lib/portal-format';
import { projectUsesMilestones, type PublicHoliday } from '@/app/lib/portal-types';
import { KlepkaTeamWidget } from '@/app/components/portal/KlepkaTeamWidget';
import { MaterialsWidget } from '@/app/components/portal/MaterialsWidget';
import { ClientHoursReport } from '@/app/components/portal/ClientHoursReport';
import { PublicHolidaysWidget } from '@/app/components/portal/PublicHolidaysWidget';
import { ProjectTrackerWidget } from '@/app/components/portal/ProjectTrackerWidget';
import { PendingOfferWidget } from '@/app/components/portal/PendingOfferWidget';
import { CandidatesWidget } from '@/app/components/portal/CandidatesWidget';
import { EntityProductsCard } from '@/app/components/portal/EntityProductsCard';
import { EmptyState, InfoNote, PortalButton, PortalCard, StatusTag, inputClass } from '@/app/components/portal/PortalUi';
import { cn } from '@/app/components/ui/utils';

// The dashboard widgets a customer can reorder / hide once they have an active project.
type WidgetId = 'offer' | 'project' | 'team' | 'products' | 'holidays' | 'materials' | 'candidates' | 'actions' | 'activity';
// Your Klepka team sits right after Project tracking; then Products, Your materials, Public holidays.
const DEFAULT_WIDGET_ORDER: WidgetId[] = ['offer', 'project', 'team', 'products', 'materials', 'holidays', 'candidates', 'actions', 'activity'];
const WIDGET_LABELS: Record<WidgetId, string> = {
  offer: 'Offer awaiting review',
  project: 'Project tracking',
  team: 'Your Klepka team',
  products: 'Products',
  holidays: 'Public holidays',
  materials: 'Your materials',
  candidates: 'Candidates for review',
  actions: 'Action items',
  activity: 'Recent activity',
};
const isWidgetId = (value: string): value is WidgetId => (DEFAULT_WIDGET_ORDER as string[]).includes(value);

// A widget's size on the customizable grid: `w` = how many columns it spans (1–3), `h` = 1 normal
// height / 2 tall. Missing entries fall back to the widget's built-in default (see defaultSize).
type WidgetWidth = 1 | 2 | 3;
type WidgetHeight = 1 | 2;
interface WidgetSize {
  w: WidgetWidth;
  h: WidgetHeight;
}

// Static Tailwind classes for each column span (the grid is sm:2 / lg:3 columns).
const SPAN_CLASS: Record<WidgetWidth, string> = {
  1: '',
  2: 'sm:col-span-2 lg:col-span-2',
  3: 'sm:col-span-2 lg:col-span-3',
};

const clampWidth = (value: number): WidgetWidth => (value <= 1 ? 1 : value >= 3 ? 3 : 2);
const clampHeight = (value: number): WidgetHeight => (value >= 2 ? 2 : 1);

// Built-in default size for each widget, used until the client resizes it. The candidates carousel
// carries richer content, so it defaults to full width and tall; everything else is one column tall.
const DEFAULT_WIDGET_SIZE: Record<WidgetId, WidgetSize> = {
  offer: { w: 3, h: 1 },
  // Project tracking (2/3) sits beside Your Klepka team (1/3) — both tall so the team roster fits.
  project: { w: 2, h: 2 },
  team: { w: 1, h: 2 },
  products: { w: 1, h: 1 },
  holidays: { w: 1, h: 1 },
  materials: { w: 1, h: 1 },
  candidates: { w: 3, h: 2 },
  actions: { w: 2, h: 1 },
  activity: { w: 1, h: 1 },
};

interface DashboardLayoutState {
  order: WidgetId[];
  hidden: WidgetId[];
  sizes: Partial<Record<WidgetId, WidgetSize>>;
}

interface ActionItem {
  label: string;
  to: string;
  tag: string;
  tone: 'amber' | 'red' | 'violet';
}

// Give every dashboard card the same fixed height and let only its body scroll when the content
// overflows. PortalCard's root is a <section> with a <header> + a body <div>; the height/flex-col
// is gated on `:has(>div)` so it only applies while the body is present — a collapsed card renders
// just its <header> (no body div). A shared min-height on the <header> gives every card a uniform
// default height whether it's expanded or collapsed (so collapsed cards without a description don't
// end up shorter). Applied via a wrapper so it works the same for an inline PortalCard or a widget.
const FIXED_CARD =
  '[&>section:has(>div)]:flex [&>section:has(>div)]:h-[18rem] [&>section:has(>div)]:flex-col ' +
  '[&>section>header]:min-h-[4.5rem] ' +
  '[&>section>div]:min-h-0 [&>section>div]:flex-1 [&>section>div]:overflow-y-auto';

// Taller variant for Row 2: the candidates carousel carries richer content — candidate cards show
// rate, CV and a scrollable skills list — so it gets more vertical room than the other rows.
const FIXED_CARD_TALL =
  '[&>section:has(>div)]:flex [&>section:has(>div)]:h-[30rem] [&>section:has(>div)]:flex-col ' +
  '[&>section>header]:min-h-[4.5rem] ' +
  '[&>section>div]:min-h-0 [&>section>div]:flex-1 [&>section>div]:overflow-y-auto';

// Once the client is in the delivery phase the process overview has served its purpose, so we let
// them dismiss the "How this works" strip for good. The choice is remembered in localStorage.
const PROCESS_DISMISS_KEY = 'portal-process-overview-dismissed';

const readProcessDismissed = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(PROCESS_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

export const PortalDashboard: React.FC = () => {
  const { snapshot, reload } = usePortalData();
  const { user } = usePortalUser();
  const { phase, can } = usePortalPhase();
  const [markingId, setMarkingId] = React.useState<string | null>(null);
  const [processDismissed, setProcessDismissed] = React.useState(readProcessDismissed);
  // Dashboard customization (customers with an active project): editing toggle, the saved layout,
  // and the widget currently being dragged. Persisted to the user's row via the portal API.
  const [editingLayout, setEditingLayout] = React.useState(false);
  const [layout, setLayout] = React.useState<DashboardLayoutState>({ order: DEFAULT_WIDGET_ORDER, hidden: [], sizes: {} });
  const [dragId, setDragId] = React.useState<WidgetId | null>(null);
  const layoutRef = React.useRef(layout);
  React.useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  // Load the saved layout once we know the customer is eligible (has an active project).
  const hasActiveProject = !!snapshot?.projects.some((bundle) => bundle.project.status === 'active');
  React.useEffect(() => {
    if (!hasActiveProject) return;
    let cancelled = false;
    getDashboardLayout()
      .then((saved) => {
        if (cancelled || !saved) return;
        const savedOrder = saved.order.filter(isWidgetId);
        const order = [...savedOrder, ...DEFAULT_WIDGET_ORDER.filter((id) => !savedOrder.includes(id))];
        const sizes: Partial<Record<WidgetId, WidgetSize>> = {};
        for (const [key, value] of Object.entries(saved.sizes ?? {})) {
          if (isWidgetId(key)) sizes[key] = { w: clampWidth(value.w), h: clampHeight(value.h) };
        }
        setLayout({ order, hidden: saved.hidden.filter(isWidgetId), sizes });
      })
      .catch(() => {
        /* fall back to the standard layout on any read error */
      });
    return () => {
      cancelled = true;
    };
  }, [hasActiveProject]);

  // Public-holiday calendar (migration 0042) — clients only get access once qualified, so we skip the
  // fetch entirely (and hide the widget) for leads / stopped / lost accounts.
  const [holidays, setHolidays] = React.useState<PublicHoliday[]>([]);
  const lifecycle = snapshot?.account.lifecycle;
  const holidaysVisible = lifecycle === 'qualified' || lifecycle === 'proposal_sent' || lifecycle === 'live';
  React.useEffect(() => {
    if (!holidaysVisible) {
      setHolidays([]);
      return;
    }
    let cancelled = false;
    loadPublicHolidays()
      .then((rows) => {
        if (!cancelled) setHolidays(rows);
      })
      .catch(() => {
        if (!cancelled) setHolidays([]);
      });
    return () => {
      cancelled = true;
    };
  }, [holidaysVisible]);

  const saveLayout = (next: DashboardLayoutState) => {
    void setDashboardLayout(next).catch((cause) =>
      toast.error('Could not save your layout', { description: cause instanceof Error ? cause.message : undefined }),
    );
  };

  const removeWidget = (id: WidgetId) => {
    const next = { ...layout, hidden: [...layout.hidden, id] };
    setLayout(next);
    saveLayout(next);
  };

  const addWidget = (id: WidgetId) => {
    const next = { ...layout, hidden: layout.hidden.filter((entry) => entry !== id) };
    setLayout(next);
    saveLayout(next);
  };

  // Resize a widget (width step and/or height toggle), persisting the new size right away.
  const setSize = (id: WidgetId, size: WidgetSize) => {
    const next: DashboardLayoutState = { ...layout, sizes: { ...layout.sizes, [id]: size } };
    setLayout(next);
    saveLayout(next);
  };

  // Reorder live while dragging; the save happens once on drop (see handleDragEnd).
  const moveBefore = (dragged: WidgetId, target: WidgetId) => {
    if (dragged === target) return;
    setLayout((prev) => {
      const order = prev.order.filter((entry) => entry !== dragged);
      order.splice(order.indexOf(target), 0, dragged);
      return { ...prev, order };
    });
  };

  const handleDragEnd = () => {
    setDragId(null);
    saveLayout(layoutRef.current);
  };

  // "Set default view": clear the stored layout and return to the standard order, sizes and visibility.
  const resetLayout = () => {
    const next: DashboardLayoutState = { order: DEFAULT_WIDGET_ORDER, hidden: [], sizes: {} };
    setLayout(next);
    void setDashboardLayout(null).catch((cause) =>
      toast.error('Could not reset your layout', { description: cause instanceof Error ? cause.message : undefined }),
    );
  };

  const dismissProcess = () => {
    setProcessDismissed(true);
    try {
      window.localStorage.setItem(PROCESS_DISMISS_KEY, '1');
    } catch {
      /* storage unavailable (private mode / quota) — fall back to in-memory only */
    }
  };

  const markRead = async (id: string) => {
    setMarkingId(id);
    try {
      await markActivityRead([id]);
      await reload();
    } catch (cause) {
      toast.error('Could not mark as read', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setMarkingId(null);
    }
  };

  if (!snapshot || !user) return null;

  const { account, offers, invoices, milestones, activity, candidates, resources, intake, opportunities } = snapshot;

  const unreadCount = activity.filter((entry) => !entry.read_by.includes(user.id)).length;

  // Candidates awaiting review keep the widget prominent (top of the left column);
  // once nothing is pending it drops under "Your Klepka team" in the side column.
  const hasPendingCandidates = candidates.some((candidate) => candidate.status === 'proposed');
  const hasConfirmedCandidates = candidates.some((candidate) => candidate.status === 'confirmed');

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const isOverdue = (dueDate: string | null) => !!dueDate && new Date(dueDate) < startOfToday;

  const actionItems: ActionItem[] = [
    // Presentations: nudge to review the shared materials while onboarding.
    ...(phase === 'onboarding' && resources.some((resource) => resource.kind !== 'article')
      ? [
          {
            label: 'Review your presentations',
            to: '/portal/start',
            tag: 'Review',
            tone: 'violet',
          } as ActionItem,
        ]
      : []),
    // Information gathering: stages that still need the client's input — only while the
    // Information gathering tab is actually visible (same gating as the welcome widget).
    ...(can('intake')
      ? intake
          .filter(
            (item) =>
              item.owner_side === 'client' &&
              ['not_started', 'in_progress', 'blocked'].includes(item.status),
          )
          .map<ActionItem>((item) => ({
            label: `Information gathering: ${item.name}`,
            to: '/portal/intake',
            tag: isOverdue(item.due_date) ? 'Overdue' : 'Needs input',
            tone: isOverdue(item.due_date) ? 'red' : 'amber',
          }))
      : []),
    // Offer/SOW review: only surfaced once the opportunity (pipeline) tab is visible to the
    // client — the action item links there, so it must not appear before the tab does.
    ...(can('pipeline')
      ? offers
          .filter((offer) => offer.status === 'sent')
          .map<ActionItem>((offer) => ({
            label: `Review ${offer.title} (v${offer.version})`,
            to: '/portal/pipeline',
            tag: 'Needs review',
            tone: 'amber',
          }))
      : []),
    ...invoices
      .filter((invoice) => invoice.status === 'overdue' || invoice.status === 'due')
      .map<ActionItem>((invoice) => ({
        label: `${invoice.description || invoice.number || 'Invoice'} — due ${formatDate(invoice.due_date)}`,
        to: '/portal/payments',
        tag: invoice.status === 'overdue' ? 'Overdue' : 'Payment due',
        tone: invoice.status === 'overdue' ? 'red' : 'amber',
      })),
    ...milestones
      .filter((milestone) => milestone.status === 'complete')
      .map<ActionItem>((milestone) => ({
        label: `Approve milestone: ${milestone.name}`,
        to: '/portal/project',
        tag: 'Approval needed',
        tone: 'violet',
      })),
  ];

  // A thin "How this works" strip; dismissable for good once in delivery. Optional trailing controls
  // (the dashboard Customize buttons) share the same row, right-aligned. When the strip is dismissed
  // we still render the trailing controls on their own so Customize never disappears.
  const renderHeaderStrip = (trailing?: React.ReactNode) => {
    if (processDismissed) {
      return trailing ? (
        <div className="flex flex-wrap items-center justify-end gap-2">{trailing}</div>
      ) : null;
    }
    return (
    <PortalCard bodyClassName="py-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <h2 className="shrink-0 text-[15px] font-semibold text-violet">How this works</h2>
        <ol className="flex flex-1 items-center gap-2 overflow-x-auto pb-0.5 text-sm">
          {(['Getting started', 'Information gathering', 'Proposal', 'Delivery'] as const).map((label, index) => {
            const order = ['onboarding', 'discovery', 'proposal', 'delivery'];
            const current = order.indexOf(phase) === index;
            const done = order.indexOf(phase) > index;
            return (
              <React.Fragment key={label}>
                <li className="flex shrink-0 items-center gap-2.5">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      done
                        ? 'bg-violet text-white'
                        : current
                          ? 'border-2 border-violet bg-white text-violet'
                          : 'bg-slate-100 text-grey'
                    }`}
                  >
                    {done ? '✓' : index + 1}
                  </span>
                  <span
                    className={`whitespace-nowrap ${current ? 'font-semibold text-foreground' : 'font-medium text-grey'}`}
                  >
                    {label}
                  </span>
                </li>
                {index < 3 && <ChevronRight className="h-4 w-4 shrink-0 text-grey" />}
              </React.Fragment>
            );
          })}
        </ol>
        {phase === 'delivery' && (
          <button
            type="button"
            onClick={dismissProcess}
            aria-label="Dismiss this overview"
            title="Dismiss — you won’t see this again"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-grey transition-colors hover:bg-portal-tint hover:text-violet"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {trailing && <div className="flex flex-wrap items-center gap-2">{trailing}</div>}
      </div>
    </PortalCard>
    );
  };

  // Each dashboard widget's rendered content, kept as consts so the standard and customizable
  // layouts below share one source of truth.
  const offerNode = (
    <PendingOfferWidget
      offers={offers}
      opportunities={opportunities}
      documents={snapshot.documents}
      onReload={reload}
    />
  );

  const projectNode = <ProjectTrackerWidget projects={snapshot.projects} documents={snapshot.documents} />;
  // The Reports section is only worth showing once the client has approved hours to look at.
  const hasApprovedHours = snapshot.projects.some((bundle) => bundle.timeEntries.some((entry) => entry.approved));
  // Without a milestone tracker the Project widget carries far less content, so it defaults smaller.
  const projectHasMilestones = snapshot.projects.some((bundle) => projectUsesMilestones(bundle.project.project_type));
  const defaultSizeFor = (id: WidgetId): WidgetSize =>
    id === 'project' && !projectHasMilestones ? { w: 2, h: 1 } : DEFAULT_WIDGET_SIZE[id];

  const materialsNode = <MaterialsWidget resources={resources} />;

  const holidaysNode = <PublicHolidaysWidget holidays={holidays} />;

  const productsNode = (
    <EntityProductsCard
      entity="account"
      id={account.id}
      title="Products"
      description="Products associated with your account."
    />
  );

  const teamNode =
    account.owner ||
    snapshot.klepkaTeam.length > 0 ||
    snapshot.projects.some((entry) => entry.team.length > 0) ||
    hasConfirmedCandidates ? (
      <KlepkaTeamWidget
        owner={account.owner}
        klepkaTeam={snapshot.klepkaTeam}
        projects={snapshot.projects}
        candidates={candidates}
        opportunities={opportunities}
      />
    ) : (
      <PortalCard title="Your Klepka Team">
        <p className="text-sm text-grey">Your team is assigned at kickoff — you’ll see everyone here.</p>
      </PortalCard>
    );

  const candidatesNode = <CandidatesWidget candidates={candidates} />;

  const actionsNode = (
    <PortalCard title="Action items" description="Everything waiting on you right now">
      {actionItems.length === 0 ? (
        <EmptyState title="Nothing needs your attention" description="We’ll flag anything new here." />
      ) : (
        <ul className="divide-y divide-border-color">
          {actionItems.map((item, index) => (
            <li key={index}>
              <Link
                to={item.to}
                className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 text-sm transition-colors hover:bg-portal-tint/60"
              >
                <span className="min-w-0 truncate">{item.label}</span>
                <StatusTag tone={item.tone}>{item.tag}</StatusTag>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PortalCard>
  );

  const activityNode = (
    <PortalCard
      title="Recent activity"
      keepActionWhenCollapsed
      action={
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="rounded-full bg-accent-yellow px-2 py-0.5 text-[11px] font-bold text-violet">
              {unreadCount} new
            </span>
          )}
          <Link to="/portal/notifications" className="text-xs font-medium text-violet hover:underline">
            View all
          </Link>
        </div>
      }
    >
      {activity.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <ul className="space-y-3">
          {activity.slice(0, 10).map((entry) => {
            const unread = !entry.read_by.includes(user.id);
            return (
              <li key={entry.id} className="flex gap-3 text-sm">
                <span
                  className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', unread ? 'bg-violet' : 'bg-border-color')}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className={cn('min-w-0 truncate', unread ? 'font-semibold text-foreground' : 'font-medium text-grey')}>
                      {entry.title}
                    </div>
                    {unread && (
                      <span className="shrink-0 rounded-full bg-portal-tint px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet">
                        New
                      </span>
                    )}
                  </div>
                  {entry.detail && <div className="text-grey">{entry.detail}</div>}
                  <div className="text-xs text-grey">{formatDateTime(entry.created_at)}</div>
                </div>
                {unread && (
                  <button
                    type="button"
                    onClick={() => markRead(entry.id)}
                    disabled={markingId === entry.id}
                    aria-label="Mark as read"
                    title="Mark as read"
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-grey transition-colors hover:bg-portal-tint hover:text-violet disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PortalCard>
  );

  const widgets: Record<WidgetId, { node: React.ReactNode; available: boolean }> = {
    offer: { node: offerNode, available: offers.some((offer) => offer.status === 'sent') },
    project: { node: projectNode, available: snapshot.projects.length > 0 },
    team: { node: teamNode, available: true },
    products: { node: productsNode, available: true },
    holidays: { node: holidaysNode, available: holidaysVisible },
    materials: { node: materialsNode, available: resources.some((resource) => resource.kind !== 'article') },
    candidates: { node: candidatesNode, available: hasPendingCandidates },
    actions: { node: actionsNode, available: true },
    activity: { node: activityNode, available: true },
  };

  // Standard fixed layout for customers without an active project.
  if (!hasActiveProject) {
    // Project tracking (2/3) sits beside Your Klepka team (1/3); when the project carries a milestone
    // tracker both cards take the taller height so the team's per-project roster isn't cut off.
    const projectRowClass = projectHasMilestones ? FIXED_CARD_TALL : FIXED_CARD;
    return (
      <div className="space-y-2">
        {renderHeaderStrip()}
        {widgets.offer.available && offerNode}
        {/* Row 1: Project tracking (2/3) beside Your Klepka team (1/3). */}
        <div className="grid items-start gap-2 lg:grid-cols-3">
          {widgets.project.available && (
            <div className={cn(projectRowClass, 'lg:col-span-2')}>{projectNode}</div>
          )}
          <div className={projectRowClass}>{teamNode}</div>
        </div>
        {/* Reports: total summaries, then charts of approved hours (bar by date + donut per project),
            full width and collapsible. */}
        {hasApprovedHours && <ClientHoursReport projects={snapshot.projects} />}
        {/* Row 2: Products, then Your materials, then the public-holiday calendar. */}
        <div className="grid items-start gap-2 lg:grid-cols-3">
          <div className={FIXED_CARD}>{productsNode}</div>
          {widgets.materials.available && <div className={FIXED_CARD}>{materialsNode}</div>}
          {holidaysVisible && <div className={FIXED_CARD}>{holidaysNode}</div>}
        </div>
        {widgets.candidates.available && <div className={FIXED_CARD_TALL}>{candidatesNode}</div>}
        <div className="grid items-start gap-2 lg:grid-cols-3">
          <div className={cn(FIXED_CARD, 'lg:col-span-2')}>{actionsNode}</div>
          <div className={FIXED_CARD}>{activityNode}</div>
        </div>
      </div>
    );
  }

  // Customizable layout (active-project customers): reorder, hide/show and reset — saved per user.
  const visibleIds = layout.order.filter((id) => widgets[id].available && !layout.hidden.includes(id));
  const addableIds = layout.order.filter((id) => widgets[id].available && layout.hidden.includes(id));

  // The Customize controls, rendered on the right of the "How this works" row (see renderHeaderStrip).
  const customizeControls = (
    <>
      {editingLayout && addableIds.length > 0 && (
        <select
          className={`${inputClass} w-auto py-1.5 text-xs`}
          value=""
          onChange={(event) => {
            if (isWidgetId(event.target.value)) addWidget(event.target.value);
          }}
        >
          <option value="">Add widget…</option>
          {addableIds.map((id) => (
            <option key={id} value={id}>
              {WIDGET_LABELS[id]}
            </option>
          ))}
        </select>
      )}
      {editingLayout && (
        <PortalButton variant="ghost" onClick={resetLayout}>
          <RotateCcw className="h-4 w-4" /> Set default view
        </PortalButton>
      )}
      <PortalButton variant="secondary" onClick={() => setEditingLayout((value) => !value)}>
        <Settings2 className="h-4 w-4" /> {editingLayout ? 'Done' : 'Customize'}
      </PortalButton>
    </>
  );

  return (
    <div className="space-y-2">
      {renderHeaderStrip(customizeControls)}

      {/* Charts of approved hours (bar by date + donut per project), full width and collapsible. */}
      {hasApprovedHours && <ClientHoursReport projects={snapshot.projects} />}

      <div className="grid items-start gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {visibleIds.map((id) => {
          const widget = widgets[id];
          const size = layout.sizes[id] ?? defaultSizeFor(id);
          return (
            <div
              key={id}
              draggable={editingLayout}
              onDragStart={() => setDragId(id)}
              onDragOver={(event) => {
                if (editingLayout && dragId && dragId !== id) {
                  event.preventDefault();
                  moveBefore(dragId, id);
                }
              }}
              onDrop={handleDragEnd}
              onDragEnd={handleDragEnd}
              className={cn(
                'relative',
                SPAN_CLASS[size.w],
                size.h === 2 ? FIXED_CARD_TALL : FIXED_CARD,
                editingLayout && 'rounded-xl ring-2 ring-violet/30',
                dragId === id && 'opacity-60',
              )}
            >
              {editingLayout && (
                <div className="absolute right-2 top-2 z-20 flex items-center gap-1">
                  {/* Width: narrower / wider (1–3 columns). */}
                  <div className="flex items-center rounded-full bg-card/90 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setSize(id, { ...size, w: clampWidth(size.w - 1) })}
                      disabled={size.w <= 1}
                      title="Narrower"
                      aria-label={`Make ${WIDGET_LABELS[id]} narrower`}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-grey transition-colors hover:text-violet disabled:opacity-30"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="min-w-[1.75rem] text-center text-[11px] font-semibold text-grey" title="Width">
                      {size.w}/3
                    </span>
                    <button
                      type="button"
                      onClick={() => setSize(id, { ...size, w: clampWidth(size.w + 1) })}
                      disabled={size.w >= 3}
                      title="Wider"
                      aria-label={`Make ${WIDGET_LABELS[id]} wider`}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-grey transition-colors hover:text-violet disabled:opacity-30"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  {/* Height: toggle normal / tall. */}
                  <button
                    type="button"
                    onClick={() => setSize(id, { ...size, h: size.h === 2 ? 1 : 2 })}
                    title={size.h === 2 ? 'Shorter' : 'Taller'}
                    aria-label={size.h === 2 ? `Make ${WIDGET_LABELS[id]} shorter` : `Make ${WIDGET_LABELS[id]} taller`}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-card/90 text-grey shadow-sm transition-colors hover:text-violet"
                  >
                    {size.h === 2 ? <ChevronsDownUp className="h-4 w-4" /> : <ChevronsUpDown className="h-4 w-4" />}
                  </button>
                  <span
                    className="flex h-7 w-7 cursor-grab items-center justify-center rounded-full bg-card/90 text-grey shadow-sm active:cursor-grabbing"
                    title="Drag to reorder"
                    aria-hidden
                  >
                    <GripVertical className="h-4 w-4" />
                  </span>
                  <button
                    type="button"
                    onClick={() => removeWidget(id)}
                    title={`Hide ${WIDGET_LABELS[id]}`}
                    aria-label={`Hide ${WIDGET_LABELS[id]}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-card/90 text-grey shadow-sm transition-colors hover:text-portal-red"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {widget.node}
            </div>
          );
        })}
      </div>

      {editingLayout && (
        <InfoNote>
          Drag cards to reorder them, resize each with the width and height controls, hide any you don’t need, and add
          them back from “Add widget”. “Set default view” restores the standard layout and sizes.
        </InfoNote>
      )}
    </div>
  );
};
