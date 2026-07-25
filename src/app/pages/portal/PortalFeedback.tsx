import React from 'react';
import { toast } from 'sonner';
import { usePortalData } from '@/app/hooks/use-portal-data';
import { listFeedbackTargets, submitFeedback } from '@/app/lib/portal-api';
import { formatDate, prettyName } from '@/app/lib/portal-format';
import type { FeedbackTarget } from '@/app/lib/portal-types';
import {
  EmptyState,
  Field,
  InfoNote,
  PortalButton,
  PortalCard,
  StatusTag,
  Stars,
  humanize,
  inputClass,
  toneFor,
} from '@/app/components/portal/PortalUi';

export const PortalFeedback: React.FC = () => {
  const { snapshot, reload } = usePortalData();
  const [targets, setTargets] = React.useState<FeedbackTarget[]>([]);
  const [about, setAbout] = React.useState('');
  const [rating, setRating] = React.useState(5);
  const [comment, setComment] = React.useState('');
  const [urgent, setUrgent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    listFeedbackTargets()
      .then(setTargets)
      .catch(() => setTargets([]));
  }, []);

  if (!snapshot) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await submitFeedback({
        rating,
        comment: comment.trim(),
        aboutUserId: about || null,
        isUrgent: urgent,
      });
      toast.success(urgent ? 'Sent — your account owner and their manager are notified now.' : 'Thanks for the feedback.');
      setComment('');
      setUrgent(false);
      setRating(5);
      await reload();
    } catch (cause) {
      toast.error('Could not submit feedback', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PortalCard title="Share feedback" description="Continuous, not just at project close.">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="About"
              hint="Only people staffed on your account appear here — see Project Tracker for the full team."
            >
              <select className={inputClass} value={about} onChange={(event) => setAbout(event.target.value)}>
                <option value="">General feedback about Klepka</option>
                {targets.map((target) => (
                  <option key={target.user_id} value={target.user_id}>
                    {prettyName(target.full_name)}
                    {target.project_role ? ` — ${target.project_role}` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Rating">
              <div className="pt-1.5">
                <Stars value={rating} onChange={setRating} />
              </div>
            </Field>
          </div>

          <Field label="Comment">
            <textarea
              rows={3}
              className={inputClass}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="What's going well? What could be better?"
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-grey">
            <input
              type="checkbox"
              checked={urgent}
              onChange={(event) => setUrgent(event.target.checked)}
              className="h-4 w-4 accent-[color:var(--violet)]"
            />
            Flag as urgent — notify the account owner and their manager immediately
          </label>

          <PortalButton type="submit" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit feedback'}
          </PortalButton>
        </form>
      </PortalCard>

      <PortalCard title="Your feedback history">
        {snapshot.feedback.length === 0 ? (
          <EmptyState title="No feedback submitted yet" />
        ) : (
          <ul className="divide-y divide-border-color">
            {snapshot.feedback.map((entry) => (
              <li key={entry.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Stars value={entry.rating} size={14} />
                    <span className="text-xs text-grey">
                      {entry.about?.full_name ? `about ${prettyName(entry.about.full_name)}` : 'about Klepka'} ·{' '}
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
                    <span className="text-xs font-semibold uppercase tracking-wide">Klepka replied</span>
                    <p className="mt-0.5">{entry.response}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </PortalCard>

      <InfoNote>
        Your feedback stays visible to you, along with our response. We use it internally to track account health —
        urgent flags route straight to the account owner and their manager.
      </InfoNote>
    </div>
  );
};
