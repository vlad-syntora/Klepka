import React from 'react';
import { toast } from 'sonner';
import { Paperclip, Plus, Trash2 } from 'lucide-react';
import { useAsync } from '@/app/hooks/use-async';
import {
  adminDeleteIntakeItem,
  adminListDocuments,
  adminListIntake,
  adminUploadDocument,
  adminUpsertIntakeItem,
} from '@/app/lib/portal-admin-api';
import { getDocumentUrl } from '@/app/lib/portal-api';
import { formatDate } from '@/app/lib/portal-format';
import {
  INTAKE_STATUSES,
  INTAKE_STATUS_LABELS,
  type IntakeItem,
  type PortalAccount,
  type PortalDocument,
} from '@/app/lib/portal-types';
import {
  Cell,
  EmptyState,
  ErrorNote,
  Field,
  InfoNote,
  PortalButton,
  PortalCard,
  PortalSpinner,
  PortalTable,
  Row,
  StatTile,
  StatusTag,
  inputClass,
  toneFor,
} from '@/app/components/portal/PortalUi';

const TEMPLATE: { name: string; description: string; owner_side: IntakeItem['owner_side'] }[] = [
  { name: 'Current CRM access', description: 'Read-only access or an export of the existing system.', owner_side: 'client' },
  { name: 'Sales process walkthrough', description: 'Stages, hand-offs and who owns what.', owner_side: 'client' },
  { name: 'Data sample', description: 'Anonymised extract so we can assess quality and volume.', owner_side: 'client' },
  { name: 'Integration inventory', description: 'Systems that must talk to Salesforce.', owner_side: 'client' },
  { name: 'Stakeholder list', description: 'Who signs off, who uses it daily.', owner_side: 'client' },
  { name: 'Solution outline', description: 'Our first pass at the architecture.', owner_side: 'klepka' },
  { name: 'Effort estimate', description: 'Sizing per workstream ahead of the proposal.', owner_side: 'klepka' },
];

export const WorkspaceIntake: React.FC<{ account: PortalAccount }> = ({ account }) => {
  const items = useAsync(() => adminListIntake(account.id), [account.id]);
  const documents = useAsync(() => adminListDocuments(account.id), [account.id]);
  const [showForm, setShowForm] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [ownerSide, setOwnerSide] = React.useState<IntakeItem['owner_side']>('client');
  const [dueDate, setDueDate] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [reviewId, setReviewId] = React.useState<string | null>(null);
  const [reviewNote, setReviewNote] = React.useState('');

  const rows = items.data ?? [];
  const approved = rows.filter((item) => item.status === 'approved').length;
  const awaiting = rows.filter((item) => ['submitted', 'in_review'].includes(item.status)).length;
  const docsFor = (itemId: string) => (documents.data ?? []).filter((doc) => doc.intake_item_id === itemId);
  const [attachingId, setAttachingId] = React.useState<string | null>(null);

  const openDoc = async (doc: PortalDocument) => {
    if (!doc.file_url) return;
    try {
      window.open(await getDocumentUrl(doc.file_url), '_blank', 'noopener');
    } catch (cause) {
      toast.error('Could not open the file', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  // Attach a file straight under an intake item — lands in the account's "01 Discovery" Drive folder.
  const attach = async (item: IntakeItem, file: File) => {
    setAttachingId(item.id);
    try {
      await adminUploadDocument({
        account_id: account.id,
        name: file.name,
        doc_type: 'reference',
        status: 'acknowledged',
        file,
        intake_item_id: item.id,
        folder_key: '01_discovery',
      });
      toast.success('File attached.');
      await documents.reload();
    } catch (cause) {
      toast.error('Upload failed', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setAttachingId(null);
    }
  };

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await adminUpsertIntakeItem({
        account_id: account.id,
        name: name.trim(),
        description: description.trim(),
        owner_side: ownerSide,
        status: 'not_started',
        due_date: dueDate || null,
        position: rows.length,
      });
      setName('');
      setDescription('');
      setDueDate('');
      setShowForm(false);
      await items.reload();
    } catch (cause) {
      toast.error('Could not add', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const seed = async () => {
    if (rows.length > 0 && !window.confirm('Append the standard discovery checklist to the existing items?')) return;
    setBusy(true);
    try {
      for (const [index, item] of TEMPLATE.entries()) {
        await adminUpsertIntakeItem({
          account_id: account.id,
          ...item,
          status: 'not_started',
          due_date: null,
          position: rows.length + index,
        });
      }
      toast.success('Standard checklist added.');
      await items.reload();
    } catch (cause) {
      toast.error('Could not seed', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const patch = async (item: IntakeItem, changes: Partial<IntakeItem>) => {
    // Reflect the change instantly, then persist and reconcile with the server in the background.
    items.mutate((rows) => rows?.map((row) => (row.id === item.id ? { ...row, ...changes } : row)) ?? rows);
    try {
      await adminUpsertIntakeItem({
        id: item.id,
        account_id: item.account_id,
        name: changes.name ?? item.name,
        description: changes.description ?? item.description,
        owner_side: changes.owner_side ?? item.owner_side,
        status: changes.status ?? item.status,
        due_date: changes.due_date !== undefined ? changes.due_date : item.due_date,
        position: item.position,
        review_note: changes.review_note !== undefined ? changes.review_note : item.review_note,
      });
      await items.reload();
    } catch (cause) {
      await items.reload(); // roll back the optimistic change to the true server state
      toast.error('Could not update', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const remove = async (item: IntakeItem) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    await adminDeleteIntakeItem(item.id);
    await items.reload();
  };

  // Only blank the tab on the very first load — reloads keep the table on screen (no flash).
  if (items.loading && !items.data) return <PortalSpinner />;
  if (items.error) return <ErrorNote>{items.error}</ErrorNote>;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Approved" value={`${approved} / ${rows.length}`} />
        <StatTile label="Awaiting your review" value={awaiting} tone={awaiting > 0 ? 'amber' : 'green'} />
        <StatTile
          label="Client stage"
          value={rows.length === 0 ? 'Not started' : approved === rows.length ? 'Complete' : 'In progress'}
        />
      </div>

      <PortalCard
        title="Information gathering"
        description="Drives the client's checklist — due dates, owners and review verdicts."
        action={
          <>
            <PortalButton variant="secondary" onClick={seed} disabled={busy}>
              Use standard checklist
            </PortalButton>
            <PortalButton onClick={() => setShowForm((open) => !open)}>
              <Plus className="h-4 w-4" /> Add item
            </PortalButton>
          </>
        }
      >
        {showForm && (
          <form onSubmit={add} className="mb-4 grid gap-3 rounded-lg border border-border-color bg-off-white p-4 sm:grid-cols-5">
            <Field label="Item" className="sm:col-span-2">
              <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} required />
            </Field>
            <Field label="Description">
              <input
                className={inputClass}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
            <Field label="Owner">
              <select
                className={inputClass}
                value={ownerSide}
                onChange={(event) => setOwnerSide(event.target.value as IntakeItem['owner_side'])}
              >
                <option value="client">Client</option>
                <option value="klepka">Klepka</option>
              </select>
            </Field>
            <Field label="Due">
              <input type="date" className={inputClass} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </Field>
            <div className="flex items-end gap-2 sm:col-span-5">
              <PortalButton type="submit" disabled={busy}>
                Add
              </PortalButton>
              <PortalButton variant="ghost" type="button" onClick={() => setShowForm(false)}>
                Cancel
              </PortalButton>
            </div>
          </form>
        )}

        {rows.length === 0 ? (
          <EmptyState
            title="No checklist yet"
            description="Until you add items, the client's Information gathering page stays empty."
          />
        ) : (
          <PortalTable head={['Item', 'Owner', 'Due', 'Status', 'Client note', '']}>
            {rows.map((item) => (
              <React.Fragment key={item.id}>
                <Row>
                  <Cell>
                    <div className="font-medium">{item.name}</div>
                    {item.description && <div className="text-xs text-grey">{item.description}</div>}
                  </Cell>
                  <Cell>
                    <select
                      className={`${inputClass} w-auto py-1 text-xs`}
                      value={item.owner_side}
                      onChange={(event) =>
                        patch(item, { owner_side: event.target.value as IntakeItem['owner_side'] })
                      }
                    >
                      <option value="client">Client</option>
                      <option value="klepka">Klepka</option>
                    </select>
                  </Cell>
                  <Cell className="whitespace-nowrap">
                    <input
                      type="date"
                      className={`${inputClass} w-auto py-1 text-xs`}
                      value={item.due_date ?? ''}
                      onChange={(event) => patch(item, { due_date: event.target.value || null })}
                    />
                  </Cell>
                  <Cell>
                    <select
                      className={`${inputClass} w-auto py-1 text-xs`}
                      value={item.status}
                      onChange={(event) => patch(item, { status: event.target.value as IntakeItem['status'] })}
                    >
                      {INTAKE_STATUSES.map((value) => (
                        <option key={value} value={value}>
                          {INTAKE_STATUS_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </Cell>
                  <Cell className="max-w-xs text-grey">
                    {item.client_note || '—'}
                    {item.submitted_at && (
                      <div className="text-xs">
                        <StatusTag tone={toneFor(item.status)}>submitted {formatDate(item.submitted_at)}</StatusTag>
                      </div>
                    )}
                    {docsFor(item.id).length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {docsFor(item.id).map((doc) => (
                          <button
                            key={doc.id}
                            type="button"
                            onClick={() => openDoc(doc)}
                            className="flex max-w-full items-center gap-1.5 text-xs font-medium text-violet hover:underline"
                          >
                            <Paperclip className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{doc.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </Cell>
                  <Cell className="whitespace-nowrap text-right">
                    <label
                      className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-grey transition-colors hover:bg-portal-tint/60"
                      aria-label="Attach file"
                    >
                      <Paperclip className="h-4 w-4" />
                      {attachingId === item.id ? 'Attaching…' : 'Attach'}
                      <input
                        type="file"
                        className="hidden"
                        disabled={attachingId === item.id}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = '';
                          if (file) void attach(item, file);
                        }}
                      />
                    </label>
                    <PortalButton
                      variant="ghost"
                      onClick={() => {
                        setReviewId(reviewId === item.id ? null : item.id);
                        setReviewNote(item.review_note ?? '');
                      }}
                    >
                      Review
                    </PortalButton>
                    <PortalButton variant="ghost" onClick={() => remove(item)} aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </PortalButton>
                  </Cell>
                </Row>
                {reviewId === item.id && (
                  <Row>
                    <Cell colSpan={6} className="bg-off-white">
                      <Field label="Review note — visible to the client">
                        <textarea
                          rows={2}
                          className={inputClass}
                          value={reviewNote}
                          onChange={(event) => setReviewNote(event.target.value)}
                        />
                      </Field>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <PortalButton
                          onClick={async () => {
                            await patch(item, { review_note: reviewNote, status: 'approved' });
                            setReviewId(null);
                          }}
                        >
                          Approve
                        </PortalButton>
                        <PortalButton
                          variant="secondary"
                          onClick={async () => {
                            await patch(item, { review_note: reviewNote, status: 'in_review' });
                            setReviewId(null);
                          }}
                        >
                          Save note, keep in review
                        </PortalButton>
                        <PortalButton
                          variant="danger"
                          onClick={async () => {
                            await patch(item, { review_note: reviewNote, status: 'blocked' });
                            setReviewId(null);
                          }}
                        >
                          Block
                        </PortalButton>
                      </div>
                    </Cell>
                  </Row>
                )}
              </React.Fragment>
            ))}
          </PortalTable>
        )}
      </PortalCard>

      <InfoNote>
        The client only sees this page once the account reaches <strong>Qualified</strong>. Move the lifecycle stage on
        the Overview tab to open it up.
      </InfoNote>
    </div>
  );
};
