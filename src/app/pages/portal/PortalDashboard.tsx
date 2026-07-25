import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarPlus } from 'lucide-react';
import { usePortalData } from '@/app/hooks/use-portal-data';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import { formatDate, formatDateTime } from '@/app/lib/portal-format';
import { LIFECYCLE_LABELS, MEETING_TYPE_LABELS } from '@/app/lib/portal-types';
import { KlepkaTeamWidget } from '@/app/components/portal/KlepkaTeamWidget';
import { CandidatesWidget } from '@/app/components/portal/CandidatesWidget';
import {
  EmptyState,
  PortalButton,
  PortalCard,
  StatusTag,
  humanize,
  toneFor,
} from '@/app/components/portal/PortalUi';

interface ActionItem {
  label: string;
  to: string;
  tag: string;
  tone: 'amber' | 'red' | 'violet';
}

const STATUS_HEADLINE: Record<string, string> = {
  lead: 'Welcome — let’s get started',
  qualified: 'Solution design in progress',
  proposal_sent: 'Proposal sent — awaiting your review',
  live: 'Live and supported',
  stopped: 'Project wrapped up',
  lost: 'Account archived',
};

export const PortalDashboard: React.FC = () => {
  const { snapshot } = usePortalData();
  const { user } = usePortalUser();
  if (!snapshot || !user) return null;

  const { account, offers, documents, invoices, meetings, milestones, activity, candidates } = snapshot;

  const upcoming = meetings
    .filter((meeting) => ['requested', 'confirmed'].includes(meeting.status) && new Date(meeting.starts_at) >= new Date())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const openOffer = offers.find((offer) => offer.status === 'sent');

  const actionItems: ActionItem[] = [
    ...offers
      .filter((offer) => offer.status === 'sent')
      .map<ActionItem>((offer) => ({
        label: `Review ${offer.title} (v${offer.version})`,
        to: '/portal/pipeline',
        tag: 'Needs review',
        tone: 'amber',
      })),
    ...documents
      .filter((doc) => doc.status === 'awaiting_signature')
      .map<ActionItem>((doc) => ({
        label: `Sign ${doc.name}`,
        to: '/portal/documents',
        tag: 'Signature required',
        tone: 'red',
      })),
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
    ...meetings
      .filter((meeting) => meeting.status === 'requested')
      .map<ActionItem>((meeting) => ({
        label: `${meeting.title} — awaiting confirmation`,
        to: '/portal/calls',
        tag: 'Pending',
        tone: 'violet',
      })),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-gradient-to-br from-violet to-[#9C63C9] px-6 py-5 text-white shadow-sm">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-widest text-white/80">
            Current stage — {LIFECYCLE_LABELS[account.lifecycle]}
          </div>
          <div className="mt-1 text-lg font-semibold">{STATUS_HEADLINE[account.lifecycle]}</div>
        </div>
        {openOffer ? (
          <Link to="/portal/pipeline">
            <PortalButton className="bg-white text-violet hover:bg-accent-yellow">
              Review offer <ArrowRight className="h-4 w-4" />
            </PortalButton>
          </Link>
        ) : (
          <Link to="/portal/calls">
            <PortalButton className="bg-white text-violet hover:bg-accent-yellow">
              <CalendarPlus className="h-4 w-4" /> Book a call
            </PortalButton>
          </Link>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
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

          <PortalCard
            title="Recent activity"
            action={
              <Link to="/portal/notifications" className="text-xs font-medium text-violet hover:underline">
                View all
              </Link>
            }
          >
            {activity.length === 0 ? (
              <EmptyState title="No activity yet" />
            ) : (
              <ul className="space-y-3">
                {activity.slice(0, 10).map((entry) => (
                  <li key={entry.id} className="flex gap-3 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet" />
                    <div className="min-w-0">
                      <div className="font-medium text-foreground">{entry.title}</div>
                      {entry.detail && <div className="text-grey">{entry.detail}</div>}
                      <div className="text-xs text-grey">{formatDateTime(entry.created_at)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PortalCard>
        </div>

        <div className="space-y-5">
          <PortalCard title="Upcoming calls">
            {upcoming.length === 0 ? (
              <EmptyState title="No calls booked" />
            ) : (
              <ul className="divide-y divide-border-color">
                {upcoming.slice(0, 4).map((meeting) => (
                  <li key={meeting.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{meeting.title}</div>
                      <div className="text-xs text-grey">
                        {formatDateTime(meeting.starts_at)} · {MEETING_TYPE_LABELS[meeting.meeting_type]}
                      </div>
                    </div>
                    <StatusTag tone={toneFor(meeting.status)}>{humanize(meeting.status)}</StatusTag>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/portal/calls" className="mt-3 block">
              <PortalButton variant="secondary" className="w-full">
                <CalendarPlus className="h-4 w-4" /> Schedule a call
              </PortalButton>
            </Link>
          </PortalCard>

          {account.owner || snapshot.klepkaTeam.length > 0 || snapshot.projects.some((entry) => entry.team.length > 0) ? (
            <KlepkaTeamWidget owner={account.owner} klepkaTeam={snapshot.klepkaTeam} projects={snapshot.projects} />
          ) : (
            <PortalCard title="Your Klepka team">
              <p className="text-sm text-grey">Your team is assigned at kickoff — you’ll see everyone here.</p>
            </PortalCard>
          )}

          <CandidatesWidget candidates={candidates} />
        </div>
      </div>
    </div>
  );
};
