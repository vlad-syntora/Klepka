import React from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { getDocumentUrl, listEntityProducts } from '@/app/lib/portal-api';
import { resolveFileView } from '@/app/lib/file-view';
import { FileViewer, type FileViewerFile } from '@/app/components/portal/FileViewer';
import { formatDate, formatDayDuration, formatMilestoneRange } from '@/app/lib/portal-format';
import {
  HEALTH_LABELS,
  MILESTONE_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  projectStatusTone,
  projectUsesMilestones,
  type PortalDocument,
  type Product,
  type ProjectBundle,
} from '@/app/lib/portal-types';
import { MilestoneGantt } from '@/app/components/portal/MilestoneGantt';
import { EmptyState, PortalCard, StatusTag, inputClass, toneFor } from '@/app/components/portal/PortalUi';
import { cn } from '@/app/components/ui/utils';

// Persists the client's list/Gantt milestone-view choice across visits.
const MILESTONE_VIEW_KEY = 'portal:milestone-view';

// Compact stat used in the tracker's top row — smaller than the full-page StatTile.
const MiniStat: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
  <div className="flex items-center justify-between gap-2 rounded-lg border border-border-color bg-off-white px-3 py-1.5">
    <span className="min-w-0 text-[10px] font-medium uppercase tracking-wide text-grey">{label}</span>
    <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-right text-sm font-semibold">
      {children}
      {hint && <span className="text-[11px] font-normal text-grey">{hint}</span>}
    </span>
  </div>
);

// A collapsible section header — lets the client hide any section of the tracker. Extra controls
// (e.g. the milestones List/Gantt toggle) render on the right while the section is open.
const SectionHeader: React.FC<{
  open: boolean;
  onToggle: () => void;
  label: string;
  count?: number;
  children?: React.ReactNode;
}> = ({ open, onToggle, label, count, children }) => (
  <div className="mb-2 flex items-center justify-between gap-2">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-grey transition-colors hover:text-violet"
    >
      {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      {label}
      {!open && count != null && count > 0 && <span className="font-medium normal-case text-grey">({count})</span>}
    </button>
    {open && children}
  </div>
);

/**
 * Dashboard "Project tracking" widget: switch between the account's projects and see health,
 * milestones approved and target go-live at a glance, plus products, milestones and related
 * documents. Each section can be collapsed by the client, and milestones can be shown as a list or a
 * Gantt timeline. Support-type projects have no milestones, so that section is hidden for them.
 */
export const ProjectTrackerWidget: React.FC<{
  projects: ProjectBundle[];
  documents: PortalDocument[];
}> = ({ projects, documents }) => {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [viewerFile, setViewerFile] = React.useState<FileViewerFile | null>(null);
  // Clients can collapse any section to keep the tracker compact.
  const [productsOpen, setProductsOpen] = React.useState(true);
  const [milestonesOpen, setMilestonesOpen] = React.useState(true);
  const [docsOpen, setDocsOpen] = React.useState(true);
  // Milestones as a vertical list (default) or a Gantt timeline — remembered across visits.
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

  const bundle = projects.find((entry) => entry.project.id === selectedId) ?? projects[0];
  const project = bundle?.project;
  const projectId = project?.id;

  React.useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    listEntityProducts('project', projectId)
      .then((rows) => {
        if (!cancelled) setProducts(rows);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!bundle || !project) {
    return (
      <PortalCard title="Project tracking">
        <EmptyState title="No project yet" description="Your tracker activates once a project is set up." />
      </PortalCard>
    );
  }

  const { milestones } = bundle;
  const showMilestones = projectUsesMilestones(project.project_type);
  const approved = milestones.filter((milestone) => milestone.status === 'approved').length;
  const progress = milestones.length > 0 ? Math.round((approved / milestones.length) * 100) : 0;
  const relatedDocs = documents.filter((doc) => doc.related_project_id === project.id);

  // Open documents in the in-page viewer (same as offer/other document previews) rather than a new tab.
  const openDoc = async (doc: PortalDocument) => {
    if (!doc.file_url) return;
    try {
      const resolved = await getDocumentUrl(doc.file_url);
      setViewerFile({ title: doc.name, ...resolveFileView(resolved, doc.drive_file_id) });
    } catch (cause) {
      toast.error('Could not open', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  return (
    <PortalCard
      title="Project tracking"
      description={project.name}
      action={
        projects.length > 1 ? (
          <select
            className={`${inputClass} w-auto py-1.5 text-xs`}
            value={project.id}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {projects.map((entry) => (
              <option key={entry.project.id} value={entry.project.id}>
                {entry.project.name}
              </option>
            ))}
          </select>
        ) : undefined
      }
    >
      {/* Status/health stay narrow; Milestones approved (value + % hint) and Target go-live get the
          extra width so the whole strip fits on one line without wrapping. */}
      <div
        className={cn(
          'grid gap-2',
          showMilestones
            ? 'sm:grid-cols-[0.8fr_0.8fr_1.4fr_1fr]'
            : 'sm:grid-cols-[0.85fr_0.85fr_1.3fr]',
        )}
      >
        <MiniStat label="Status">
          <StatusTag tone={projectStatusTone(project.status)}>{PROJECT_STATUS_LABELS[project.status]}</StatusTag>
        </MiniStat>
        <MiniStat label="Project health">
          <StatusTag tone={toneFor(project.health)}>{HEALTH_LABELS[project.health]}</StatusTag>
        </MiniStat>
        {showMilestones && (
          <MiniStat label="Milestones approved" hint={`${progress}% complete`}>
            {approved} / {milestones.length}
          </MiniStat>
        )}
        <MiniStat label="Target go-live">{formatDate(project.target_date)}</MiniStat>
      </div>

      {products.length > 0 && (
        <div className="mt-4">
          <SectionHeader
            open={productsOpen}
            onToggle={() => setProductsOpen((open) => !open)}
            label="Products"
            count={products.length}
          />
          {productsOpen && (
            <div className="flex flex-wrap gap-1.5">
              {products.map((product) => (
                <span
                  key={product.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-portal-tint px-2.5 py-1 text-xs font-medium text-violet"
                >
                  {product.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {showMilestones && (
        <div className="mt-4">
          <SectionHeader
            open={milestonesOpen}
            onToggle={() => setMilestonesOpen((open) => !open)}
            label="Milestones"
            count={milestones.length}
          >
            {milestones.length > 0 && (
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
            )}
          </SectionHeader>
          {!milestonesOpen ? null : milestones.length === 0 ? (
            <p className="text-sm text-grey">Milestones are being planned.</p>
          ) : milestoneView === 'gantt' ? (
            <MilestoneGantt
              milestones={milestones}
              startDate={project.start_date}
              targetDate={project.target_date}
            />
          ) : (
            <ol className="space-y-0">
              {milestones.map((milestone, index) => {
                const done = milestone.status === 'approved' || milestone.status === 'complete';
                return (
                  <li key={milestone.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          'mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-[3px] border-violet',
                          done ? 'bg-violet' : 'bg-card',
                        )}
                      />
                      {index < milestones.length - 1 && <span className="w-0.5 flex-1 bg-border-color" />}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{milestone.name}</span>
                        <StatusTag tone={toneFor(milestone.status)}>
                          {MILESTONE_STATUS_LABELS[milestone.status]}
                        </StatusTag>
                      </div>
                      <div className="mt-0.5 text-xs text-grey">
                        {formatMilestoneRange(milestone.start_date, milestone.due_date)}
                        {formatDayDuration(milestone.start_date, milestone.due_date)
                          ? ` · ${formatDayDuration(milestone.start_date, milestone.due_date)}`
                          : ''}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      <div className="mt-4">
        <SectionHeader
          open={docsOpen}
          onToggle={() => setDocsOpen((open) => !open)}
          label="Related documents"
          count={relatedDocs.length}
        />
        {!docsOpen ? null : relatedDocs.length === 0 ? (
          <p className="text-sm text-grey">No documents on this project yet.</p>
        ) : (
          <ul className="divide-y divide-border-color">
            {relatedDocs.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-grey" />
                  <span className="truncate">{doc.name}</span>
                </span>
                {doc.file_url && (
                  <button
                    type="button"
                    onClick={() => openDoc(doc)}
                    className="shrink-0 text-xs font-medium text-violet hover:underline"
                  >
                    Open
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <FileViewer file={viewerFile} onClose={() => setViewerFile(null)} />
    </PortalCard>
  );
};
