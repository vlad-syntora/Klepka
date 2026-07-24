import React from 'react';
import { toast } from 'sonner';
import { ExternalLink, UserPlus, X } from 'lucide-react';
import { useAsync } from '@/app/hooks/use-async';
import {
  adminCreateCandidate,
  adminDeleteCandidate,
  adminListCandidates,
  adminListInternalUsers,
  adminUpdateCandidate,
} from '@/app/lib/portal-admin-api';
import { formatMoney, prettyName } from '@/app/lib/portal-format';
import {
  CANDIDATE_STATUSES,
  CANDIDATE_STATUS_LABELS,
  ROLE_LABELS,
  type Candidate,
  type PortalAccount,
} from '@/app/lib/portal-types';
import {
  Cell,
  EmptyState,
  ErrorNote,
  Field,
  PortalButton,
  PortalCard,
  PortalSpinner,
  PortalTable,
  Row,
  StatusTag,
  inputClass,
  toneFor,
} from '@/app/components/portal/PortalUi';

/**
 * Candidates — internal staff proposed to the client for this account, each with a position title,
 * a CV link and an optional hourly rate. Works like the Klepka team widget (pick an internal user),
 * but the client reviews each one and confirms or declines; that decision lands back here. The
 * hourly rate is shown to the client only when set.
 */
export const WorkspaceCandidates: React.FC<{ account: PortalAccount }> = ({ account }) => {
  const candidates = useAsync(() => adminListCandidates(account.id), [account.id]);
  const staff = useAsync(() => adminListInternalUsers(), []);

  const [userId, setUserId] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [cvUrl, setCvUrl] = React.useState('');
  const [rate, setRate] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const rows = candidates.data ?? [];
  const alreadyCandidate = new Set(rows.map((row) => row.user_id));
  const available = (staff.data ?? []).filter((person) => !alreadyCandidate.has(person.id));

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId) {
      toast.error('Pick an internal person.');
      return;
    }
    setBusy(true);
    try {
      await adminCreateCandidate({
        account_id: account.id,
        user_id: userId,
        title: title.trim() || null,
        cv_url: cvUrl.trim() || null,
        hourly_rate: rate.trim() ? Number(rate) : null,
      });
      toast.success('Candidate added — the client can review them now.');
      setUserId('');
      setTitle('');
      setCvUrl('');
      setRate('');
      await candidates.reload();
    } catch (cause) {
      toast.error('Could not add the candidate', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (candidate: Candidate, status: Candidate['status']) => {
    try {
      await adminUpdateCandidate(candidate.id, { status });
      await candidates.reload();
    } catch (cause) {
      toast.error('Could not update status', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const remove = async (candidate: Candidate) => {
    if (!window.confirm(`Remove candidate "${candidate.user ? prettyName(candidate.user.full_name) : 'this person'}"?`)) return;
    try {
      await adminDeleteCandidate(candidate.id);
      await candidates.reload();
    } catch (cause) {
      toast.error('Could not remove', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  if (candidates.loading) return <PortalSpinner />;
  if (candidates.error) return <ErrorNote>{candidates.error}</ErrorNote>;

  return (
    <PortalCard
      title="Candidates"
      description="Internal staff proposed to the client for this account. The client confirms or declines each — the hourly rate is only shown when set."
      action={
        <PortalButton onClick={() => void candidates.reload()} variant="ghost">
          Refresh
        </PortalButton>
      }
    >
      <form onSubmit={add} className="mb-4 grid gap-3 rounded-lg border border-border-color bg-off-white p-4 sm:grid-cols-[1.5fr_1.5fr_1.5fr_1fr_auto]">
        <Field label="Person">
          <select className={inputClass} value={userId} onChange={(event) => setUserId(event.target.value)}>
            <option value="">Select…</option>
            {available.map((person) => (
              <option key={person.id} value={person.id}>
                {prettyName(person.full_name)} — {ROLE_LABELS[person.role]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Position title">
          <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Senior Developer" />
        </Field>
        <Field label="CV link (URL)">
          <input type="url" className={inputClass} value={cvUrl} onChange={(event) => setCvUrl(event.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Hourly rate">
          <input type="number" min={0} step="0.01" className={inputClass} value={rate} onChange={(event) => setRate(event.target.value)} placeholder="—" />
        </Field>
        <div className="flex items-end">
          <PortalButton type="submit" disabled={busy || available.length === 0}>
            <UserPlus className="h-4 w-4" /> Add
          </PortalButton>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No candidates yet" description="Propose internal staff for the client to review." />
      ) : (
        <PortalTable head={['Name', 'Position', 'CV', 'Rate', 'Status', '']}>
          {rows.map((candidate) => (
            <Row key={candidate.id}>
              <Cell>
                <div className="font-medium">{candidate.user ? prettyName(candidate.user.full_name) : '—'}</div>
                {candidate.client_note && <div className="mt-1 text-xs text-grey">Client: “{candidate.client_note}”</div>}
              </Cell>
              <Cell className="text-grey">{candidate.title ?? candidate.user?.title ?? '—'}</Cell>
              <Cell>
                {candidate.cv_url ? (
                  <a
                    href={candidate.cv_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-violet hover:underline"
                  >
                    Open <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <span className="text-grey">—</span>
                )}
              </Cell>
              <Cell className="whitespace-nowrap text-grey">
                {candidate.hourly_rate != null ? `${formatMoney(candidate.hourly_rate)}/h` : '—'}
              </Cell>
              <Cell>
                <div className="flex items-center gap-2">
                  <StatusTag tone={toneFor(candidate.status)}>{CANDIDATE_STATUS_LABELS[candidate.status]}</StatusTag>
                  <select
                    className={`${inputClass} w-auto py-1 text-xs`}
                    value={candidate.status}
                    onChange={(event) => setStatus(candidate, event.target.value as Candidate['status'])}
                    aria-label="Override status"
                  >
                    {CANDIDATE_STATUSES.map((value) => (
                      <option key={value} value={value}>
                        {CANDIDATE_STATUS_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>
              </Cell>
              <Cell className="text-right">
                <PortalButton variant="ghost" onClick={() => remove(candidate)} aria-label="Remove">
                  <X className="h-4 w-4" />
                </PortalButton>
              </Cell>
            </Row>
          ))}
        </PortalTable>
      )}
    </PortalCard>
  );
};
