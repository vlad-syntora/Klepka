import React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarPlus, Check } from 'lucide-react';
import { usePortalData } from '@/app/hooks/use-portal-data';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import { usePortalPhase } from '@/app/hooks/use-portal-phase';
import { markActivityRead } from '@/app/lib/portal-api';
import { formatDate, formatDateTime } from '@/app/lib/portal-format';
import { PHASE_BLURB, PHASE_LABELS } from '@/app/lib/portal-phase';
import { KlepkaTeamWidget } from '@/app/components/portal/KlepkaTeamWidget';
import { CandidatesWidget } from '@/app/components/portal/CandidatesWidget';
import { BookCallButton } from '@/app/components/portal/BookCallButton';
import { EmptyState, PortalButton, PortalCard, StatusTag } from '@/app/components/portal/PortalUi';
import { cn } from '@/app/components/ui/utils';

interface ActionItem {
  label: string;
  to: string;
  tag: string;
  tone: 'amber' | 'red' | 'violet';
}

export const PortalDashboard: React.FC = () => {
  const { snapshot, reload } = usePortalData();
  const { user } = usePortalUser();
  const { phase, can } = usePortalPhase();
  const [markingId, setMarkingId] = React.useState<string | null>(null);

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

  const { account, offers, invoices, milestones, activity, candidates, resources, intake } = snapshot;

  const unreadCount = activity.filter((entry) => !entry.read_by.includes(user.id)).length;

  // Candidates awaiting review keep the widget prominent (top of the left column);
  // once nothing is pending it drops under "Your Klepka team" in the side column.
  const hasPendingCandidates = candidates.some((candidate) => candidate.status === 'proposed');

  const openIntake = intake.filter((item) => item.owner_side === 'client' && item.status !== 'approved');

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const isOverdue = (dueDate: string | null) => !!dueDate && new Date(dueDate) < startOfToday;

  const actionItems: ActionItem[] = [
    // Getting started: nudge to review the shared materials while onboarding.
    ...(phase === 'onboarding' && resources.some((resource) => resource.kind !== 'article')
      ? [
          {
            label: 'Review your getting-started materials',
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

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-xl bg-gradient-to-br from-violet to-[#9C63C9] px-6 py-5 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-widest text-white/80">{PHASE_LABELS[phase]}</div>
          <h2 className="mt-1 text-xl font-semibold">Welcome, {account.name}</h2>
          <p className="mt-1.5 max-w-2xl text-sm text-white/90">{PHASE_BLURB[phase]}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          <BookCallButton variant="primary" className="bg-white text-violet hover:bg-accent-yellow">
            <CalendarPlus className="h-4 w-4" /> Book an intro call
          </BookCallButton>
          {can('intake') && openIntake.length > 0 && (
            <Link to="/portal/intake">
              <PortalButton className="border border-white/60 bg-transparent text-white hover:bg-white/15">
                {openIntake.length} item{openIntake.length > 1 ? 's' : ''} need your input
              </PortalButton>
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {hasPendingCandidates && <CandidatesWidget candidates={candidates} />}

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
        </div>

        <div className="space-y-5">
          <PortalCard title="How this works">
            <ol className="space-y-3 text-sm">
              {(
                [
                  ['Getting started', 'Explore the material and meet the team.'],
                  ['Information gathering', 'We collect what we need to scope the work.'],
                  ['Proposal', 'You review, comment and accept — or ask for changes.'],
                  ['Delivery', 'Milestones, hours and invoices, tracked here.'],
                ] as const
              ).map(([title, blurb], index) => {
                const order = ['onboarding', 'discovery', 'proposal', 'delivery'];
                const current = order.indexOf(phase) === index;
                const done = order.indexOf(phase) > index;
                return (
                  <li key={title} className="flex gap-3">
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        done
                          ? 'bg-violet text-white'
                          : current
                            ? 'border-2 border-violet bg-white text-violet'
                            : 'bg-slate-100 text-grey'
                      }`}
                    >
                      {done ? '✓' : index + 1}
                    </span>
                    <span>
                      <span className={current ? 'block font-semibold' : 'block font-medium'}>{title}</span>
                      <span className="block text-xs text-grey">{blurb}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </PortalCard>

          {account.owner || snapshot.klepkaTeam.length > 0 || snapshot.projects.some((entry) => entry.team.length > 0) ? (
            <KlepkaTeamWidget owner={account.owner} klepkaTeam={snapshot.klepkaTeam} projects={snapshot.projects} />
          ) : (
            <PortalCard title="Your Klepka team">
              <p className="text-sm text-grey">Your team is assigned at kickoff — you’ll see everyone here.</p>
            </PortalCard>
          )}

          {!hasPendingCandidates && <CandidatesWidget candidates={candidates} />}

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
                        className={cn(
                          'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                          unread ? 'bg-violet' : 'bg-border-color',
                        )}
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
        </div>
      </div>
    </div>
  );
};
