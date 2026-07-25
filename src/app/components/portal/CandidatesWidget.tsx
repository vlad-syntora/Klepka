import React from 'react';
import { toast } from 'sonner';
import { Check, FileText, X } from 'lucide-react';
import { decideCandidate } from '@/app/lib/portal-api';
import { usePortalData } from '@/app/hooks/use-portal-data';
import { formatMoney, initialsOf, prettyName } from '@/app/lib/portal-format';
import { CANDIDATE_STATUS_LABELS, type Candidate } from '@/app/lib/portal-types';
import { PortalButton, PortalCard, StatusTag, toneFor } from '@/app/components/portal/PortalUi';

const CandidateRow: React.FC<{ candidate: Candidate }> = ({ candidate }) => {
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
    <li className="flex flex-col gap-3 py-3">
      <div className="flex items-center gap-3">
        {photo ? (
          <img src={photo} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-portal-tint text-xs font-semibold text-violet">
            {initialsOf(name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">{prettyName(name)}</span>
            {!pending && (
              <StatusTag tone={toneFor(candidate.status)}>{CANDIDATE_STATUS_LABELS[candidate.status]}</StatusTag>
            )}
          </div>
          {title && <div className="truncate text-xs text-grey">{title}</div>}
        </div>
        {/* Rate is shown only when Klepka set one. */}
        {candidate.hourly_rate != null && (
          <span className="shrink-0 text-xs font-medium text-grey">{formatMoney(candidate.hourly_rate)}/h</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-[52px]">
        {candidate.cv_url && (
          <a
            href={candidate.cv_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-violet hover:underline"
          >
            <FileText className="h-4 w-4" /> View CV
          </a>
        )}
        {pending && (
          <div className="ml-auto flex items-center gap-2">
            <PortalButton onClick={() => decide('confirmed')} disabled={busy !== null}>
              <Check className="h-4 w-4" /> Confirm
            </PortalButton>
            <PortalButton variant="danger" onClick={() => decide('declined')} disabled={busy !== null}>
              <X className="h-4 w-4" /> Decline
            </PortalButton>
          </div>
        )}
      </div>
    </li>
  );
};

/**
 * "Candidates for your review" — the people Klepka has proposed for this account, each with their
 * CV and (when set) an hourly rate. The client confirms or declines directly here; the decision
 * writes straight back to the admin side. Distinct from the "Your Klepka team" widget, which lists
 * already-staffed people. Hidden entirely when nobody has been proposed.
 */
export const CandidatesWidget: React.FC<{ candidates: Candidate[] }> = ({ candidates }) => {
  if (candidates.length === 0) return null;

  // Awaiting-review first, then the settled ones.
  const pending = candidates.filter((candidate) => candidate.status === 'proposed');
  const decided = candidates.filter((candidate) => candidate.status !== 'proposed');
  const ordered = [...pending, ...decided];

  return (
    <PortalCard
      title="Candidates for your review"
      description="People we’ve proposed for your project — review each CV, then confirm or decline."
    >
      <ul className="divide-y divide-border-color">
        {ordered.map((candidate) => (
          <CandidateRow key={candidate.id} candidate={candidate} />
        ))}
      </ul>
    </PortalCard>
  );
};
