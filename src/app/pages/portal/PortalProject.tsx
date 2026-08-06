import React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { usePortalData } from '@/app/hooks/use-portal-data';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import { approveMilestone } from '@/app/lib/portal-api';
import { formatDate, formatDayDuration, formatMilestoneRange, prettyName } from '@/app/lib/portal-format';
import {
  HEALTH_LABELS,
  MILESTONE_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  projectStatusTone,
  projectUsesMilestones,
} from '@/app/lib/portal-types';
import { EntityProductsCard } from '@/app/components/portal/EntityProductsCard';
import { KlepkaTeamWidget } from '@/app/components/portal/KlepkaTeamWidget';
import { MilestoneGantt } from '@/app/components/portal/MilestoneGantt';
import { ProjectHoursReport } from '@/app/components/portal/ProjectHoursReport';
import {
  EmptyState,
  PortalButton,
  PortalCard,
  StatTile,
  StatusTag,
  inputClass,
  toneFor,
} from '@/app/components/portal/PortalUi';
import { cn } from '@/app/components/ui/utils';

// Remembers the client's milestone list/Gantt choice across visits ("memory").
const MILESTONE_VIEW_KEY = 'portal:milestone-view';
// Remembers which project the client was last viewing, so a refresh lands on the same one.
const PROJECT_SEL_KEY = 'portal:project-sel';

export const PortalProject: React.FC = () => {
  const { snapshot, reload } = usePortalData();
  const { user } = usePortalUser();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(PROJECT_SEL_KEY);
  });

  const chooseProject = (id: string) => {
    setSelectedId(id);
    try {
      window.localStorage.setItem(PROJECT_SEL_KEY, id);
    } catch {
      /* storage unavailable (private mode / quota) — keep the choice in memory only */
    }
  };
  const [milestoneView, setMilestoneView] = React.useState<'list' | 'gantt'>(() => {
    if (typeof window === 'undefined') return 'list';
    return window.localStorage.getItem(MILESTONE_VIEW_KEY) === 'gantt' ? 'gantt' : 'list';
  });

  const chooseMilestoneView = (view: 'list' | 'gantt') => {
    setMilestoneView(view);
    try {
      window.localStorage.setItem(MILESTONE_VIEW_KEY, view);
    } catch {
      /* storage unavailable (private mode / quota) — keep the choice in memory only */
    }
  };

  if (!snapshot || !user) return null;

  const { projects, account } = snapshot;
  const bundle = projects.find((entry) => entry.project.id === selectedId) ?? projects[0];

  if (!bundle) {
    return (
      <div className="space-y-2">
        <PortalCard title="Project health" action={<StatusTag tone="grey">Not started</StatusTag>}>
          <p className="text-sm text-grey">
            The Project Tracker activates once your offer is accepted and the contract is signed. Until then you can
            follow progress under the <Link to="/portal/project" className="text-violet hover:underline">Pipeline &amp; Offers</Link> tab.
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
  const showMilestones = projectUsesMilestones(project.project_type);

  const approved = milestones.filter((milestone) => milestone.status === 'approved').length;
  const progress = milestones.length > 0 ? Math.round((approved / milestones.length) * 100) : 0;

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

  const milestoneViewToggle =
    milestones.length > 0 ? (
      <div className="flex overflow-hidden rounded-md border border-border-color text-[11px] font-medium">
        {(['list', 'gantt'] as const).map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => chooseMilestoneView(view)}
            className={cn(
              'px-2 py-0.5 capitalize transition-colors',
              milestoneView === view ? 'bg-violet text-white' : 'text-grey hover:text-violet',
            )}
          >
            {view}
          </button>
        ))}
      </div>
    ) : undefined;

  // The project team, rendered with the same card as "Your Klepka Team" (avatars, ratings, book-a-call
  // / email / feedback). Only this project's team members — no account owner or other groups.
  const teamCard =
    team.length > 0 ? (
      <KlepkaTeamWidget klepkaTeam={[]} projects={[bundle]} />
    ) : (
      <PortalCard title="Project team">
        <EmptyState title="Team is being staffed" />
      </PortalCard>
    );

  // Project switcher — lives in a section header (the Milestones card, or above the team for
  // Support projects) rather than floating at the top of the page.
  const projectPicklist =
    projects.length > 1 ? (
      <select
        className={`${inputClass} w-auto max-w-full py-1 text-xs`}
        value={project.id}
        onChange={(event) => chooseProject(event.target.value)}
        aria-label="Choose project"
      >
        {projects.map((entry) => (
          <option key={entry.project.id} value={entry.project.id}>
            {entry.project.name} · {HEALTH_LABELS[entry.project.health]}
          </option>
        ))}
      </select>
    ) : null;

  return (
    <div className="space-y-2">
      {/* Support projects have no Milestones card to host the switcher, so it sits above the team. */}
      {projectPicklist && !showMilestones && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-grey">Project</span>
          {projectPicklist}
        </div>
      )}

      {/* Row 1: the project's headline stats. Status and health are compact (1/6 each); the
          milestone progress and go-live get more room (2/6 each). */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-1">
          <StatTile
            compact
            label="Status"
            value={<StatusTag tone={projectStatusTone(project.status)}>{PROJECT_STATUS_LABELS[project.status]}</StatusTag>}
          />
        </div>
        <div className="lg:col-span-1">
          <StatTile
            compact
            label="Health"
            value={<StatusTag tone={toneFor(project.health)}>{HEALTH_LABELS[project.health]}</StatusTag>}
          />
        </div>
        <div className="lg:col-span-2">
          <StatTile
            compact
            label="Milestones approved"
            value={`${approved} / ${milestones.length}`}
            hint={`${progress}% complete`}
          />
        </div>
        <div className="lg:col-span-2">
          <StatTile compact label="Target go-live" value={formatDate(project.target_date)} />
        </div>
      </div>

      {/* Row 2: milestones (list/Gantt) beside the project team. Support projects have no milestones,
          so the team takes the row on its own. */}
      {showMilestones ? (
        <div className="grid items-start gap-2 lg:grid-cols-3">
          <PortalCard
            className="lg:col-span-2"
            title="Milestones"
            description={project.summary || undefined}
            action={
              projectPicklist ? (
                <div className="flex flex-wrap items-center gap-2">
                  {projectPicklist}
                  {milestoneViewToggle}
                </div>
              ) : (
                milestoneViewToggle
              )
            }
          >
            {milestones.length === 0 ? (
              <EmptyState title="Milestones are being planned" />
            ) : milestoneView === 'gantt' ? (
              <MilestoneGantt milestones={milestones} startDate={project.start_date} targetDate={project.target_date} />
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
                          {formatMilestoneRange(milestone.start_date, milestone.due_date)}
                          {formatDayDuration(milestone.start_date, milestone.due_date)
                            ? ` · ${formatDayDuration(milestone.start_date, milestone.due_date)}`
                            : ''}
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

          <div className="lg:col-span-1">{teamCard}</div>
        </div>
      ) : (
        teamCard
      )}

      {/* Row 3: the hours report (approved billing hours) beside the products. */}
      <div className="grid items-start gap-2 lg:grid-cols-3">
        <ProjectHoursReport
          className="lg:col-span-2"
          description="Approved hours logged on your project."
          project={project}
          milestones={milestones}
          timeEntries={timeEntries}
        />

        <div className="lg:col-span-1">
          <EntityProductsCard
            entity="project"
            id={project.id}
            title="Products"
            description="Products delivered in this project."
          />
        </div>
      </div>
    </div>
  );
};
