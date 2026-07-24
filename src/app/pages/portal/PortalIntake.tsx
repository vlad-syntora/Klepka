import React from 'react';
import { toast } from 'sonner';
import { usePortalData } from '@/app/hooks/use-portal-data';
import { updateIntakeItem } from '@/app/lib/portal-api';
import { formatDate } from '@/app/lib/portal-format';
import { INTAKE_STATUS_LABELS, type IntakeItem } from '@/app/lib/portal-types';
import {
  EmptyState,
  Field,
  InfoNote,
  PortalButton,
  PortalCard,
  StatTile,
  StatusTag,
  inputClass,
  toneFor,
} from '@/app/components/portal/PortalUi';

const isOverdue = (item: IntakeItem) =>
  Boolean(item.due_date) &&
  !['approved', 'submitted', 'in_review'].includes(item.status) &&
  new Date(item.due_date as string) < new Date();

const Item: React.FC<{ item: IntakeItem; onChanged: () => Promise<void> }> = ({ item, onChanged }) => {
  const [note, setNote] = React.useState(item.client_note ?? '');
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const mine = item.owner_side === 'client';
  const locked = ['submitted', 'in_review', 'approved'].includes(item.status);

  const submit = async (status: 'in_progress' | 'submitted') => {
    setBusy(true);
    try {
      await updateIntakeItem(item.id, status, note.trim() || undefined);
      toast.success(status === 'submitted' ? 'Submitted for review.' : 'Marked as in progress.');
      setOpen(false);
      await onChanged();
    } catch (cause) {
      toast.error('Could not update', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{item.name}</span>
            <StatusTag tone={toneFor(item.status)}>{INTAKE_STATUS_LABELS[item.status]}</StatusTag>
            <StatusTag tone={mine ? 'violet' : 'grey'}>{mine ? 'Your side' : 'Klepka'}</StatusTag>
            {isOverdue(item) && <StatusTag tone="red">Overdue</StatusTag>}
          </div>
          {item.description && <p className="mt-1 text-sm text-grey">{item.description}</p>}
          <p className="mt-1 text-xs text-grey">
            {item.due_date ? `Due ${formatDate(item.due_date)}` : 'No due date'}
            {item.submitted_at ? ` · submitted ${formatDate(item.submitted_at)}` : ''}
          </p>
        </div>

        {mine && !locked && (
          <PortalButton variant={open ? 'ghost' : 'secondary'} onClick={() => setOpen((value) => !value)}>
            {open ? 'Cancel' : 'Update'}
          </PortalButton>
        )}
      </div>

      {item.client_note && !open && (
        <div className="mt-2 rounded-lg border border-border-color bg-off-white px-3 py-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-grey">Your note</span>
          <p className="mt-0.5 whitespace-pre-line">{item.client_note}</p>
        </div>
      )}

      {item.review_note && (
        <div className="mt-2 rounded-lg bg-portal-tint px-3 py-2 text-sm text-violet">
          <span className="text-xs font-semibold uppercase tracking-wide">Klepka review</span>
          <p className="mt-0.5 whitespace-pre-line">{item.review_note}</p>
        </div>
      )}

      {open && (
        <div className="mt-3 space-y-3 rounded-lg border border-border-color bg-off-white p-4">
          <Field label="Note" hint="Anything we should know — links, caveats, open questions.">
            <textarea
              rows={3}
              className={inputClass}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          <p className="text-xs text-grey">
            Files go under <strong>Contracts &amp; Documents</strong> — upload there and mention it here.
          </p>
          <div className="flex flex-wrap gap-2">
            <PortalButton onClick={() => submit('submitted')} disabled={busy}>
              Submit for review
            </PortalButton>
            <PortalButton variant="secondary" onClick={() => submit('in_progress')} disabled={busy}>
              Save as in progress
            </PortalButton>
          </div>
        </div>
      )}
    </li>
  );
};

export const PortalIntake: React.FC = () => {
  const { snapshot, reload } = usePortalData();
  if (!snapshot) return null;

  const { intake } = snapshot;
  const mine = intake.filter((item) => item.owner_side === 'client');
  const theirs = intake.filter((item) => item.owner_side === 'klepka');
  const approved = intake.filter((item) => item.status === 'approved').length;
  const waiting = mine.filter((item) => !['submitted', 'in_review', 'approved'].includes(item.status)).length;
  const overdue = intake.filter(isOverdue).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Progress"
          value={`${approved} / ${intake.length}`}
          hint={intake.length > 0 ? `${Math.round((approved / intake.length) * 100)}% approved` : undefined}
        />
        <StatTile label="Waiting on you" value={waiting} tone={waiting > 0 ? 'amber' : 'green'} />
        <StatTile label="Overdue" value={overdue} tone={overdue > 0 ? 'red' : 'green'} />
      </div>

      <PortalCard
        title="What we need from you"
        description="Submit each item for review — we'll confirm or come back with questions."
      >
        {mine.length === 0 ? (
          <EmptyState title="Nothing needed from you right now" />
        ) : (
          <ul className="divide-y divide-border-color">
            {mine.map((item) => (
              <Item key={item.id} item={item} onChanged={reload} />
            ))}
          </ul>
        )}
      </PortalCard>

      {theirs.length > 0 && (
        <PortalCard title="What we're working on" description="Our side of the discovery — visible so nothing looks stalled.">
          <ul className="divide-y divide-border-color">
            {theirs.map((item) => (
              <Item key={item.id} item={item} onChanged={reload} />
            ))}
          </ul>
        </PortalCard>
      )}

      <InfoNote>
        Once everything here is approved we move to scoping, and your proposal appears under
        <strong> Pipeline &amp; Offers</strong>.
      </InfoNote>
    </div>
  );
};
