import React from 'react';
import { toast } from 'sonner';
import { Download, Plus, Send, Trash2, Upload } from 'lucide-react';
import { useAsync } from '@/app/hooks/use-async';
import {
  adminCreateOfferVersion,
  adminDeleteDocument,
  adminListDocuments,
  adminListOffers,
  adminListOpportunities,
  adminSendOffer,
  adminUploadDocument,
  adminUpsertOpportunity,
  type OfferItemInput,
} from '@/app/lib/portal-admin-api';
import { getDocumentUrl } from '@/app/lib/portal-api';
import { formatDate, formatMoney } from '@/app/lib/portal-format';
import {
  DOC_TYPES,
  DOC_TYPE_LABELS,
  OFFER_STATUS_LABELS,
  OPPORTUNITY_STAGES,
  STAGE_LABELS,
  type DocType,
  type Opportunity,
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
  StageTracker,
  StatusTag,
  inputClass,
  toneFor,
} from '@/app/components/portal/PortalUi';
import { cn } from '@/app/components/ui/utils';

const STAGES = OPPORTUNITY_STAGES.map((key) => ({ key, label: STAGE_LABELS[key] }));
const EMPTY_ITEM: OfferItemInput = { name: '', detail: '', amount: 0 };

export const WorkspacePipeline: React.FC<{ account: PortalAccount; onChange: () => Promise<void> }> = ({
  account,
  onChange,
}) => {
  const opportunities = useAsync(() => adminListOpportunities(account.id), [account.id]);
  const offers = useAsync(() => adminListOffers(account.id), [account.id]);
  const documents = useAsync(() => adminListDocuments(account.id), [account.id]);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // Offer builder state
  const [showBuilder, setShowBuilder] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [summary, setSummary] = React.useState('');
  const [expiresOn, setExpiresOn] = React.useState('');
  const [changeNote, setChangeNote] = React.useState('');
  const [items, setItems] = React.useState<OfferItemInput[]>([{ ...EMPTY_ITEM }]);
  const [busy, setBusy] = React.useState(false);

  // Document uploader state (scoped to the selected opportunity)
  const [docName, setDocName] = React.useState('');
  const [docType, setDocType] = React.useState<DocType>('proposal');
  const [docFile, setDocFile] = React.useState<File | null>(null);
  const [docBusy, setDocBusy] = React.useState(false);

  const opps = opportunities.data ?? [];
  const selected: Opportunity | null = opps.find((entry) => entry.id === selectedId) ?? opps[0] ?? null;
  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const oppOffers = (offers.data ?? []).filter((offer) => offer.opportunity_id === selected?.id);
  const oppDocs = (documents.data ?? []).filter((doc) => doc.opportunity_id === selected?.id);

  const setStage = async (stage: Opportunity['stage']) => {
    if (!selected) return;
    try {
      await adminUpsertOpportunity({
        id: selected.id,
        account_id: account.id,
        name: selected.name,
        stage,
        amount: selected.amount,
        close_date: selected.close_date,
      });
      toast.success(
        stage === 'closed_won'
          ? 'Marked Closed Won — a project was created automatically.'
          : 'Stage updated — the client sees the new stage now.',
      );
      await opportunities.reload();
      await onChange();
    } catch (cause) {
      toast.error('Could not change the stage', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const addOpportunity = async () => {
    const name = window.prompt('Name this opportunity', `${account.name} — Salesforce engagement`)?.trim();
    if (!name) return;
    try {
      await adminUpsertOpportunity({ account_id: account.id, name, stage: 'discovery', amount: null, close_date: null });
      setSelectedId(null); // fall back to the newest (first) opportunity
      await opportunities.reload();
      await onChange();
    } catch (cause) {
      toast.error('Could not create the opportunity', {
        description: cause instanceof Error ? cause.message : undefined,
      });
    }
  };

  const submitOffer = async (send: boolean) => {
    if (!selected) return;
    const cleanItems = items.filter((item) => item.name.trim().length > 0);
    if (!title.trim() || cleanItems.length === 0) {
      toast.error('Add a title and at least one line item.');
      return;
    }
    setBusy(true);
    try {
      await adminCreateOfferVersion({
        account_id: account.id,
        opportunity_id: selected.id,
        title: title.trim(),
        summary: summary.trim(),
        expires_on: expiresOn || null,
        change_note: changeNote.trim() || null,
        items: cleanItems.map((item) => ({ ...item, amount: Number(item.amount) || 0 })),
        send,
      });
      toast.success(send ? 'Offer sent to the client.' : 'Draft saved.');
      setShowBuilder(false);
      setTitle('');
      setSummary('');
      setChangeNote('');
      setItems([{ ...EMPTY_ITEM }]);
      await offers.reload();
    } catch (cause) {
      toast.error('Could not save the offer', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const send = async (offerId: string, label: string) => {
    try {
      await adminSendOffer(offerId, account.id, label);
      toast.success('Offer sent.');
      await offers.reload();
    } catch (cause) {
      toast.error('Could not send', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const uploadDoc = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    if (!docName.trim() && !docFile) {
      toast.error('Give the document a name or pick a file.');
      return;
    }
    setDocBusy(true);
    try {
      await adminUploadDocument({
        account_id: account.id,
        name: docName.trim() || docFile?.name || 'Document',
        doc_type: docType,
        status: 'sent',
        file: docFile,
        opportunity_id: selected.id,
      });
      toast.success('Document added to this opportunity.');
      setDocName('');
      setDocFile(null);
      await documents.reload();
    } catch (cause) {
      toast.error('Could not upload', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setDocBusy(false);
    }
  };

  const openDoc = async (filePath: string | null) => {
    if (!filePath) return;
    try {
      window.open(await getDocumentUrl(filePath), '_blank', 'noopener');
    } catch (cause) {
      toast.error('Could not open', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const removeDoc = async (id: string, name: string) => {
    if (!window.confirm(`Remove "${name}"?`)) return;
    try {
      await adminDeleteDocument(id);
      await documents.reload();
    } catch (cause) {
      toast.error('Could not remove', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  if (opportunities.loading || offers.loading || documents.loading) return <PortalSpinner />;
  if (opportunities.error) return <ErrorNote>{opportunities.error}</ErrorNote>;
  if (offers.error) return <ErrorNote>{offers.error}</ErrorNote>;

  return (
    <div className="space-y-5">
      <PortalCard
        title="Opportunities"
        description="Each opportunity carries its own offers and documents; winning one spins up a project."
        action={
          <PortalButton onClick={addOpportunity}>
            <Plus className="h-4 w-4" /> Add opportunity
          </PortalButton>
        }
      >
        {opps.length === 0 ? (
          <EmptyState title="No opportunities yet" description="Add one to start tracking a deal in the portal." />
        ) : (
          <div className="flex flex-wrap gap-2">
            {opps.map((opp) => (
              <button
                key={opp.id}
                onClick={() => setSelectedId(opp.id)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  opp.id === selected?.id
                    ? 'border-violet bg-portal-tint text-violet'
                    : 'border-border-color hover:border-violet/50',
                )}
              >
                <div className="font-medium">{opp.name}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-grey">
                  <StatusTag tone={toneFor(opp.stage)}>{STAGE_LABELS[opp.stage]}</StatusTag>
                  {opp.amount != null && <span>{formatMoney(opp.amount)}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </PortalCard>

      {selected && (
        <>
          <PortalCard
            title="Stage"
            description={selected.name}
            action={
              <select
                className={`${inputClass} w-auto py-1.5 text-xs`}
                value={selected.stage}
                onChange={(event) => setStage(event.target.value as Opportunity['stage'])}
              >
                {[...OPPORTUNITY_STAGES, 'closed_lost'].map((stage) => (
                  <option key={stage} value={stage}>
                    {STAGE_LABELS[stage]}
                  </option>
                ))}
              </select>
            }
          >
            <div className="px-2 pt-2 pb-1">
              <StageTracker stages={STAGES} current={selected.stage} />
            </div>
          </PortalCard>

          <PortalCard
            title="Offers"
            description="Revisions create a new version for this opportunity; the previous one is superseded."
            action={
              <PortalButton onClick={() => setShowBuilder((open) => !open)}>
                <Plus className="h-4 w-4" /> New offer version
              </PortalButton>
            }
          >
            {showBuilder && (
              <div className="mb-5 space-y-3 rounded-lg border border-border-color bg-off-white p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Offer title">
                    <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} />
                  </Field>
                  <Field label="Valid through">
                    <input
                      type="date"
                      className={inputClass}
                      value={expiresOn}
                      onChange={(event) => setExpiresOn(event.target.value)}
                    />
                  </Field>
                  <Field label="What changed" hint="Shown in the client's offer history.">
                    <input
                      className={inputClass}
                      value={changeNote}
                      onChange={(event) => setChangeNote(event.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Summary">
                  <textarea
                    rows={2}
                    className={inputClass}
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                  />
                </Field>

                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-grey">Line items</span>
                  {items.map((item, index) => (
                    <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1.5fr_120px_40px]">
                      <input
                        className={inputClass}
                        placeholder="Name"
                        value={item.name}
                        onChange={(event) =>
                          setItems((current) =>
                            current.map((row, i) => (i === index ? { ...row, name: event.target.value } : row)),
                          )
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Detail"
                        value={item.detail}
                        onChange={(event) =>
                          setItems((current) =>
                            current.map((row, i) => (i === index ? { ...row, detail: event.target.value } : row)),
                          )
                        }
                      />
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={inputClass}
                        value={item.amount}
                        onChange={(event) =>
                          setItems((current) =>
                            current.map((row, i) => (i === index ? { ...row, amount: Number(event.target.value) } : row)),
                          )
                        }
                      />
                      <PortalButton
                        variant="ghost"
                        type="button"
                        onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                        aria-label="Remove line item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </PortalButton>
                    </div>
                  ))}
                  <PortalButton
                    variant="ghost"
                    type="button"
                    onClick={() => setItems((current) => [...current, { ...EMPTY_ITEM }])}
                  >
                    <Plus className="h-4 w-4" /> Add line item
                  </PortalButton>
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-border-color pt-3">
                  <span className="text-sm font-semibold">Total: {formatMoney(total)}</span>
                  <div className="ml-auto flex gap-2">
                    <PortalButton variant="secondary" disabled={busy} onClick={() => submitOffer(false)}>
                      Save draft
                    </PortalButton>
                    <PortalButton disabled={busy} onClick={() => submitOffer(true)}>
                      <Send className="h-4 w-4" /> Send to client
                    </PortalButton>
                  </div>
                </div>
              </div>
            )}

            {oppOffers.length === 0 ? (
              <EmptyState title="No offers yet" />
            ) : (
              <PortalTable head={['Version', 'Title', 'Total', 'Status', 'Sent', 'Client note', '']}>
                {oppOffers.map((offer) => (
                  <Row key={offer.id}>
                    <Cell className="font-medium">v{offer.version}</Cell>
                    <Cell>{offer.title}</Cell>
                    <Cell className="whitespace-nowrap">{formatMoney(offer.total, offer.currency)}</Cell>
                    <Cell>
                      <StatusTag tone={toneFor(offer.status)}>{OFFER_STATUS_LABELS[offer.status]}</StatusTag>
                    </Cell>
                    <Cell className="whitespace-nowrap text-grey">{formatDate(offer.sent_at)}</Cell>
                    <Cell className="max-w-xs text-grey">{offer.client_note ?? '—'}</Cell>
                    <Cell className="text-right">
                      {offer.status === 'draft' && (
                        <PortalButton onClick={() => send(offer.id, `${offer.title} (v${offer.version})`)}>
                          <Send className="h-4 w-4" /> Send
                        </PortalButton>
                      )}
                    </Cell>
                  </Row>
                ))}
              </PortalTable>
            )}
          </PortalCard>

          <PortalCard
            title="Contracts & Documents"
            description="Attached to this opportunity. On Closed Won they follow the deal into the project."
          >
            <form onSubmit={uploadDoc} className="mb-4 grid gap-3 rounded-lg border border-border-color bg-off-white p-4 sm:grid-cols-[2fr_1fr_1.5fr_auto]">
              <Field label="Name">
                <input className={inputClass} value={docName} onChange={(event) => setDocName(event.target.value)} />
              </Field>
              <Field label="Type">
                <select className={inputClass} value={docType} onChange={(event) => setDocType(event.target.value as DocType)}>
                  {DOC_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {DOC_TYPE_LABELS[value]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="File">
                <input
                  type="file"
                  className={`${inputClass} py-1.5`}
                  onChange={(event) => setDocFile(event.target.files?.[0] ?? null)}
                />
              </Field>
              <div className="flex items-end">
                <PortalButton type="submit" disabled={docBusy}>
                  <Upload className="h-4 w-4" /> Add
                </PortalButton>
              </div>
            </form>

            {oppDocs.length === 0 ? (
              <EmptyState title="No documents on this opportunity yet" />
            ) : (
              <PortalTable head={['Name', 'Type', 'Version', 'Updated', '']}>
                {oppDocs.map((doc) => (
                  <Row key={doc.id}>
                    <Cell className="font-medium">{doc.name}</Cell>
                    <Cell className="text-grey">{DOC_TYPE_LABELS[doc.doc_type]}</Cell>
                    <Cell className="text-grey">v{doc.version}</Cell>
                    <Cell className="whitespace-nowrap text-grey">{formatDate(doc.updated_at)}</Cell>
                    <Cell className="text-right">
                      <div className="flex justify-end gap-1">
                        {doc.file_url && (
                          <PortalButton variant="ghost" onClick={() => openDoc(doc.file_url)} aria-label="Download">
                            <Download className="h-4 w-4" />
                          </PortalButton>
                        )}
                        <PortalButton variant="ghost" onClick={() => removeDoc(doc.id, doc.name)} aria-label="Remove">
                          <Trash2 className="h-4 w-4" />
                        </PortalButton>
                      </div>
                    </Cell>
                  </Row>
                ))}
              </PortalTable>
            )}
          </PortalCard>
        </>
      )}
    </div>
  );
};
