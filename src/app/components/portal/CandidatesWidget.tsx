import React from 'react';
import { toast } from 'sonner';
import { Check, ChevronLeft, ChevronRight, FileText, X } from 'lucide-react';
import { decideCandidate } from '@/app/lib/portal-api';
import { usePortalData } from '@/app/hooks/use-portal-data';
import { resolveFileView } from '@/app/lib/file-view';
import { formatMoney, initialsOf, prettyName } from '@/app/lib/portal-format';
import { CANDIDATE_STATUS_LABELS, type Candidate } from '@/app/lib/portal-types';
import { FileViewer, type FileViewerFile } from '@/app/components/portal/FileViewer';
import { PortalButton, PortalCard, StatusTag, toneFor } from '@/app/components/portal/PortalUi';

const CandidateCard: React.FC<{ candidate: Candidate; onView: (file: FileViewerFile) => void }> = ({
  candidate,
  onView,
}) => {
  const { reload } = usePortalData();
  const [busy, setBusy] = React.useState<null | 'confirmed' | 'declined'>(null);

  const name = candidate.user?.full_name ?? 'Candidate';
  const title = candidate.title ?? candidate.user?.title ?? null;
  const photo = candidate.user?.photo_url ?? null;
  const pending = candidate.status === 'proposed';

  const decide = async (decision: 'confirmed' | 'declined') => {
    setBusy(decision);
    try {
      await decideCandidate(candidate.id, decision);
      toast.success(decision === 'confirmed' ? 'Candidate confirmed.' : 'Candidate declined.');
      await reload();
    } catch (cause) {
      toast.error('Could not save your decision', { description: cause instanceof Error ? cause.message : undefined });
      setBusy(null);
    }
  };

  return (
    <div className="flex w-[266px] shrink-0 snap-start flex-col rounded-xl border border-border-color bg-card p-4">
      <div className="flex items-center gap-3">
        {photo ? (
          <img src={photo} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-portal-tint text-sm font-semibold text-violet">
            {initialsOf(name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{prettyName(name)}</div>
          {title && <div className="truncate text-xs text-grey">{title}</div>}
        </div>
      </div>

      <dl className="mt-4 space-y-2.5 border-t border-border-color pt-3 text-sm">
        {candidate.hourly_rate != null && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs uppercase tracking-wide text-grey">Rate</dt>
            <dd className="font-medium text-foreground">{formatMoney(candidate.hourly_rate)}/h</dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <dt className="text-xs uppercase tracking-wide text-grey">Status</dt>
          <dd>
            <StatusTag tone={toneFor(candidate.status)}>{CANDIDATE_STATUS_LABELS[candidate.status]}</StatusTag>
          </dd>
        </div>
        {candidate.cv_url && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs uppercase tracking-wide text-grey">CV</dt>
            <dd>
              <button
                type="button"
                onClick={() => onView({ title: `${prettyName(name)} — CV`, ...resolveFileView(candidate.cv_url!) })}
                className="inline-flex items-center gap-1.5 font-medium text-violet hover:underline"
              >
                <FileText className="h-4 w-4" /> View
              </button>
            </dd>
          </div>
        )}
      </dl>

      {pending && (
        <div className="mt-auto flex items-center gap-2 pt-4">
          <PortalButton className="flex-1" onClick={() => decide('confirmed')} disabled={busy !== null}>
            <Check className="h-4 w-4" /> Confirm
          </PortalButton>
          <PortalButton variant="danger" className="flex-1" onClick={() => decide('declined')} disabled={busy !== null}>
            <X className="h-4 w-4" /> Decline
          </PortalButton>
        </div>
      )}
    </div>
  );
};

/**
 * "Candidates for your review" — the people Klepka has proposed for this account, each with their
 * CV and (when set) an hourly rate. The client confirms or declines directly here; the decision
 * writes straight back to the admin side. Distinct from the "Your Klepka team" widget, which lists
 * already-staffed people. Hidden entirely when nobody has been proposed.
 */
export const CandidatesWidget: React.FC<{ candidates: Candidate[] }> = ({ candidates }) => {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const [viewerFile, setViewerFile] = React.useState<FileViewerFile | null>(null);

  if (candidates.length === 0) return null;

  // Awaiting-review first, then the settled ones.
  const pending = candidates.filter((candidate) => candidate.status === 'proposed');
  const decided = candidates.filter((candidate) => candidate.status !== 'proposed');
  const ordered = [...pending, ...decided];

  const scroll = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  const showControls = ordered.length > 1;

  return (
    <PortalCard
      title="Candidates for your review"
      description="People we’ve proposed for your project — review each CV, then confirm or decline."
      action={
        showControls ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => scroll(-1)}
              aria-label="Previous candidates"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-color text-grey transition-colors hover:bg-portal-tint hover:text-violet"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              aria-label="Next candidates"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-color text-grey transition-colors hover:bg-portal-tint hover:text-violet"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : undefined
      }
    >
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {ordered.map((candidate) => (
          <CandidateCard key={candidate.id} candidate={candidate} onView={setViewerFile} />
        ))}
      </div>

      <FileViewer file={viewerFile} onClose={() => setViewerFile(null)} />
    </PortalCard>
  );
};
