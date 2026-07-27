import React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { usePortalData } from '@/app/hooks/use-portal-data';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import { approveMilestone } from '@/app/lib/portal-api';
import { formatDate, prettyName } from '@/app/lib/portal-format';
import { HEALTH_LABELS, MILESTONE_STATUS_LABELS } from '@/app/lib/portal-types';
import { FeedbackDialog } from '@/app/components/portal/FeedbackDialog';
import {
  EmptyState,
  InfoNote,
  PortalButton,
  PortalCard,
  StatTile,
  StatusTag,
  toneFor,
} from '@/app/components/portal/PortalUi';
import { cn } from '@/app/components/ui/utils';

export const PortalProject: React.FC = () => {
  const { snapshot, reload } = usePortalData();
  const { user } = usePortalUser();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = React.useState(false);

  if (!snapshot || !user) return null;

  const { projects, account } = snapshot;
  const bundle = projects.find((entry) => entry.project.id === selectedId) ?? projects[0];

  if (!bundle) {
    return (
      <div className="space-y-5">
        <PortalCard title="Project health" action={<StatusTag tone="grey">Not started</StatusTag>}>
          <p className="text-sm text-grey">
            The Project Tracker activates once your offer is accepted and the contract is signed. Until then you can
            follow progress under <Link to="/portal/pipeline" className="text-violet hover:underline">Pipeline &amp; Offers</Link>.
          </p>
        </PortalCard>
        <PortalCard title="Your Klepka contact">
          <p className="text-sm">
            <span className="font-medium">{account.owner ? prettyName(account.owner.full_name) : 'To be assigned'}</span>
            {account.owner?.title ? <span className="text-grey"> — {account.owner.title}</span> : null}
          </p>
        </PortalCard>
      </div>
    );
  }

  const { project, milestones, team, timeEntries } = bundle;

  const approved = milestones.filter((milestone) => milestone.status === 'approved').length;
  const progress = milestones.length > 0 ? Math.round((approved / milestones.length) * 100) : 0;

  const totalHours = timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
  const billableHours = timeEntries.filter((entry) => entry.billable).reduce((sum, entry) => sum + entry.hours, 0);
  const milestoneName = (id: string | null) =>
    milestones.find((milestone) => milestone.id === id)?.name ?? 'Unassigned';
  const hoursByMilestone = Object.entries(
    timeEntries.reduce<Record<string, number>>((acc, entry) => {
      const key = milestoneName(entry.milestone_id);
      acc[key] = (acc[key] ?? 0) + entry.hours;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const approve = async (id: string) => {
    setBusyId(id);
    try {
      await approveMilestone(id);
      toast.success('Milestone approved.');
      await reload();
    } catch (cause) {
      toast.error('Could not approve', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      {projects.length > 1 && (
        <PortalCard title="Your projects" description="Pick a project to see its milestones, hours and team.">
          <div className="flex flex-wrap gap-2">
            {projects.map((entry) => (
              <button
                key={entry.project.id}
                onClick={() => setSelectedId(entry.project.id)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  entry.project.id === project.id
                    ? 'border-violet bg-portal-tint text-violet'
                    : 'border-border-color hover:border-violet/50',
                )}
              >
                <div className="font-medium">{entry.project.name}</div>
                <div className="mt-0.5">
                  <StatusTag tone={toneFor(entry.project.health)}>{HEALTH_LABELS[entry.project.health]}</StatusTag>
                </div>
              </button>
            ))}
          </div>
        </PortalCard>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Project health"
          value={<StatusTag tone={toneFor(project.health)}>{HEALTH_LABELS[project.health]}</StatusTag>}
        />
        <StatTile label="Milestones approved" value={`${approved} / ${milestones.length}`} hint={`${progress}% complete`} />
        <StatTile label="Target go-live" value={formatDate(project.target_date)} />
      </div>

      <PortalCard title={project.name} description={project.summary || undefined}>
        {milestones.length === 0 ? (
          <EmptyState title="Milestones are being planned" />
        ) : (
          <ol className="space-y-0">
            {milestones.map((milestone, index) => {
              const done = milestone.status === 'approved' || milestone.status === 'complete';
              return (
                <li key={milestone.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        'mt-1 h-4 w-4 shrink-0 rounded-full border-[3px] border-violet',
                        done ? 'bg-violet' : 'bg-card',
                      )}
                    />
                    {index < milestones.length - 1 && <span className="w-0.5 flex-1 bg-border-color" />}
                  </div>
                  <div className="flex-1 pb-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{milestone.name}</span>
                      <StatusTag tone={toneFor(milestone.status)}>
                        {MILESTONE_STATUS_LABELS[milestone.status]}
                      </StatusTag>
                    </div>
                    <div className="mt-0.5 text-xs text-grey">
                      {milestone.due_date ? `Due ${formatDate(milestone.due_date)}` : 'Date TBC'}
                      {milestone.percent_complete > 0 && milestone.status !== 'approved'
                        ? ` · ${milestone.percent_complete}% complete`
                        : ''}
                      {milestone.approved_at ? ` · approved ${formatDate(milestone.approved_at)}` : ''}
                    </div>
                    {milestone.description && <p className="mt-1 text-sm text-grey">{milestone.description}</p>}
                    {milestone.status === 'complete' && user.role === 'client_admin' && (
                      <PortalButton
                        className="mt-2"
                        onClick={() => approve(milestone.id)}
                        disabled={busyId === milestone.id}
                      >
                        {busyId === milestone.id ? 'Approving…' : 'Approve milestone'}
                      </PortalButton>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </PortalCard>

      {timeEntries.length > 0 && (
        <PortalCard
          title="Hours logged"
          description={`${totalHours.toFixed(1)} h total${billableHours !== totalHours ? ` · ${billableHours.toFixed(1)} h billable` : ''}`}
        >
          <div className="space-y-3">
            {hoursByMilestone.map(([label, hours]) => (
              <div key={label}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="min-w-0 truncate font-medium">{label}</span>
                  <span className="ml-3 shrink-0 text-grey">{hours.toFixed(1)} h</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border-color">
                  <div
                    className="h-full rounded-full bg-violet"
                    style={{ width: `${totalHours > 0 ? (hours / totalHours) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-violet">
              Show individual entries ({timeEntries.length})
            </summary>
            <ul className="mt-2 divide-y divide-border-color">
              {timeEntries.slice(0, 50).map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate">{entry.description || 'Delivery work'}</span>
                    <span className="text-xs text-grey">
                      {formatDate(entry.entry_date)}
                      {entry.user?.full_name ? ` · ${prettyName(entry.user.full_name)}` : ''}
                      {!entry.billable ? ' · non-billable' : ''}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium">{entry.hours.toFixed(1)} h</span>
                </li>
              ))}
            </ul>
          </details>
        </PortalCard>
      )}

      <PortalCard
        title="Project team"
        description="The Klepka people staffed on your project — the same list you can leave feedback about."
      >
        {team.length === 0 ? (
          <EmptyState title="Team is being staffed" />
        ) : (
          <ul className="divide-y divide-border-color">
            {team.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {member.user ? prettyName(member.user.full_name) : 'Klepka team member'}
                  </div>
                  <div className="text-xs text-grey">{member.project_role}</div>
                </div>
                <span className="text-xs text-grey">since {formatDate(member.assigned_at)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <InfoNote>
            Want to share how it’s going?{' '}
            <button type="button" onClick={() => setFeedbackOpen(true)} className="font-medium underline">
              Leave feedback
            </button>{' '}
            about anyone on this list.
          </InfoNote>
        </div>
      </PortalCard>

      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
};
