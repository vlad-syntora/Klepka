import React from 'react';
import { toast } from 'sonner';
import { useAsync } from '@/app/hooks/use-async';
import { adminListFeedback, adminRespondToFeedback } from '@/app/lib/portal-admin-api';
import { formatDate, prettyName } from '@/app/lib/portal-format';
import type { Feedback, PortalAccount } from '@/app/lib/portal-types';
import {
  EmptyState,
  ErrorNote,
  Field,
  PortalButton,
  PortalCard,
  PortalSpinner,
  StatusTag,
  Stars,
  humanize,
  inputClass,
  toneFor,
} from '@/app/components/portal/PortalUi';

export const FeedbackList: React.FC<{
  entries: Feedback[];
  showAccount?: boolean;
  onResponded: () => Promise<void>;
}> = ({ entries, showAccount, onResponded }) => {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [response, setResponse] = React.useState('');
  const [status, setStatus] = React.useState<Feedback['status']>('acknowledged');
  const [busy, setBusy] = React.useState(false);

  const submit = async (id: string) => {
    setBusy(true);
    try {
      await adminRespondToFeedback(id, { response: response.trim(), status });
      toast.success('Response saved — the client can see it.');
      setOpenId(null);
      setResponse('');
      await onResponded();
    } catch (cause) {
      toast.error('Could not save', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  if (entries.length === 0) return <EmptyState title="No feedback yet" />;

  return (
    <ul className="divide-y divide-border-color">
      {entries.map((entry) => (
        <li key={entry.id} className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Stars value={entry.rating} size={14} />
              <span className="text-xs text-grey">
                {showAccount && entry.account?.name ? `${entry.account.name} · ` : ''}
                about {entry.about?.full_name ? prettyName(entry.about.full_name) : 'Klepka'} · from{' '}
                {entry.submitter?.full_name ? prettyName(entry.submitter.full_name) : 'client'} ·{' '}
                {formatDate(entry.created_at)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {entry.is_urgent && <StatusTag tone="red">Urgent</StatusTag>}
              <StatusTag tone={toneFor(entry.status)}>{humanize(entry.status)}</StatusTag>
            </div>
          </div>

          {entry.comment && <p className="mt-1.5 text-sm">{entry.comment}</p>}

          {entry.response && (
            <div className="mt-2 rounded-lg bg-portal-tint px-3 py-2 text-sm text-violet">
              <span className="text-xs font-semibold uppercase tracking-wide">Your response</span>
              <p className="mt-0.5">{entry.response}</p>
            </div>
          )}

          {openId === entry.id ? (
            <div className="mt-3 space-y-2 rounded-lg border border-border-color bg-off-white p-3">
              <Field label="Response (visible to the client)">
                <textarea
                  rows={2}
                  className={inputClass}
                  value={response}
                  onChange={(event) => setResponse(event.target.value)}
                />
              </Field>
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Mark as">
                  <select
                    className={inputClass}
                    value={status}
                    onChange={(event) => setStatus(event.target.value as Feedback['status'])}
                  >
                    <option value="acknowledged">Acknowledged</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </Field>
                <PortalButton disabled={busy} onClick={() => submit(entry.id)}>
                  Save response
                </PortalButton>
                <PortalButton variant="ghost" onClick={() => setOpenId(null)}>
                  Cancel
                </PortalButton>
              </div>
            </div>
          ) : (
            <PortalButton
              variant="ghost"
              className="mt-2"
              onClick={() => {
                setOpenId(entry.id);
                setResponse(entry.response ?? '');
                setStatus(entry.status === 'new' ? 'acknowledged' : entry.status);
              }}
            >
              {entry.response ? 'Edit response' : 'Respond'}
            </PortalButton>
          )}
        </li>
      ))}
    </ul>
  );
};

export const WorkspaceFeedback: React.FC<{ account: PortalAccount }> = ({ account }) => {
  const feedback = useAsync(() => adminListFeedback(account.id), [account.id]);

  if (feedback.loading) return <PortalSpinner />;
  if (feedback.error) return <ErrorNote>{feedback.error}</ErrorNote>;

  const entries = feedback.data ?? [];
  const average =
    entries.length > 0 ? (entries.reduce((sum, entry) => sum + entry.rating, 0) / entries.length).toFixed(1) : '—';

  return (
    <PortalCard title="Feedback on this account" description={`${entries.length} entries · average ${average}/5`}>
      <FeedbackList entries={entries} onResponded={feedback.reload} />
    </PortalCard>
  );
};
